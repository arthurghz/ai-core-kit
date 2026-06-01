# RENDER-ENGINE.md — the `/ack-init` rendering contract

> **Status:** FROZEN (Phase-3 gate artifact, companion to
> `templates/manifest/project.manifest.schema.yaml` and
> `templates/interview/questions.yaml`).
> **Layer:** this contract governs the **CHILD-payload renderer (P4)**. The renderer
> turns the FROZEN `project.manifest.yaml` + the `templates/archetypes/<archetype>/`
> tree into a working child project.
> **Audience:** the P4 renderer team (producer of rendered files), and anyone reading
> the manifest schema's `# PRODUCER: /ack-init` / `# CONSUMERS: P4` annotations.

---

## 0. The decision: ONE engine, and it is not copier or cookiecutter

**Engine: a tiny in-house `${VAR}` substitution renderer + a manifest-driven
conditional/idempotency layer.** This mirrors cc-sdd's proven architecture
(`/tmp/ack-refs/cc-sdd/tools/cc-sdd/src/template/renderer.ts`, ~10 LOC, **zero runtime
npm dependencies**) and is the explicit recommendation of the render survey.

**Why not copier / cookiecutter:** both impose a hard Python-runtime + dependency
precondition (jinja2, pydantic/click, pyyaml, …) on *every* child fork. `ai-core-kit`
ships into JS/Claude-Code projects via `npx`/fork; a Python toolchain precondition
kills the no-Python distribution story. The one thing copier gives for free —
`copier update` re-render against a versioned answers file — we **do not need**,
because our idempotency is **structural** (managed/user split + an ownership ledger),
not a 3-way merge engine (manifest invariant **I2**).

The three responsibilities are kept **strictly separate** (this is the whole design):

| Layer | Responsibility | Where the logic lives | Survey echo |
|---|---|---|---|
| **1. Substitution** | replace `${VAR}` from the manifest | the renderer regex (§2) | cc-sdd `renderer.ts` |
| **2. Conditional inclusion** | decide *which* files render | the manifest itself + `.when` rules (§4) — **never** in-template `{% if %}` | cc-sdd `when:{}` manifest guards |
| **3. Idempotency** | never clobber hand edits on re-run | managed/user split + `rendered_files[]` ledger + managed blocks (§5) | cc-sdd conflict-policy executor (we replace it with a structural ledger) |

Conditionals are **out of templates by construction**: a template file is either
included or not, decided by the manifest. There are no loops/filters/inheritance in a
template, so the engine stays a pure string substitution and is trivially auditable.

---

## 1. Inputs, outputs, and the one writer

```
            FROZEN, validated                  templates/archetypes/<archetype>/
        project.manifest.yaml  ──────┐         (the *.tpl.* template tree)
        (managed: + user:)           │                     │
                                     ▼                     ▼
                          ┌───────────────────────────────────────┐
                          │   P4 RENDERER  (this contract)         │
                          │   §2 substitute · §4 select · §5 merge │
                          └───────────────────────────────────────┘
                                     │
                                     ▼
        child working tree  +  managed.rendered_files[] (ownership ledger, written back)
```

- **The renderer never writes the manifest.** `/ack-init`'s interview is the *only*
  writer of `managed:`/`user:` (manifest header: `PRODUCER: /ack-init INTERVIEW (the
  ONLY writer)`). The renderer is a pure **consumer** of `managed:` and a **producer**
  of child files + the `managed.rendered_files[]` ledger.
- **Precondition:** the renderer runs only *after* `/ack-init` has validated the
  manifest against `project.manifest.schema.json`. An invalid manifest aborts before
  any render (invariant **I6**: author-time fail-closed). The renderer may assume a
  schema-valid `managed:` subtree.
- **Determinism:** identical `managed:` + identical templates ⇒ identical bytes
  (invariant **I2**). The renderer emits no timestamps of its own into child files;
  the only clock value, `generator.rendered_at`, lives in the manifest and is outside
  `manifest_hash`.

