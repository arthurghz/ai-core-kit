# shadcn/ui MCP wiring

This directory wires the **shadcn/ui MCP server** into a fullstack child project
so a Claude Code agent can browse, search, and install shadcn/ui components
(and components from configured registries) directly from the project's
`components.json`.

This is a **static** file (no `.tpl` suffix): the renderer copies it
byte-for-byte and never substitution-scans it, so literal `${...}` and shell
examples below survive verbatim.

## Files in this directory

- `shadcn.mcp.json` — the canonical, copy-pasteable server fragment. Exactly:

  ```json
  {
    "mcpServers": {
      "shadcn": {
        "command": "npx",
        "args": ["shadcn@latest", "mcp"]
      }
    }
  }
  ```

- `README.md` — this wiring doc.

## How the server reaches the child `.mcp.json`

The server entry is rendered by `/ack-init` into this project's root-level
`.mcp.json` (the kit owns the source template; the child only ever sees the
rendered `.mcp.json`). It is **double-gated**:

1. **`features.mcp`** — the whole `.mcp.json` is only rendered when the
   child opted into a project MCP config (kit render rule keyed on
   `features.mcp`). If `features.mcp` is false, there is no `.mcp.json` at all
   and the shadcn entry never appears.
2. **`design_system.install`** — within that rendered file the `shadcn` server
   block is wrapped in the renderer's line directive
   `#ack:if design_system.install` … `#ack:endif`. `/ack-init` emits the
   `shadcn` entry **only when `design_system.install == true`**. When it is
   false (or absent, e.g. backend-api), the block is omitted and the remaining
   JSON is still valid.

So the effective predicate is **`features.mcp && design_system.install`**,
matching this whole `design-system/` subtree, which is itself path-segment-gated
on `design_system.install` by the kit renderer (the gating lives in the kit's
render engine and render map, not in this child).

### Managed-key ownership (so re-runs are safe)

`.mcp.json` is owned by `/ack-init` at `managed_block: "json:mcpServers"`, and
**within** `mcpServers` ack owns only the entries it renders. The shadcn entry
is keyed `"shadcn"` because that is the name the shadcn tooling expects; treat it
as ack-managed for this archetype. User-added servers under other keys are never
touched. On re-run, `/ack-init` re-merges via a JSON-aware key merge (not line
concatenation), so comma hygiene is handled by the merge — never hand-edit the
managed block.

## One-time bootstrap in the child (optional convenience)

The rendered `.mcp.json` is sufficient on its own. If you prefer to let the
shadcn CLI write/refresh the entry, run from the child project root:

```bash
npx shadcn@latest mcp init --client claude
```

This writes the same `mcpServers.shadcn` entry into the project `.mcp.json`.
Other supported clients (for reference): Cursor (`.cursor/mcp.json`), VS Code
(`.vscode/mcp.json`, key `servers`), Codex (`~/.codex/config.toml`). This kit
targets **Claude Code** (`.mcp.json`).

A `components.json` must exist for the shadcn CLI/MCP to resolve aliases and
registries — create it with `npx shadcn@latest init` if you have not already.

## Project MCP servers require approval

`.mcp.json` is a **project-scoped** MCP config. Claude Code does **not** trust
project servers automatically: on first use the user is prompted to **approve**
the `shadcn` server (and any change to its command/args re-prompts). This is a
security boundary — a checked-in `.mcp.json` cannot silently run a command on a
teammate's machine. Approve only after reviewing the entry.

### Per-server timeout

The shadcn MCP shells out to `npx`, which may need to download the `shadcn`
package on first invocation. If the server is slow to start, raise the
MCP startup timeout via the `MCP_TIMEOUT` environment variable (milliseconds),
e.g. `MCP_TIMEOUT=30000`, before launching Claude Code. Pre-warming with
`npx shadcn@latest mcp --help` once avoids cold-start delays.

## What the shadcn MCP can do

Once approved, the agent can:

- **Browse and search** the shadcn/ui component registry (and any registries
  declared in `components.json`).
- **Install components** into the project — they are copied into your
  `aliases.ui` directory (default `@/components/ui`). Components are **copied
  into the project, not added as an npm dependency**: you own and can edit the
  resulting source.
- **Read component metadata** (dependencies, files, docs) before installing.

CLI equivalents the MCP drives: `npx shadcn@latest add [component]`
(`-a` all, `-o` overwrite, `-p` path, `--dry-run`), `npx shadcn@latest init`,
`npx shadcn@latest build`.

### Registries (including private)

`components.json` may declare additional registries under the `registries` key,
mapping a namespace to a URL template. Example:

```json
{
  "registries": {
    "@acme": "https://registry.acme.com/{name}.json"
  }
}
```

The MCP can then browse and install from `@acme` alongside the default
shadcn/ui registry. For **private** registries, the URL may require auth
(e.g. a token in the URL or headers per the registry's docs); supply credentials
through the registry's documented mechanism — do not commit secrets to
`components.json`.

## License

shadcn/ui is **MIT** (`shadcn-ui/ui`); components are copied into the project,
so you own them. See the `NOTICE` file in the parent `design-system/` directory
for the full attribution. The MCP guidance here is independently authored for
ai-core-kit.
