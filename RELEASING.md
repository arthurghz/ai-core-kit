# Releasing `@arthurghz/create-ack`

The kit ships to the **official npm registry** as the scoped package
**`@arthurghz/create-ack`** (the `create-ack` bin matches the unscoped name, so
`npx @arthurghz/create-ack <name> --archetype <x>` runs the scaffolder directly).

Publishing is automated by **GitHub Actions** — you never `npm publish` from your
laptop. Pushing a version tag (`v*`) triggers
[`.github/workflows/publish.yml`](.github/workflows/publish.yml), which runs the
test suite, validates the tarball, guards that the tag matches `package.json`
version, and publishes with [npm provenance](https://docs.npmjs.com/generating-provenance-statements)
(attested via OIDC — the repo is public).

## One-time setup

1. **Own the scope.** `@arthurghz` must be your npm account (free) or an org you
   own. Log in once at [npmjs.com](https://www.npmjs.com/) with username `arthurghz`
   (or change the `name` in `package.json` + the badges to your scope).
2. **Create an automation token.** npmjs.com → *Access Tokens* → *Generate New
   Token* → **Automation** (bypasses 2FA in CI). Copy it.
3. **Add it to the repo.** GitHub → repo *Settings* → *Secrets and variables* →
   *Actions* → *New repository secret*: name **`NPM_TOKEN`**, value = the token.

## Cut a release

```bash
# 1. bump the version (this also creates the v<version> tag)
npm version patch        # or: minor | major   → e.g. 0.1.0 -> 0.1.1

# 2. push the commit and the tag
git push origin main --follow-tags
```

The tag push fires the **Publish to npm** workflow. Watch it in the repo's
*Actions* tab; on success the new version is live:

```bash
npx @arthurghz/create-ack my-product --archetype fullstack
```

## Dry run (no publish)

Actions → *Publish to npm* → *Run workflow* → check **dry_run** to pack + validate
the tarball (tests + `npm pack --dry-run`) without publishing.

## Notes

- `npm version` keeps the tag and `package.json` in lockstep; the workflow's guard
  fails the run if they ever drift.
- `files` in `package.json` (`bin`, `lib`, `scripts`, `templates`) is what ships —
  the docs site, `.claude/`, `telemetry/`, and tests are intentionally excluded.
- First publish of a brand-new scoped package goes out as **public**
  (`publishConfig.access: public` + `--access public`).
