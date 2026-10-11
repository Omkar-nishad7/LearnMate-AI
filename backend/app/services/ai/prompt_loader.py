from functools import lru_cache
from pathlib import Path
import re

from app.core.exceptions import ValidationError

PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts"

_VAR_RE = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


@lru_cache(maxsize=64)
def _read(name: str) -> str:
    p = PROMPTS_DIR / f"{name}.txt"
    if not p.exists():
        raise ValidationError(f"Prompt template not found: {name}")
    return p.read_text(encoding="utf-8")


def load_prompt(name: str) -> str:
    return _read(name)


def render_prompt(name: str, **vars: str) -> str:
    template = load_prompt(name)
    expected = set(_VAR_RE.findall(template))
    missing = expected - set(vars.keys())
    if missing:
        raise ValidationError(f"Missing prompt vars for {name}: {sorted(missing)}")
    # Only substitute declared vars — do not execute format()
    def repl(m: re.Match) -> str:
        key = m.group(1)
        return str(vars.get(key, ""))
    return _VAR_RE.sub(repl, template)