---

## 2. Substitution: how `${VAR}` is filled FROM the manifest

### 2.1 Syntax

- Placeholder form: **`${dotted.path}`** referencing a key under `managed:`.
  Example: `${project.name}`, `${persistence.db}`, `${contract_gate.mode}`.
- Template files carry a **`.tpl.<ext>`** suffix (cc-sdd convention). The renderer
  strips `.tpl` on output: `CLAUDE.md.tpl` → `CLAUDE.md`, `settings.json.tpl` →
  `.claude/settings.json`. A file **without** `.tpl` is copied byte-for-byte (static
  asset, no substitution scan — so literal `${...}` in shipped scripts survives).
- The match is anchored to `managed:`. A leading `user.` segment is the only way to
  reach the human subtree, and the renderer reads it **read-only** and **only** when an
  explicit `user.overrides.*` key is requested (the manifest permits `user.overrides`
  to feed render vars; it is never required).

### 2.2 Resolution rule (the ~12-line core)

```python
# render(text, managed, user) -> text   (pseudocode; the real impl is Python3, pinned)
VAR = re.compile(r"\$\{([a-z0-9_]+(?:\.[a-z0-9_]+)*)\}")

def render(text, managed, user):
    def sub(m):
        path = m.group(1)
        root = user if path.startswith("user.") else {"managed": managed, **flatten(managed)}
        val = lookup(path, managed, user)          # dotted-path walk
        if val is MISSING:
            raise RenderError(f"unbound ${{{path}}} (not in managed:)")   # FAIL-CLOSED
        if isinstance(val, (dict, list)):
            raise RenderError(f"${{{path}}} resolves to a container, not a scalar")
        return scalar_to_str(val)                  # bool->"true"/"false", num as-is
    return VAR.sub(sub, text)
```

Rules that matter:

- **Unbound variable is a hard error**, never a silent empty string. This is the
  render-time mirror of schema invariant **I5** (`additionalProperties:false`): a typo
  in a template fails the render rather than emitting `${typo.key}` or `""`.
- **Scalars only.** A `${...}` must resolve to a string/number/bool. To inject a *list*
  (e.g. `protected_paths`), the template uses a **render directive** (§3), not a raw
  `${...}`.
- **Boolean rendering** is canonical: `true`/`false` lower-case (so a rendered
  `settings.json` boolean is valid JSON; see §6 JSON note).
