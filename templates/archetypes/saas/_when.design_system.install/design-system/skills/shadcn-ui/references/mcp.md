# MCP — the shadcn server, wiring, and composing with features.mcp

The **shadcn MCP server** lets an agent (Claude Code) browse, search, and install
shadcn/ui components directly — across the default registry and any private
registries declared in `components.json` — instead of you hand-running the CLI.

## What the shadcn MCP does

Through the MCP, an agent can:

- **browse / search** available components in the configured registries;
- **install** a component (the equivalent of `npx shadcn add <name>`), writing it
  into `aliases.ui`;
- resolve components from **private registries** declared under
  `components.json` → `registries` (e.g. `@acme`), so an internal design system is
  reachable the same way as the public one.

It is the agent-facing front end to the same operations documented in
`references/cli.md` and `references/components.md`.

## How it is wired (Claude Code)

Set it up once:

```bash
npx shadcn@latest mcp init --client claude
```

This writes the server entry into the project's `.mcp.json`. The canonical entry —
also shipped in this `design-system` subtree as **`../mcp/shadcn.mcp.json`** — is:

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

The server is launched on demand via `npx`, so there is nothing to install
globally. Other clients use a different file/key (see the table in
`references/cli.md`): Cursor `.cursor/mcp.json`, VS Code `.vscode/mcp.json` (key
`servers`), Codex `~/.codex/config.toml`.

### In this project's archetype

The fullstack archetype's root `.mcp.json` carries the `shadcn` server entry
alongside the project's other MCP servers. The `design-system` subtree also keeps
the standalone `../mcp/shadcn.mcp.json` as the reference entry for that one server.
Both are present **only when the project has MCP enabled** — the root `.mcp.json`
is rendered only when `features.mcp == true` (the kit's render rules), and the
`design-system` subtree only when `design_system.install == true`. The server is
launched purely via `npx`, so the entry contains no project paths.

## Composing with `features.mcp`

`features.mcp` is **this project's own** MCP server (the project-specific tools it
exposes). The shadcn MCP is **separate**:

- They are independent entries under `mcpServers` — e.g. the project's own server
  plus a `shadcn` entry. Enabling shadcn does not replace, disable, or proxy the
  project server, and vice versa.
- An agent can use both in one session: the project server for the project's
  domain tools, the shadcn server for component browse/install.
- Keep the server keys distinct. The kit's render layer owns its own
  ack-prefixed server entry under `mcpServers` and never touches a user- or
  design-system-added entry like `shadcn`, so the two coexist safely on re-render.

## When to enable it

Enable the shadcn MCP when you want agent-driven component work — "find a date
picker and add it", "install the table and a pagination component", "pull the
data-table from our `@acme` registry". For one-off manual additions, the CLI
(`references/cli.md`) is enough; the MCP is the leverage when the agent should
drive the registry directly.

## See also

- `references/cli.md` — the underlying `init`/`add`/`build`/`mcp` commands.
- `references/components.md` — what gets written and how to compose it.
- `../mcp/shadcn.mcp.json` — the shipped server entry for this subtree.
