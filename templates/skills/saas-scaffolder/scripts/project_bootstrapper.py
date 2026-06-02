#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Re-authored for ai-core-kit from alirezarezvani/claude-skills
# (product-team/skills/saas-scaffolder), Copyright (c) 2025 Alireza Rezvani (MIT).
"""project_bootstrapper.py — generate the base SaaS scaffold from a config.

Stdlib only. Emits the directory tree, package manifest, README, .env.example,
.gitignore, docker-compose.yml, and Dockerfile for one of three base stacks
(nextjs | express | fastapi). Auth and billing code are added by hand per
references/auth-billing-guide.md — this tool only lays the foundation.

Usage:
    python3 project_bootstrapper.py config.json --output-dir ./my-saas
    python3 project_bootstrapper.py config.json --format json --dry-run

config.json shape:
    {
      "name": "my-saas",
      "description": "…",
      "stack": "nextjs",            # nextjs | express | fastapi
      "database": "postgresql",     # postgresql | mongodb | mysql
      "auth": true,
      "features": { "redis": true, "email": false, "storage": false }
    }
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict


def _nextjs_package(c: Dict[str, Any]) -> str:
    return json.dumps({
        "name": c.get("name", "my-saas"),
        "version": "0.1.0",
        "private": True,
        "scripts": {"dev": "next dev", "build": "next build", "start": "next start",
                    "lint": "next lint", "test": "jest"},
        "dependencies": {"next": "^14.2.0", "react": "^18.3.0", "react-dom": "^18.3.0"},
        "devDependencies": {"typescript": "^5.4.0", "@types/react": "^18.3.0",
                            "@types/node": "^20.12.0", "eslint": "^8.57.0",
                            "eslint-config-next": "^14.2.0"},
    }, indent=2)


def _nextjs_tsconfig(_: Dict[str, Any]) -> str:
    return json.dumps({
        "compilerOptions": {"target": "es2017", "lib": ["dom", "dom.iterable", "esnext"],
                            "allowJs": True, "skipLibCheck": True, "strict": True,
                            "noEmit": True, "esModuleInterop": True, "module": "esnext",
                            "moduleResolution": "bundler", "resolveJsonModule": True,
                            "isolatedModules": True, "jsx": "preserve", "incremental": True,
                            "paths": {"@/*": ["./src/*"]}},
        "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
        "exclude": ["node_modules"],
    }, indent=2)


def _express_package(c: Dict[str, Any]) -> str:
    return json.dumps({
        "name": c.get("name", "my-api"),
        "version": "0.1.0",
        "main": "src/index.ts",
        "scripts": {"dev": "tsx watch src/index.ts", "build": "tsc",
                    "start": "node dist/index.js", "test": "jest", "lint": "eslint src/"},
        "dependencies": {"express": "^4.19.0", "cors": "^2.8.5",
                         "helmet": "^7.1.0", "dotenv": "^16.4.0"},
        "devDependencies": {"typescript": "^5.4.0", "@types/express": "^4.17.0",
                            "@types/cors": "^2.8.0", "@types/node": "^20.12.0",
                            "tsx": "^4.7.0", "jest": "^29.7.0", "@types/jest": "^29.5.0",
                            "eslint": "^8.57.0"},
    }, indent=2)


STACK_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "nextjs": {
        "manifest": ("package.json", _nextjs_package),
        "extra": {"tsconfig.json": _nextjs_tsconfig},
        "dirs": ["src/app", "src/components", "src/lib", "src/styles", "public", "tests"],
        "files": {
            "src/app/layout.tsx": (
                "export default function RootLayout("
                "{ children }: { children: React.ReactNode }) {\n"
                "  return <html lang=\"en\"><body>{children}</body></html>;\n}\n"
            ),
            "src/app/page.tsx": "export default function Home() {\n  return <main><h1>Welcome</h1></main>;\n}\n",
        },
    },
    "express": {
        "manifest": ("package.json", _express_package),
        "extra": {},
        "dirs": ["src/routes", "src/middleware", "src/models", "src/services", "src/utils", "tests"],
        "files": {
            "src/index.ts": (
                "import express from 'express';\nimport cors from 'cors';\n"
                "import helmet from 'helmet';\nimport { config } from 'dotenv';\n\n"
                "config();\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\n"
                "app.use(helmet());\napp.use(cors());\napp.use(express.json());\n\n"
                "app.get('/health', (_req, res) => res.json({ status: 'ok' }));\n\n"
                "app.listen(PORT, () => console.log(`Server on ${PORT}`));\n"
            ),
        },
    },
    "fastapi": {
        "manifest": ("requirements.txt", lambda _c: (
            "fastapi>=0.110.0\nuvicorn[standard]>=0.29.0\npydantic>=2.0.0\n"
            "pydantic-settings>=2.0.0\npython-dotenv>=1.0.0\nsqlalchemy>=2.0.0\n"
            "alembic>=1.13.0\npytest>=8.0.0\nhttpx>=0.27.0\n"
        )),
        "extra": {},
        "dirs": ["app/api", "app/models", "app/services", "app/core", "tests", "alembic"],
        "files": {
            "app/__init__.py": "",
            "app/main.py": (
                "from fastapi import FastAPI\nfrom app.core.config import settings\n\n"
                "app = FastAPI(title=settings.PROJECT_NAME)\n\n"
                "@app.get('/health')\ndef health():\n    return {'status': 'ok'}\n"
            ),
            "app/core/__init__.py": "",
            "app/core/config.py": (
                "from pydantic_settings import BaseSettings\n\n"
                "class Settings(BaseSettings):\n"
                "    PROJECT_NAME: str = 'API'\n"
                "    DATABASE_URL: str = 'sqlite:///./app.db'\n"
                "    class Config:\n        env_file = '.env'\n\n"
                "settings = Settings()\n"
            ),
        },
    },
}


def generate_readme(c: Dict[str, Any]) -> str:
    name = c.get("name", "my-project")
    stack = c.get("stack", "nextjs")
    node = stack in ("nextjs", "express")
    run = "npm install && npm run dev" if node else "pip install -r requirements.txt && uvicorn app.main:app --reload"
    test = "npm test" if node else "pytest"
    src = "src/" if node else "app/"
    return (
        f"# {name}\n\n{c.get('description', 'A SaaS application')}\n\n"
        "## Tech stack\n\n"
        f"- Framework: {stack}\n- Database: {c.get('database', 'PostgreSQL')}\n"
        f"- Auth: {'enabled' if c.get('auth') else 'none'}\n\n"
        "## Getting started\n\n"
        "```bash\ncp .env.example .env\n"
        f"docker compose up -d   # or run locally:\n{run}\n```\n\n"
        f"## Testing\n\n```bash\n{test}\n```\n\n"
        f"## Structure\n\n```\n{name}/\n├── {src}\n├── tests/\n"
        "├── docker-compose.yml\n├── .env.example\n└── README.md\n```\n"
    )


def generate_env_example(c: Dict[str, Any]) -> str:
    lines = ["# Application", f"APP_NAME={c.get('name', 'my-app')}",
             "NODE_ENV=development", "PORT=3000", "", "# Database"]
    db = c.get("database", "postgresql")
    if db == "postgresql":
        lines += ["DATABASE_URL=postgresql://user:password@localhost:5432/mydb", ""]
    elif db == "mongodb":
        lines += ["MONGODB_URI=mongodb://localhost:27017/mydb", ""]
    elif db == "mysql":
        lines += ["DATABASE_URL=mysql://user:password@localhost:3306/mydb", ""]
    if c.get("auth"):
        lines += ["# Auth", "JWT_SECRET=change-me-in-production", "JWT_EXPIRY=7d", ""]
    feats = c.get("features", {})
    if feats.get("email"):
        lines += ["# Email", "SMTP_HOST=smtp.example.com", "SMTP_PORT=587", "SMTP_USER=", "SMTP_PASS=", ""]
    if feats.get("storage"):
        lines += ["# Storage", "S3_BUCKET=", "S3_REGION=us-east-1",
                  "AWS_ACCESS_KEY_ID=", "AWS_SECRET_ACCESS_KEY=", ""]
    return "\n".join(lines)


def _db_service(db: str) -> str:
    if db == "postgresql":
        return ("  db:\n    image: postgres:16-alpine\n    ports:\n      - \"5432:5432\"\n"
                "    environment:\n      POSTGRES_USER: user\n      POSTGRES_PASSWORD: password\n"
                "      POSTGRES_DB: mydb\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n")
    if db == "mongodb":
        return ("  db:\n    image: mongo:7\n    ports:\n      - \"27017:27017\"\n"
                "    volumes:\n      - mongodata:/data/db\n")
    if db == "mysql":
        return ("  db:\n    image: mysql:8\n    ports:\n      - \"3306:3306\"\n"
                "    environment:\n      MYSQL_ROOT_PASSWORD: password\n      MYSQL_DATABASE: mydb\n"
                "    volumes:\n      - mysqldata:/var/lib/mysql\n")
    return ""


def _redis_service(c: Dict[str, Any]) -> str:
    if c.get("features", {}).get("redis"):
        return "  redis:\n    image: redis:7-alpine\n    ports:\n      - \"6379:6379\"\n"
    return ""


def generate_docker_compose(c: Dict[str, Any]) -> str:
    db = c.get("database", "postgresql")
    depends = "    depends_on:\n      - db\n" if db else ""
    vol_names = {"postgresql": "pgdata", "mongodb": "mongodata", "mysql": "mysqldata"}
    volumes = f"\nvolumes:\n  {vol_names[db]}:\n" if db in vol_names else ""
    # No top-level `version:` key — obsolete in Compose v2+.
    return (
        "services:\n  app:\n    build: .\n    ports:\n      - \"3000:3000\"\n"
        "    env_file:\n      - .env\n    volumes:\n      - .:/app\n"
        f"{depends}\n{_db_service(db)}{_redis_service(c)}{volumes}"
    )


def generate_dockerfile(c: Dict[str, Any]) -> str:
    if c.get("stack") == "fastapi":
        return ("FROM python:3.11-slim\nWORKDIR /app\nCOPY requirements.txt .\n"
                "RUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\n"
                "EXPOSE 3000\nCMD [\"uvicorn\", \"app.main:app\", \"--host\", \"0.0.0.0\", \"--port\", \"3000\"]\n")
    return ("FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\n"
            "COPY . .\nRUN npm run build\nEXPOSE 3000\nCMD [\"npm\", \"start\"]\n")


def generate_gitignore() -> str:
    return ("node_modules/\n.env\n.env.local\ndist/\nbuild/\n.next/\n*.log\n"
            ".DS_Store\ncoverage/\n__pycache__/\n*.pyc\n.pytest_cache/\n.venv/\n")


def scaffold(c: Dict[str, Any], out_dir: str, dry_run: bool) -> Dict[str, Any]:
    stack = c.get("stack", "nextjs")
    tpl = STACK_TEMPLATES.get(stack, STACK_TEMPLATES["nextjs"])
    created = []

    for d in tpl["dirs"]:
        if not dry_run:
            os.makedirs(os.path.join(out_dir, d), exist_ok=True)
        created.append({"path": d + "/", "type": "directory"})

    files: Dict[str, str] = {}
    manifest_name, manifest_fn = tpl["manifest"]
    files[manifest_name] = manifest_fn(c)
    for name, fn in tpl["extra"].items():
        files[name] = fn(c)
    files.update(tpl["files"])
    files["README.md"] = generate_readme(c)
    files[".env.example"] = generate_env_example(c)
    files[".gitignore"] = generate_gitignore()
    files["docker-compose.yml"] = generate_docker_compose(c)
    files["Dockerfile"] = generate_dockerfile(c)

    for path, content in files.items():
        if not dry_run:
            full = os.path.join(out_dir, path)
            os.makedirs(os.path.dirname(full) or ".", exist_ok=True)
            with open(full, "w", encoding="utf-8") as fh:
                fh.write(content)
        created.append({"path": path, "type": "file", "size": len(content)})

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "project_name": c.get("name", "my-project"),
        "stack": stack,
        "output_dir": out_dir,
        "files_created": created,
        "total_files": sum(1 for f in created if f["type"] == "file"),
        "total_dirs": sum(1 for f in created if f["type"] == "directory"),
        "dry_run": dry_run,
    }


def main() -> None:
    p = argparse.ArgumentParser(description="Bootstrap a SaaS project from a config.")
    p.add_argument("input", help="path to the project config JSON")
    p.add_argument("--output-dir", default="./my-project")
    p.add_argument("--format", choices=["json", "text"], default="text")
    p.add_argument("--dry-run", action="store_true", help="preview without writing files")
    args = p.parse_args()

    with open(args.input, encoding="utf-8") as fh:
        config = json.load(fh)

    result = scaffold(config, args.output_dir, args.dry_run)
    if args.format == "json":
        print(json.dumps(result, indent=2))
        return
    print(f"Project '{result['project_name']}' scaffolded at {result['output_dir']}")
    print(f"Stack: {result['stack']}")
    print(f"Created: {result['total_files']} files, {result['total_dirs']} directories")
    if result["dry_run"]:
        print("\n[DRY RUN] no files written. Would create:")
    print("\nFiles:")
    for f in result["files_created"]:
        prefix = "dir " if f["type"] == "directory" else "file"
        size = f" ({f.get('size', 0)} bytes)" if f.get("size") else ""
        print(f"  [{prefix}] {f['path']}{size}")


if __name__ == "__main__":
    main()