- **No re-scan.** Substituted output is **not** re-scanned for further `${...}`
  (matches cc-sdd's "output is not re-scanned"), preventing manifest data from being
  interpreted as a placeholder.

### 2.3 JSON-safe variant

For `*.json.tpl` files the renderer uses `render_json`: substitute first, then
`json.loads` the result and `json.dumps` with sorted keys + 2-space indent. This (a)
guarantees the emitted JSON is valid and (b) makes byte-output deterministic
regardless of manifest key order. (cc-sdd ships the same `renderJsonTemplate` split.)
String values are JSON-escaped on insertion; numbers/bools are inserted bare.

---

## 3. Render directives (the only non-scalar construct)

Lists and "include this block iff a flag is set" are common enough that two **explicit,
line-oriented directives** exist. They are *not* a templating language — each is a
single self-contained line the renderer recognizes, keeping logic auditable and
out-of-template-control-flow (per the survey's "keep conditionals OUT of templates").

| Directive | Expands to | Source |
|---|---|---|
| `#ack:each <list.path> as "<fmt-with-$item>"` | one rendered line per list element, `$item` = element | a manifest list (e.g. `contract_gate.protected_paths`) |
| `#ack:if <bool.path>` … `#ack:endif` | the enclosed lines, only if the bool is truthy | a manifest bool (e.g. `features.mcp`) |

`#ack:if` is a **convenience within an already-included file** — it does *not* replace
file-level conditional inclusion (§4), which remains the primary mechanism. Anything
beyond these two (loops with filters, nesting depth >1) is a signal the logic belongs
in §4's manifest selection, not in a template.

---

## 4. Directory rendering from `templates/archetypes/<archetype>/`

### 4.1 Walk

1. `arch = managed.archetype` (the BRANCH AXIS, invariant **I3**).
2. Root the walk at `templates/archetypes/<arch>/`. v1 ships `backend-api` and
   `fullstack` **deep**; `monorepo | library-sdk | infra-iac` render a **minimal core**
   (same engine, smaller tree).
3. For each file in the tree, compute the child-relative output path by stripping the
   `templates/archetypes/<arch>/` prefix and the `.tpl` suffix:
   `templates/archetypes/backend-api/CLAUDE.md.tpl` → `<child>/CLAUDE.md`.
4. **Only files under `templates/` are ever rendered** (invariant **I7**, finding 14):
   the renderer must never copy the META repo's own `.claude/` tree, so meta-only
   agents/engines (Research, Discovery, telemetry-MCP, orchestrator) can never leak
   into a child.

### 4.2 Conditional files — decided by the manifest, never by template magic

A template file is included iff its **`.when` predicate** over `managed:` is truthy.
`.when` is expressed two ways, in precedence order:

1. **Path-encoded conditions** — a directory segment of the form `_when.<bool.path>/`.
   The renderer drops that segment from the output path and includes the subtree only
   if the bool is truthy. Example:
   `templates/archetypes/fullstack/_when.design_system.install/design-system/...`
   renders only when `design_system.install == true`.
2. **A sidecar `render.map.yaml`** at each archetype root, declaring per-glob guards for
   anything not naturally expressed as a path segment. Shape:

```yaml
# templates/archetypes/<arch>/render.map.yaml   (read-only, ships with the archetype)
version: 1
rules:
  - glob: "**/.mcp.json.tpl"
    when: features.mcp                       # bool path under managed:
  - glob: "**/hooks/contract-gate"
    when: features.sdd_gate                  # master switch; false => omit gate entirely
  - glob: "design-system/**"
    when: design_system.install              # only resolvable for fullstack
    requires_archetype: fullstack            # extra guard; see §4.3
```

The renderer evaluates `when` with the same dotted-path lookup as §2; a path that does
not exist in `managed:` (e.g. `design_system.*` under a backend-api manifest) evaluates
**false**, so the file is omitted. This is how *design-system renders only for
fullstack* falls out for free: the schema forbids `design_system` under `backend-api`
(per-archetype rule), so the lookup is absent ⇒ false ⇒ omitted. No special-casing.

### 4.3 The design-system example (the canonical conditional)

- **fullstack:** schema **requires** `design_system`; with `install: true` the renderer
  copies `templates/archetypes/fullstack/design-system/` (which contains **only
  Apache-2.0 example skills WITH NOTICE** — never docx/pdf/pptx/xlsx-derived
  source-available content; manifest findings 21/45). `tokens` (e.g. `color-brand`)
  flow in as `${design_system.tokens.color-brand}`.
- **backend-api:** schema **forbids** `design_system`; the key is absent; every
  `design-system/**` `when` evaluates false; the entire subtree is omitted. The
  `requires_archetype` guard in `render.map.yaml` is a belt-and-suspenders assertion
  that fails the render loudly if a fullstack-only template is ever reached under a
  non-fullstack archetype (catches an authoring mistake, not a user one).

### 4.4 Per-archetype gate defaults are resolved by `/ack-init`, not the renderer

`contract_gate.{protected_paths,scope,exempt}` are PER-ARCHETYPE BY CONSTRUCTION
(invariant **I4**), but they are already concrete data in `managed:` by the time the
renderer runs — `/ack-init` wrote archetype-appropriate defaults during the interview.
The renderer simply `#ack:each`-expands `contract_gate.protected_paths` into the gate
config; it never carries its own archetype defaults. The schema guarantees
`protected_paths` is non-empty (minItems 1), so the gate can never render vacuous.

---

## 5. Idempotent re-render: managed blocks, ownership ledger, never clobber

Idempotency is **structural** (invariant **I2**); there is no 3-way merge engine.
Three mechanisms cooperate (findings 2, 41, 43):

### 5.1 The ownership ledger (`managed.rendered_files[]`)

After a successful render, the renderer writes back the list of paths it owns:

```yaml
rendered_files:
  - path: .claude/settings.json
    managed_block: "ack:managed"     # renderer owns only a delimited region
  - path: CLAUDE.md
    managed_block: "ack:managed"
  - path: .claude/hooks/contract-gate
    managed_block: null              # whole file is ack-owned
```

On **re-run**, this ledger is authoritative about what `ack` owns. **Anything not in
`rendered_files[]` is user territory and is never touched** (prevents the second-run
blind-overwrite of finding 2/41). A path that *was* rendered but whose `when` is now
false is **left in place** and flagged in the run report — the renderer deletes
nothing it cannot prove it solely owns.

### 5.2 Managed blocks (`managed_block != null`) — never clobber a foreign file

For files the renderer shares with the human (`settings.json`, `CLAUDE.md`), it owns
**only** a delimited region and rewrites *only* that region:

```jsonc
// .claude/settings.json
{
  "permissions": { "allow": ["Bash(uv run *)"] },   // ← HUMAN-OWNED, never touched

  // >>> ack:managed (do not edit; regenerated by /ack-init) >>>
  "hooks": { "PreToolUse": [ { "matcher": "Edit|Write|MultiEdit|NotebookEdit",
      "hooks": [ { "type": "command",
        "command": "python3 ${CLAUDE_PROJECT_DIR}/.claude/hooks/contract-gate" } ] } ] }
  // <<< ack:managed <<<
}
```

```markdown
<!-- CLAUDE.md -->
This project's house style: prefer pytest fixtures.        <!-- HUMAN, untouched -->

<!-- >>> ack:managed (do not edit; regenerated by /ack-init) >>> -->
@.claude/conventions.md
@docs/contracts/
<!-- <<< ack:managed <<< -->
```

Re-render replaces the bytes **between** the markers; everything outside is preserved
verbatim. First run, if the target file exists without markers, the renderer *inserts*
the managed block (appending at end for `CLAUDE.md`; merging the managed JSON keys for
`settings.json`) and never reorders/strips human keys. JSON managed-block merge: the
renderer parses the file, replaces only the keys it declares as managed (`hooks`, and
for fullstack `.mcp.json`'s managed block), and re-serializes — a new MCP server is
added only if absent, with a re-approval warning (finding 41).

### 5.3 Whole-file ownership (`managed_block: null`)

Files the renderer fully owns (e.g. the `contract-gate` hook script) are overwritten
wholesale on re-run — they are not meant to be hand-edited. Off-ramp: removing the path
from `rendered_files[]` (or deleting the file) tells the renderer to stop managing it.

### 5.4 No-op fast path

`/ack-init` computes `manifest_hash` (sha256 of canonical `managed:` minus the hash
field). On re-run: if recomputed hash == stored **and** every `rendered_files[].path`
is unchanged on disk ⇒ "nothing to do", exit 0, zero writes (manifest §`manifest_hash`).

---

## 6. Path hygiene: rendered child paths never leak `templates/` or absolute ack paths

Invariant **I7** and findings 34/56 make this a hard render rule:

- **Every path the renderer writes INTO a child file** that points at a child artifact
  uses **`${CLAUDE_PROJECT_DIR}`** — the harness-exported project root (hooks doc:
  `CLAUDE_PROJECT_DIR` = "The project root"). Concretely the gate hook entry in
  `settings.json` is
  `"command": "python3 ${CLAUDE_PROJECT_DIR}/.claude/hooks/contract-gate"`, **never** an
  absolute path like `/Users/.../ai-core-kit/templates/hooks/contract-gate` and
  **never** a `templates/`-relative path.
- **The `${CLAUDE_PROJECT_DIR}` literal is preserved, not substituted.** It lives in a
  **static (non-`.tpl`) or §2.1-protected** position so the §2 regex (`\$\{[a-z0-9_.]+\}`,
  lower-case only) never matches the upper-case `CLAUDE_PROJECT_DIR`. The regex's
  lower-case character class is the mechanism that lets manifest `${...}` and shell
  `${CLAUDE_PROJECT_DIR}` coexist in the same file.
- **Output-path assertion (render-time, fail-closed):** before writing any child file
  the renderer asserts the file's *content* contains no substring matching
  `templates/archetypes/` nor any absolute path under the ack install dir. A violation
  aborts the render (this is the enforceable form of finding 34's "assert no
  `templates/` or absolute ack path in rendered child").
- The `source:` field in the manifest (e.g.
  `design_system.source: templates/archetypes/fullstack/design-system`) is an **input**
  the renderer reads to locate templates; it is **never emitted** into a child file.

---

## 7. Worked example — rendering a `backend-api` child

Manifest (the frozen `acme-orders-api` instance, abbreviated to the keys the render
touches):

```yaml
schema_version: 1
managed:
  project: { name: acme-orders-api, language: python, runtime: python3.12,
             package_manager: uv, framework: fastapi, architecture: layered }
  archetype: backend-api
  features: { hooks: true, mcp: false, agent_teams: false, sdd_gate: true }
  persistence: { enabled: true, db: postgres, orm: sqlalchemy,
                 migrations: { enabled: true, tool: alembic, dir: migrations/ } }
  contract_gate:
    mode: block
    protected_paths: ["src/**", "migrations/**", "openapi/**"]
    scope: ["src/**"]
    exempt: ["**/*.test.*", "migrations/**", "**/__snapshots__/**"]
```

### 7.1 Tree walk + conditional selection

Walking `templates/archetypes/backend-api/`, applying `render.map.yaml`:

| Template | `when` | Result | Output path |
|---|---|---|---|
| `CLAUDE.md.tpl` | (always) | render | `CLAUDE.md` |
| `.claude/settings.json.tpl` | (always) | render (managed block) | `.claude/settings.json` |
| `.claude/hooks/contract-gate` | `features.sdd_gate`=T | copy (static, whole-file) | `.claude/hooks/contract-gate` |
| `.mcp.json.tpl` | `features.mcp`=**F** | **omit** | — |
| `_when.persistence.enabled/db/...` | `persistence.enabled`=T | render | `db/...` |
| `design-system/**` | `design_system.install` absent ⇒ **F** | **omit** | — |
| `src/orders/__init__.py.tpl` | (always, backend core) | render | `src/orders/__init__.py` |

`.mcp.json` and the entire design-system tree drop out **with no template edits** —
purely because `features.mcp` is false and `design_system` is absent under backend-api.

### 7.2 Substitution — `CLAUDE.md.tpl` → `CLAUDE.md`

Template:
```markdown
# ${project.name}
${project.description}

- **Language/runtime:** ${project.language} (${project.runtime}), pkg: ${project.package_manager}
- **Framework / architecture:** ${project.framework} / ${project.architecture}

<!-- >>> ack:managed (do not edit; regenerated by /ack-init) >>> -->
Contract gate: **${contract_gate.mode}**. Protected:
#ack:each contract_gate.protected_paths as "- `$item`"
@docs/contracts/
<!-- <<< ack:managed <<< -->
```

Rendered:
```markdown
# acme-orders-api
Order intake and fulfillment API

- **Language/runtime:** python (python3.12), pkg: uv
- **Framework / architecture:** fastapi / layered

<!-- >>> ack:managed (do not edit; regenerated by /ack-init) >>> -->
Contract gate: **block**. Protected:
- `src/**`
- `migrations/**`
- `openapi/**`
@docs/contracts/
<!-- <<< ack:managed <<< -->
```

### 7.3 JSON render + path hygiene — `.claude/settings.json.tpl` → `.claude/settings.json`

Template (`render_json` path):
```jsonc
{
  // >>> ack:managed >>>
  "hooks": { "PreToolUse": [ {
    "matcher": "Edit|Write|MultiEdit|NotebookEdit",
    "hooks": [ { "type": "command",
      "command": "python3 ${CLAUDE_PROJECT_DIR}/.claude/hooks/contract-gate" } ] } ] }
  // <<< ack:managed <<<
}
```

Rendered (note: `${CLAUDE_PROJECT_DIR}` survives untouched — upper-case, not matched by
the lower-case manifest regex; no `templates/` or absolute path present, so the §6
output assertion passes):
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "command": "python3 ${CLAUDE_PROJECT_DIR}/.claude/hooks/contract-gate",
            "type": "command"
          }
        ],
        "matcher": "Edit|Write|MultiEdit|NotebookEdit"
      }
    ]
  }
}
```

### 7.4 Ledger written back

```yaml
managed:
  rendered_files:
    - { path: .claude/settings.json, managed_block: "ack:managed" }
    - { path: CLAUDE.md,             managed_block: "ack:managed" }
    - { path: .claude/hooks/contract-gate, managed_block: null }
```

### 7.5 Re-run behavior

- User adds `"permissions"` to `settings.json` and a house-style paragraph to
  `CLAUDE.md` (both **outside** the `ack:managed` markers).
- Second `/ack-init` with identical answers: `manifest_hash` matches, on-disk
  `rendered_files[]` unchanged ⇒ **no-op, exit 0**. User edits untouched.
- User then flips `features.mcp` → true and re-runs: hash changes ⇒ renderer adds
  `.mcp.json` (now `when` true), inserts/updates the `ack:managed` regions only, leaves
  the human `permissions` block and the house-style paragraph byte-identical, and
  appends `.mcp.json` to `rendered_files[]`.

---

## 8. Engine invariants (the testable contract)

1. **Pure substitution.** No loops/filters/inheritance in templates; `${...}` is
   scalar-only; unbound or container-valued `${...}` is a hard render error.
2. **Conditionals live in the manifest** (path-segment `_when.*` + `render.map.yaml`),
   never in template control flow. Absent manifest key ⇒ `when` false ⇒ file omitted.
3. **Render only FROM `templates/`.** The META `.claude/` tree is never copied
   (forkability, finding 14).
4. **Structural idempotency:** managed/user split, managed blocks for shared files,
   whole-file ownership only for `managed_block:null`, ledger-gated; never clobber a
   path absent from `rendered_files[]` or bytes outside a managed block (findings 2/41).
5. **Path hygiene:** child files reference child artifacts via `${CLAUDE_PROJECT_DIR}`;
   a rendered file containing `templates/archetypes/` or an absolute ack path aborts the
   render (findings 34/56, invariant I7).
6. **Determinism / no-op fast path:** identical `managed:` + templates ⇒ identical
   bytes; matching `manifest_hash` + unchanged ledger ⇒ zero writes.

### Acceptance tests (wire into P8)

- **T1 unbound-var:** a template with `${typo.key}` fails the render with the path
  named; zero files written.
- **T2 conditional:** backend-api manifest ⇒ no `.mcp.json`, no `design-system/**`;
  fullstack manifest ⇒ both present.
- **T3 two-run non-destructive:** human edits outside managed blocks survive a re-run;
  identical-answer re-run is a no-op (exit 0, zero writes).
- **T4 path-hygiene:** grep every rendered child file for `templates/` and the absolute
  ack path ⇒ zero matches; gate entry uses `${CLAUDE_PROJECT_DIR}`.
- **T5 meta-leak:** grep the child for meta-only markers (Research/Discovery agents,
  orchestrator, telemetry-MCP) ⇒ zero matches.
- **T6 JSON validity:** every rendered `*.json` parses; keys sorted, 2-space indent.
