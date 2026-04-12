from __future__ import annotations

import tomllib
from dataclasses import dataclass
from pathlib import Path

_CONFIG_PATH = Path(__file__).parent.parent / "config.toml"


@dataclass(frozen=True)
class ServerConfig:
    base_url: str
    port: int
    watch_interval: int


@dataclass(frozen=True)
class PodcastConfig:
    title: str
    description: str
    cover_image: str  # filename under public/


@dataclass(frozen=True)
class SpeakerConfig:
    name: str
    voice_name: str
    description: str


@dataclass(frozen=True)
class VoicecraftConfig:
    model: str
    response_format: str
    instructions: str
    host: SpeakerConfig
    cohost: SpeakerConfig


@dataclass(frozen=True)
class GeneratorConfig:
    model: str
    system_instruction: str | None
    prompt_template: str | None


@dataclass(frozen=True)
class AppConfig:
    server: ServerConfig
    podcast: PodcastConfig
    voicecraft: VoicecraftConfig
    generator: GeneratorConfig


def load_config(path: Path = _CONFIG_PATH) -> AppConfig:
    """Load config.toml and return a typed AppConfig. Raises FileNotFoundError if missing."""
    if not path.exists():
        raise FileNotFoundError(
            f"設定ファイルが見つかりません: {path}\n"
            "config.toml.example をコピーして config.toml を作成してください。"
        )
    with open(path, "rb") as f:
        raw = tomllib.load(f)
    s, p, v, g = raw["server"], raw["podcast"], raw["voicecraft"], raw["generator"]
    spk = v["speakers"]
    return AppConfig(
        server=ServerConfig(**s),
        podcast=PodcastConfig(**p),
        voicecraft=VoicecraftConfig(
            model=v["model"],
            response_format=v["response_format"],
            instructions=v["instructions"],
            host=SpeakerConfig(**spk["host"]),
            cohost=SpeakerConfig(**spk["cohost"]),
        ),
        generator=GeneratorConfig(
            model=g["model"],
            system_instruction=g.get("system_instruction"),
            prompt_template=g.get("prompt_template"),
        ),
    )


config = load_config()
