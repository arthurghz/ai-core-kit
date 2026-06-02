#!/usr/bin/env python3
# =============================================================================
# lint-frontmatter.py  --  META-layer frontmatter linter for ai-core-kit
# =============================================================================
# Enforces the canonical frontmatter conventions (docs/CONVENTIONS.md, BOOTSTRAP
# §2) across the kit's Claude Code primitives AND the CHILD-payload templates:
#
#   .claude/agents/*.md          subagent definitions   (META build team)
#   .claude/commands/*.md         slash commands          (META)
#   .claude/skills/**/SKILL.md    skills                  (META, if any)
#   templates/**/SKILL.md         skills shipped to child (CHILD payload)
#
# RULES
#   SKILL.md   REQUIRE  name (lowercase-hyphenated) + description.
#              REJECT   version / author / category / triggers / updated.
#              optional name, description, license, allowed-tools (allowlisted).
#              500-line BODY cap  -> WARNING (advisory, per docs).
#   agent .md  REQUIRE  name (lowercase-hyphenated) + description.
#              optional model (haiku|sonnet|opus|inherit), tools, color, and the
#              other documented subagent keys.
#   command md REQUIRE  description.
#              optional argument-hint, allowed-tools, disable-model-invocation,
#              model, name.
#
# EXIT  non-zero if ANY error (not warnings) is found. Prints `path:issue` lines.
# USAGE  python3 scripts/lint-frontmatter.py [paths...]
#        With no paths, scans the repo root (cwd, or the repo this script lives in).
# DEPENDENCIES: stdlib only (no PyYAML) — the frontmatter we lint is flat
#        key: value, so a tiny tolerant parser is enough and keeps the kit
#        dependency-free (mirrors the no-runtime-deps render engine).
# =============================================================================
from __future__ import annotations

import os
import re
import sys
from typing import Dict, List, Optional, Tuple

# --- knobs -------------------------------------------------------------------
BODY_LINE_CAP = 500  # advisory; over-cap is a WARNING, never an error.

NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")  # lowercase-hyphenated
MODEL_VALUES = {"haiku", "sonnet", "opus", "inherit"}

# Keys that must NEVER appear in a SKILL.md frontmatter (BOOTSTRAP §2).
SKILL_FORBIDDEN = {"version", "author", "category", "triggers", "updated"}
# The only keys a SKILL.md frontmatter may carry.
SKILL_ALLOWED = {"name", "description", "license", "allowed-tools"}

# Documented subagent frontmatter keys (superset; we only REQUIRE name+description).
AGENT_ALLOWED = {
    "name", "description", "model", "tools", "allowedTools", "color",
    "maxTurns", "permissionMode", "memory", "skills", "hooks",
}
# Documented slash-command frontmatter keys.
COMMAND_ALLOWED = {
    "description", "argument-hint", "allowed-tools", "disable-model-invocation",
    "model", "name",
}


class Finding:
    __slots__ = ("path", "level", "msg")

    def __init__(self, path: str, level: str, msg: str) -> None:
        self.path = path
        self.level = level  # "error" | "warning"
        self.msg = msg

    def render(self) -> str:
        return f"{self.path}: {self.level.upper()}: {self.msg}"


def split_frontmatter(text: str) -> Tuple[Optional[Dict[str, str]], int]:
    """Return (frontmatter dict, body_line_count).

    frontmatter is None when no leading `---` block is present. Values are kept
    as raw strings (trimmed). We do not deep-parse YAML — only flat top-level
    `key: value` lines and the *presence* of keys matters for these rules.
    """
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None, len(lines)

    fm: Dict[str, str] = {}
    end = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end = i
            break
        raw = lines[i]
        # Only capture TOP-LEVEL keys (no leading whitespace) of form `key:`.
        if raw and not raw[0].isspace() and ":" in raw:
            key, _, val = raw.partition(":")
            key = key.strip()
            if key:
                fm[key] = val.strip()
    if end is None:
        return None, len(lines)  # unterminated frontmatter -> treat as none
    body_lines = lines[end + 1:]
    return fm, len(body_lines)


def _require(fm: Dict[str, str], key: str, path: str, out: List[Finding]) -> None:
    if key not in fm or fm[key] == "":
        out.append(Finding(path, "error", f"frontmatter missing required key '{key}'"))


def _check_name(fm: Dict[str, str], path: str, out: List[Finding]) -> None:
    if "name" in fm and fm["name"]:
        name = fm["name"].strip().strip("'\"")
        if not NAME_RE.match(name):
            out.append(
                Finding(path, "error", f"name '{name}' must be lowercase-hyphenated")
            )


