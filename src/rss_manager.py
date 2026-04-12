import html
import os
import time
import datetime
import xml.etree.ElementTree as ET
from pathlib import Path
from http.server import SimpleHTTPRequestHandler
import socketserver
import threading
from podcast_gen.audio_generator import AudioGenerator
from podcast_gen.generator import ScriptGenerator
from config import config

BASE_DIR = Path("./public").absolute()
AUDIO_DIR = (BASE_DIR / "audio").absolute()
INBOX_DIR = Path("./inbox").absolute()
SCRIPTS_DIR = Path("./scripts").absolute()


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
            <title>{html.escape(ep['title'])}</title>
            <description>{html.escape(ep['description'])}</description>
            <pubDate>{ep['pub_date']}</pubDate>
            <enclosure url="{ep['url']}" length="0" type="{_mime_type(ep['url'])}" />
            <guid>{ep['url']}</guid>
        </item>
        """

    _base = config.server.base_url
    _cover_url = f"{_base}/{config.podcast.cover_image}"
    _title = html.escape(config.podcast.title)
    _desc = html.escape(config.podcast.description)

    rss_content = f"""<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
        <channel>
            <title>{_title}</title>
            <link>{_base}</link>
            <description>{_desc}</description>
            <image>
                <url>{_cover_url}</url>
                <title>{_title}</title>
                <link>{_base}</link>
            </image>
            <itunes:image href="{_cover_url}" />
            {items}
        </channel>
    </rss>
    """
    with open(BASE_DIR / "feed.xml", "w", encoding="utf-8") as f:
        f.write(rss_content)


_audio_generator = AudioGenerator(AUDIO_DIR)
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
    safe_title = "".join(
        c if c.isalnum() or c in "-_ " else "_" for c in result.title
    ).strip()
    basename = f"{timestamp}_{safe_title}"
    script_path = SCRIPTS_DIR / f"{basename}.txt"
    script_path.write_text(
        f"# {result.title}\n\n{result.description}\n\n{result.script}",
        encoding="utf-8",
    )
    print(f"Script saved to: {script_path}")

    # 3. 音声生成 (VoiceCraft)
    audio_file = _audio_generator.generate(result.script, basename=basename)

    # 4. RSS更新 (既存のエピソードに追記)
    _episodes.append(
        {
            "title": result.title,
            "description": result.description,
            "pub_date": datetime.datetime.now().strftime("%a, %d %b %Y %H:%M:%S +0000"),
            "url": f"{config.server.base_url}/audio/{audio_file}",
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
        time.sleep(config.server.watch_interval)


def start_server():
    """HTTPサーバーを別スレッドで起動"""
    os.chdir(BASE_DIR)
    handler = SimpleHTTPRequestHandler
    with PodcastServer(("", config.server.port), handler) as httpd:
        print(f"Serving at port {config.server.port}")
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
