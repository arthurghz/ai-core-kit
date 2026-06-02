# Build artifacts + deps — never ship these into the image build context.
node_modules
.pnpm-store
.next
out
dist
build

# Python (if any tooling lives alongside the web app)
__pycache__/
*.py[cod]
.venv

# Secrets + local env (injected at runtime via env_file / --env-file, not baked in)
.env
.env.*
!.env.example

# VCS, kit tooling, docs/specs, local noise — not needed inside the image
.git
.gitignore
.DS_Store
*.log
coverage
.claude
specs
docs
