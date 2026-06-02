# Language / Framework / DB skill packs — manifest trigger map

This index maps each CHILD skill pack under `templates/skills/lang/` to the
`project.manifest.yaml` value (enumerated in `templates/interview/questions.yaml`)
that should cause `/ack-init` (P4) to render it into a fork. A pack is rendered
when its trigger condition holds against the child's manifest.

The match is **deterministic**: same manifest in → same pack set out. P4 wiring
reads this table; do not hand-edit a rendered fork's pack set.

## Trigger table

| Pack | Renders when (manifest condition) | Manifest enum source |
|---|---|---|
| `python-patterns/`   | `project.language == python`     | `language` (q) |
| `python-testing/`    | `project.language == python`     | `language` (q) |
| `typescript-patterns/` | `project.language == typescript` | `language` (q) |
| `go-patterns/`       | `project.language == go`         | `language` (q) |
| `rust-patterns/`     | `project.language == rust`       | `language` (q) |
| `node-api-patterns/` | `project.framework in [express, nestjs]` | `framework_backend` (q) |
| `react-patterns/`    | `project.framework in [next, remix]` (React-based fullstack UIs) | `framework_fullstack` (q) |
| `postgres-patterns/` | `persistence.db == postgres`     | `persistence_db` (q) |
| `prisma-patterns/`   | `persistence.orm == prisma`      | `persistence_orm` (q) |
| `docker-patterns/`   | always-eligible (containerization); recommended for `backend-api` / `fullstack`. Render when the child opts into containers (no dedicated manifest key yet — see gaps). | — |

## Notes for P4 wiring

- **Language packs** key off the universal `project.language` select (values:
  `python` | `typescript` | `go` | `rust` | `java`). One language pack pair
  (patterns + testing) is expected per language; this group ships the
  enum-aligned `python`, `typescript`, `go`, `rust` patterns and
  `python-testing`. See gaps for the rest.
- **`react-patterns`** is a *fullstack-UI* pack. The fullstack framework enum
  (`next`, `remix`, `sveltekit`, `nuxt`) does not name React directly; `next` and
  `remix` are React-based, so render `react-patterns` for those two. `sveltekit`
  and `nuxt` are NOT React — do not render it for them.
- **`node-api-patterns`** covers BOTH Node backend enum values (`express`,
  `nestjs`) in one pack rather than two near-duplicate packs.
- **`postgres-patterns` / `prisma-patterns`** are gated on the persistence
  questions, which only fire for `backend-api` / `fullstack` archetypes with
  `persistence.enabled == true`. For minimal-core archetypes these packs are
  never rendered (deterministic, by construction).

## Enum gaps surfaced by this group (for P4 / later groups)

These manifest enum values have NO pack in THIS group's minimum scope. They are
either covered by other groups in the port plan or need an author-new pack:

- `project.language == java` → no java pattern/testing pack in G4. (Port plan
  routes `java-coding-standards` via the broader lang set; not in G4 minimum.)
- `project.framework == fastapi` (Python backend) → covered by the port plan's
  `fastapi-patterns` (copy from ecc), outside G4's minimum list.
- `project.framework == gin` (Go backend) → port plan `gin-patterns` (author-new),
  outside G4 minimum.
- `project.framework == axum` (Rust backend) → port plan `axum-patterns`
  (author-new), outside G4 minimum.
- `project.framework in [sveltekit, nuxt]` (fullstack) → port plan
  `sveltekit-patterns` / `nuxt4-patterns`, outside G4 minimum. `react-patterns`
  must NOT be rendered for these.
- `persistence.db in [mysql, sqlite, mongodb]` → port plan `mysql-patterns`,
  `sqlite-patterns` (author-new), `mongodb-patterns` (author-new); not in G4.
- `persistence.orm in [sqlalchemy, drizzle, gorm]` → port plan
  `sqlalchemy-patterns` (author-new), `drizzle-patterns` (author-new),
  `gorm-patterns` (author-new); not in G4.
- **Containerization has no manifest key.** `docker-patterns` has no enum to gate
  on — `questions.yaml` does not ask whether the child uses Docker. P4 should
  either always render it for `backend-api`/`fullstack`, or a new
  `project.containerized` bool should be added to the interview. Flagged for the
  schema/interview owners.
