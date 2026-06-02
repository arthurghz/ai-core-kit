#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Re-authored for ai-core-kit from alirezarezvani/claude-skills
# (product-team/skills/spec-to-repo), Copyright (c) 2025 Alireza Rezvani (MIT).
"""validate_project.py — check a generated project directory for common issues.

Stdlib only. Checks:
  - README.md exists and is non-empty
  - .gitignore exists
  - a package manifest exists (package.json, requirements.txt, go.mod, ...)
  - .env.example exists when code references env vars
  - no committed .env (secret leak)
  - at least one test file exists
  - no TODO/FIXME/placeholder bodies in generated code

Usage:
    python3 validate_project.py /path/to/project
    python3 validate_project.py /path/to/project --format json
    python3 validate_project.py /path/to/project --strict   # warnings fail too
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Dict, List

MANIFESTS = [
    "package.json", "requirements.txt", "pyproject.toml", "go.mod", "Cargo.toml",
    "pubspec.yaml", "Gemfile", "pom.xml", "build.gradle", "build.gradle.kts",
]

CODE_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".go", ".rs", ".rb",
    ".dart", ".java", ".kt", ".swift", ".cs", ".cpp", ".c",
}

TEST_PATTERNS = [
    r"test_.*\.py$", r".*_test\.py$", r".*\.test\.[jt]sx?$", r".*\.spec\.[jt]sx?$",
    r".*_test\.go$", r".*_test\.rs$", r".*_test\.dart$",
    r"(^|/)(tests?|spec|__tests__)/.+",
]

PLACEHOLDER_PATTERNS = [
    r"\bTODO\b", r"\bFIXME\b", r"\bHACK\b",
    r"//\s*implement", r"#\s*implement",
    r"raise NotImplementedError", r"#\s*placeholder",
]

ENV_VAR_PATTERNS = [
    r"process\.env\.\w+", r"os\.environ\[", r"os\.getenv\(", r"std::env::var",
    r"os\.Getenv\(", r"ENV\[", r"Platform\.environment\[",
]

SKIP_DIRS = {
    ".git", "node_modules", ".next", "__pycache__", "target", ".dart_tool",
    "build", "dist", ".venv", "venv", "vendor", ".turbo",
}


def find_files(root: str) -> List[str]:
    out: List[str] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        out.extend(os.path.join(dirpath, f) for f in filenames)
    return out


def _result(name: str, status: str, message: str) -> Dict[str, str]:
    return {"name": name, "status": status, "message": message}


def check_readme(root: str) -> Dict[str, str]:
    path = os.path.join(root, "README.md")
    if not os.path.isfile(path):
        return _result("readme", "FAIL", "README.md missing")
    size = os.path.getsize(path)
    if size < 50:
        return _result("readme", "WARN", f"README.md is only {size} bytes — likely incomplete")
    return _result("readme", "PASS", f"README.md exists ({size} bytes)")


def check_gitignore(root: str) -> Dict[str, str]:
    if not os.path.isfile(os.path.join(root, ".gitignore")):
        return _result("gitignore", "FAIL", ".gitignore missing")
    return _result("gitignore", "PASS", ".gitignore exists")


def check_manifest(root: str) -> Dict[str, str]:
    for manifest in MANIFESTS:
        if os.path.isfile(os.path.join(root, manifest)):
            return _result("manifest", "PASS", f"manifest found: {manifest}")
    return _result("manifest", "FAIL", "no package manifest (package.json, requirements.txt, go.mod, ...)")


def _reads(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as fh:
            return fh.read()
    except OSError:
        return ""


def check_env_example(root: str, files: List[str]) -> Dict[str, str]:
    uses_env = any(
        re.search(p, _reads(f))
        for f in files if os.path.splitext(f)[1] in CODE_EXTENSIONS
        for p in ENV_VAR_PATTERNS
    )
    if not uses_env:
        return _result("env_example", "PASS", "no env vars detected — .env.example not required")
    if not os.path.isfile(os.path.join(root, ".env.example")):
        return _result("env_example", "FAIL", "code references env vars but .env.example is missing")
    return _result("env_example", "PASS", ".env.example exists")


def check_no_env_file(root: str) -> Dict[str, str]:
    if os.path.isfile(os.path.join(root, ".env")):
        return _result("no_env_committed", "FAIL", ".env file found — secrets may be committed")
    return _result("no_env_committed", "PASS", "no .env file committed")


def check_tests(files: List[str], root: str) -> Dict[str, str]:
    for f in files:
        rel = os.path.relpath(f, root).replace(os.sep, "/")
        if any(re.search(p, rel) for p in TEST_PATTERNS):
            return _result("tests", "PASS", f"test file found: {rel}")
    return _result("tests", "FAIL", "no test files found")


def check_placeholders(files: List[str], root: str) -> Dict[str, str]:
    findings: List[str] = []
    for f in files:
        if os.path.splitext(f)[1] not in CODE_EXTENSIONS:
            continue
        for i, line in enumerate(_reads(f).splitlines(), 1):
            if any(re.search(p, line) for p in PLACEHOLDER_PATTERNS):
                findings.append(f"{os.path.relpath(f, root)}:{i}")
                break
    if not findings:
        return _result("placeholders", "PASS", "no TODO/FIXME/placeholder code found")
    if len(findings) <= 3:
        return _result("placeholders", "WARN", f"{len(findings)} placeholder(s): {', '.join(findings)}")
    return _result("placeholders", "FAIL",
                   f"{len(findings)} placeholders (first 5): {', '.join(findings[:5])}")


def run_checks(root: str, strict: bool) -> Dict:
    files = find_files(root)
    checks = [
        check_readme(root), check_gitignore(root), check_manifest(root),
        check_env_example(root, files), check_no_env_file(root),
        check_tests(files, root), check_placeholders(files, root),
    ]
    summary = {
        "pass": sum(c["status"] == "PASS" for c in checks),
        "warn": sum(c["status"] == "WARN" for c in checks),
        "fail": sum(c["status"] == "FAIL" for c in checks),
    }
    if strict:
        overall = "PASS" if summary["fail"] == 0 and summary["warn"] == 0 else "FAIL"
    else:
        overall = "PASS" if summary["fail"] == 0 else "FAIL"
    return {"project": root, "files_scanned": len(files), "checks": checks,
            "summary": summary, "overall": overall}


def print_report(result: Dict) -> None:
    icons = {"PASS": "[PASS]", "WARN": "[WARN]", "FAIL": "[FAIL]"}
    print("=" * 60)
    print("PROJECT VALIDATION REPORT")
    print("=" * 60)
    print(f"Project: {result['project']}")
    print(f"Files scanned: {result['files_scanned']}\n")
    for c in result["checks"]:
        print(f"  {icons[c['status']]} {c['name']}: {c['message']}")
    s = result["summary"]
    print(f"\nResults: {s['pass']} pass, {s['warn']} warn, {s['fail']} fail")
    print(f"Overall: {result['overall']}")
    print("=" * 60)


def main() -> None:
    p = argparse.ArgumentParser(description="Validate a generated project directory.")
    p.add_argument("path", help="project directory to validate")
    p.add_argument("--format", choices=["text", "json"], default="text")
    p.add_argument("--strict", action="store_true", help="treat warnings as failures")
    args = p.parse_args()

    if not os.path.isdir(args.path):
        print(f"error: not a directory: {args.path}", file=sys.stderr)
        sys.exit(2)

    result = run_checks(os.path.abspath(args.path), args.strict)
    if args.format == "json":
        print(json.dumps(result, indent=2))
    else:
        print_report(result)
    sys.exit(0 if result["overall"] == "PASS" else 1)


if __name__ == "__main__":
    main()
