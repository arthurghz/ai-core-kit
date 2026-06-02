# Build artifacts + deps — never ship these into the image build context.
__pycache__/
*.py[cod]
.venv
.mypy_cache
.pytest_cache
dist
build
*.egg-info

# Node (if any tooling lives alongside the API)
node_modules

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
