import os
import time
import uuid
import datetime
import xml.etree.ElementTree as ET
from pathlib import Path
from http.server import SimpleHTTPRequestHandler
import socketserver
import threading
from voicecraft.audio_export import save_audio_bytes
from voicecraft.speech_synthesizer import synthesizer_factory
from podcast_gen.generator import ScriptGenerator

# 設定 (実際にはconfig.pyなどから読み込む)
BASE_DIR = Path("./public").absolute()
AUDIO_DIR = (BASE_DIR / "audio").absolute()
INBOX_DIR = Path("./inbox").absolute()
SCRIPTS_DIR = Path("./scripts").absolute()
BASE_URL = "http://100.113.194.47:8080"  # TailscaleのIPを動的に取得するか固定


class PodcastServer(socketserver.TCPServer):
    allow_reuse_address = True


def load_feed():
    """Load existing episodes from feed.xml. Returns an empty list if the file does not exist."""
    feed_path = BASE_DIR / "feed.xml"
    if not feed_path.exists():
        return []

    try:
        tree = ET.parse(feed_path)
        channel = tree.getroot().find("channel")
        episodes = []
        for item in channel.findall("item"):
            enclosure = item.find("enclosure")
            episodes.append(
                {
                    "title": item.findtext("title", ""),
                    "description": item.findtext("description", ""),
                    "pub_date": item.findtext("pubDate", ""),
                    "url": enclosure.get("url", "") if enclosure is not None else "",
                }
            )
        print(f"Loaded {len(episodes)} existing episode(s) from feed.xml.")
        return episodes
    except ET.ParseError as e:
        print(
            f"Warning: failed to parse feed.xml ({e}). Starting with empty episode list."
        )
        return []


_AUDIO_MIME_TYPES = {
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
}


def _mime_type(url):
    ext = Path(url).suffix.lower()
    return _AUDIO_MIME_TYPES.get(ext, "audio/mpeg")


def update_rss(episodes):
    """RSS feed.xml を生成・更新する"""
    items = ""
    for ep in episodes:
        items += f"""
        <item>
            <title>{ep['title']}</title>
            <description>{ep['description']}</description>
            <pubDate>{ep['pub_date']}</pubDate>
            <enclosure url="{ep['url']}" length="0" type="{_mime_type(ep['url'])}" />
            <guid>{ep['url']}</guid>
        </item>
        """

    rss_content = f"""<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
        <channel>
            <title>The AI,MATH &amp; Physics Podcast〜探求と学びの垂れ流し〜</title>
            <link>{BASE_URL}</link>
            <description>AI・数学（モジュラー曲線・群論・整数論など）・物理・ソフトウェア開発ツールなどの話題を垂れ流すポッドキャスト。VoiceCraft (https://github.com/hskksk/voicecraft) で自動生成。</description>
            <image>
                <url>{BASE_URL}/cover.png</url>
                <title>The AI,MATH &amp; Physics Podcast〜探求と学びの垂れ流し〜</title>
                <link>{BASE_URL}</link>
            </image>
            <itunes:image href="{BASE_URL}/cover.png" />
            {items}
        </channel>
    </rss>
    """
    with open(BASE_DIR / "feed.xml", "w", encoding="utf-8") as f:
        f.write(rss_content)


VOICECRAFT_MODEL = "gemini/gemini-2.5-flash-preview-tts"
# Speaker names used in script text (format: "Host: ...\nCoHost: ...")
SPEAKER_HOST = "Host"
SPEAKER_COHOST = "CoHost"
VOICECRAFT_CONFIG = {
    "multi_speaker": True,
    "speakers": [
        {
            "name": SPEAKER_HOST,
            "voice_name": "Charon",  # Informative — suits the lead/narrator role
            "description": "ポッドキャストの進行役。テーマをわかりやすく解説し、会話をリードする。",
        },
        {
            "name": SPEAKER_COHOST,
            "voice_name": "Achird",  # Friendly — suits the curious listener role
            "description": "コ・ホスト。聴衆の代わりに質問し、ホストの話に興味深く反応する。",
        },
    ],
    "response_format": "wav",
}
VOICECRAFT_INSTRUCTIONS = (
    "これは2人のスピーカーによるポッドキャストの会話です。"
    "自然な会話のトーンで、スピーカーの切り替わりに適切な間を置いて話してください。"
    "Hostが議論をリードし、CoHostは質問をしながら興味深く反応します。"
)


def run_voicecraft(script, basename=None):
    """Run VoiceCraft synthesizer to generate an M4A file from script text."""
    filename = f"{basename}.m4a" if basename else f"episode_{uuid.uuid4().hex[:8]}.m4a"
    filepath = AUDIO_DIR / filename

    text = script if isinstance(script, str) else "\n".join(script)
    print(f"Executing VoiceCraft for {len(text)} chars...")

    synthesizer = synthesizer_factory(VOICECRAFT_MODEL, VOICECRAFT_CONFIG)
    audio_data = synthesizer.synthesize(text, VOICECRAFT_INSTRUCTIONS)
    save_audio_bytes(
        audio_data,
        filepath,
        output_format="m4a",
        response_format=VOICECRAFT_CONFIG["response_format"],
    )

    return filename


_episodes = []


def process_new_content(content_path):
    """新しいファイルを検知した際のメイン処理"""
    print(f"Processing: {content_path}")
    with open(content_path, "r", encoding="utf-8") as f:
        raw_content = f.read()

    # 1. 台本生成
    gen = ScriptGenerator()
    result = gen.generate(raw_content)

    # 2. 台本を保存
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_title = "".join(c if c.isalnum() or c in "-_ " else "_" for c in result.title).strip()
    basename = f"{timestamp}_{safe_title}"
    script_path = SCRIPTS_DIR / f"{basename}.txt"
    script_path.write_text(
        f"# {result.title}\n\n{result.description}\n\n{result.script}",
        encoding="utf-8",
    )
    print(f"Script saved to: {script_path}")

    # 3. 音声生成 (VoiceCraft)
    audio_file = run_voicecraft(result.script, basename=basename)

    # 3. RSS更新 (既存のエピソードに追記)
    _episodes.append(
        {
            "title": result.title,
            "description": result.description,
            "pub_date": datetime.datetime.now().strftime("%a, %d %b %Y %H:%M:%S +0000"),
            "url": f"{BASE_URL}/audio/{audio_file}",
        }
    )
    update_rss(_episodes)
    print("Done!")


def watch_inbox():
    """inboxディレクトリを監視"""
    print(f"Watching {INBOX_DIR}...")
    while True:
        for file in INBOX_DIR.glob("*"):
            if file.is_file():
                process_new_content(file)
                file.unlink()  # 処理後に削除
        time.sleep(10)


def start_server():
    """HTTPサーバーを別スレッドで起動"""
    os.chdir(BASE_DIR)
    handler = SimpleHTTPRequestHandler
    with PodcastServer(("", 8080), handler) as httpd:
        print("Serving at port 8080")
        httpd.serve_forever()


if __name__ == "__main__":
    # フォルダ準備
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    INBOX_DIR.mkdir(parents=True, exist_ok=True)
    SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

    # 既存の feed.xml を読み込む
    _episodes.extend(load_feed())

    # サーバーをスレッドで開始
    threading.Thread(target=start_server, daemon=True).start()

    # メインループ(監視)を開始
    watch_inbox()