def lint_skill(path: str, fm: Dict[str, str], body_lines: int) -> List[Finding]:
    out: List[Finding] = []
    _require(fm, "name", path, out)
    _require(fm, "description", path, out)
    _check_name(fm, path, out)
    for k in fm:
        if k in SKILL_FORBIDDEN:
            out.append(
                Finding(path, "error", f"SKILL.md frontmatter must not carry '{k}'")
            )
        elif k not in SKILL_ALLOWED:
            out.append(
                Finding(
                    path,
                    "error",
                    f"SKILL.md frontmatter key '{k}' is not allowed "
                    f"(allowed: {', '.join(sorted(SKILL_ALLOWED))})",
                )
            )
    if body_lines > BODY_LINE_CAP:
        out.append(
            Finding(
                path,
                "warning",
                f"body is {body_lines} lines (> {BODY_LINE_CAP} cap); "
                f"push detail to references/*.md, assets/, scripts/",
            )
        )
    return out


def lint_agent(path: str, fm: Dict[str, str], body_lines: int) -> List[Finding]:
    out: List[Finding] = []
    _require(fm, "name", path, out)
    _require(fm, "description", path, out)
    _check_name(fm, path, out)
    if "model" in fm and fm["model"]:
        model = fm["model"].strip().strip("'\"")
        if model not in MODEL_VALUES:
            out.append(
                Finding(
                    path,
                    "error",
                    f"model '{model}' must be one of {sorted(MODEL_VALUES)}",
                )
            )
    for k in fm:
        if k in SKILL_FORBIDDEN:
            out.append(
                Finding(path, "error", f"agent frontmatter must not carry '{k}'")
            )
        elif k not in AGENT_ALLOWED:
            out.append(
                Finding(path, "warning", f"unrecognized agent frontmatter key '{k}'")
            )
    if body_lines > BODY_LINE_CAP:
        out.append(
            Finding(path, "warning", f"body is {body_lines} lines (> {BODY_LINE_CAP} cap)")
        )
    return out


def lint_command(path: str, fm: Dict[str, str], body_lines: int) -> List[Finding]:
    out: List[Finding] = []
    _require(fm, "description", path, out)
    if "name" in fm:
        _check_name(fm, path, out)
    for k in fm:
        if k in SKILL_FORBIDDEN:
            out.append(
                Finding(path, "error", f"command frontmatter must not carry '{k}'")
            )
        elif k not in COMMAND_ALLOWED:
            out.append(
                Finding(path, "warning", f"unrecognized command frontmatter key '{k}'")
            )
    return out


def classify(path: str) -> Optional[str]:
    """Return the lint kind for a file path, or None if it is out of scope."""
    norm = path.replace(os.sep, "/")
    base = os.path.basename(norm)
    if base == "SKILL.md":
        return "skill"
    if "/.claude/agents/" in norm and base.endswith(".md"):
        return "agent"
    if "/.claude/commands/" in norm and base.endswith(".md"):
        return "command"
    return None


def discover(roots: List[str]) -> List[str]:
    """Walk the given roots and collect in-scope files."""
    found: List[str] = []
    for root in roots:
        if os.path.isfile(root):
            if classify(root):
                found.append(root)
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            # Skip noisy dirs.
            dirnames[:] = [
                d for d in dirnames
                if d not in {".git", "node_modules", "__pycache__", ".venv", "venv"}
            ]
            for fn in filenames:
                full = os.path.join(dirpath, fn)
                if classify(full):
                    found.append(full)
    return sorted(set(found))


def lint_file(path: str) -> List[Finding]:
    kind = classify(path)
    if not kind:
        return []
    try:
        with open(path, "r", encoding="utf-8") as fh:
            text = fh.read()
    except OSError as exc:
        return [Finding(path, "error", f"could not read file: {exc}")]

    fm, body_lines = split_frontmatter(text)
    if fm is None:
        return [
            Finding(path, "error", "missing or unterminated YAML frontmatter (--- ... ---)")
        ]
    if kind == "skill":
        return lint_skill(path, fm, body_lines)
    if kind == "agent":
        return lint_agent(path, fm, body_lines)
    if kind == "command":
        return lint_command(path, fm, body_lines)
    return []


def default_roots() -> List[str]:
    """Default scan target: the repo root that contains this script."""
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)  # scripts/ -> repo root
    return [repo]


def main(argv: List[str]) -> int:
    roots = argv[1:] if len(argv) > 1 else default_roots()
    files = discover(roots)

    findings: List[Finding] = []
    for f in files:
        findings.extend(lint_file(f))

    errors = [x for x in findings if x.level == "error"]
    warnings = [x for x in findings if x.level == "warning"]

    for x in findings:
        print(x.render())

    scanned = len(files)
    print(
        f"\nlint-frontmatter: scanned {scanned} file(s), "
        f"{len(errors)} error(s), {len(warnings)} warning(s)."
    )
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
