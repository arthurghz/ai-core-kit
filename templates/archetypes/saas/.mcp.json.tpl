{
  "//": "ack:managed-keys json:mcpServers (O5). Within mcpServers ack owns ONLY ack-prefixed (ack-*) server entries; user-added servers are never touched. The whole file is rendered only when features.mcp=true (render.map.yaml). The shadcn entry is additionally gated on design_system.install (the saas design-system payload, reused from fullstack) via #ack:if. The Supabase entry is gated on persistence.enabled. See _when.design_system.install/design-system/mcp/README.md for the shadcn wiring contract. Project MCP servers require re-approval on first use.",
  "mcpServers": {
    "ack-example": {
      "//": "TODO(P4): DEEP MCP server wiring deferred to P4. Stub keeps the .mcp.json conditional real for the branch-matrix test.",
      "command": "python3",
      "args": ["${CLAUDE_PROJECT_DIR}/.claude/mcp/ack-example-server.py"]
    }
    #ack:if design_system.install
    ,
    "shadcn": {
      "//": "SaaS design-system payload. Emitted by /ack-init ONLY when features.mcp AND design_system.install. Lets the agent browse/search/install shadcn/ui components (and configured registries) from components.json. Canonical fragment: _when.design_system.install/design-system/mcp/shadcn.mcp.json.",
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
    #ack:endif
    #ack:if persistence.enabled
    ,
    "ack-supabase": {
      "//": "Supabase MCP. Emitted only when features.mcp AND persistence.enabled. Lets the agent inspect the project's Supabase Postgres schema, run read-only queries, and manage migrations. Set SUPABASE_ACCESS_TOKEN in the environment before use; project MCP servers require approval on first use.",
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest", "--read-only"]
    }
    #ack:endif
  }
}
