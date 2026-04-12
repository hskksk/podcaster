from __future__ import annotations

import uuid
from pathlib import Path

from voicecraft.audio_export import save_audio_bytes
from voicecraft.speech_synthesizer import synthesizer_factory
from config import config

AUDIO_DIR = (Path("./public") / "audio").absolute()

_vc = config.voicecraft
_VOICECRAFT_CONFIG = {
    "multi_speaker": True,
    "speakers": [
        {"name": _vc.host.name, "voice_name": _vc.host.voice_name, "description": _vc.host.description},
        {"name": _vc.cohost.name, "voice_name": _vc.cohost.voice_name, "description": _vc.cohost.description},
    ],
    "response_format": _vc.response_format,
}


class AudioGenerator:
    """Generate an audio file from podcast script text using VoiceCraft."""

    def __init__(self, audio_dir: Path = AUDIO_DIR) -> None:
        self.audio_dir = audio_dir

    def generate(self, script: str, basename: str | None = None) -> str:
        """Synthesize speech and save to an audio file.

        Args:
            script: Podcast script text.
            basename: Filename stem (without extension). A random suffix is used when omitted.

        Returns:
            Filename of the generated audio file (e.g. ``episode_abc123.m4a``).
        """
        filename = f"{basename}.m4a" if basename else f"episode_{uuid.uuid4().hex[:8]}.m4a"
        filepath = self.audio_dir / filename

        text = script if isinstance(script, str) else "\n".join(script)
        print(f"Executing VoiceCraft for {len(text)} chars...")

        synthesizer = synthesizer_factory(config.voicecraft.model, _VOICECRAFT_CONFIG)
        audio_data = synthesizer.synthesize(text, config.voicecraft.instructions)
        save_audio_bytes(
            audio_data,
            filepath,
            output_format="m4a",
            response_format=_VOICECRAFT_CONFIG["response_format"],
        )

        return filename
