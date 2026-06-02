{
  "//": "ack:managed-keys json:mcpServers (O5). Within mcpServers ack owns ONLY ack-prefixed (ack-*) server entries; user-added servers are never touched. Included only when features.mcp=true (render.map.yaml). The shadcn entry below is additionally gated on design_system.install (fullstack design-system payload) via the #ack:if directive — see _when.design_system.install/design-system/mcp/README.md.",
  "mcpServers": {
    "ack-example": {
      "//": "TODO(P4): DEEP MCP server wiring deferred to P4. Stub keeps the .mcp.json conditional real for the branch-matrix test.",
      "command": "python3",
      "args": ["${CLAUDE_PROJECT_DIR}/.claude/mcp/ack-example-server.py"]
    }
    #ack:if design_system.install
    ,
    "shadcn": {
      "//": "Fullstack design-system payload. Emitted by /ack-init ONLY when features.mcp AND design_system.install. Lets the agent browse/search/install shadcn/ui components (and configured registries) from components.json. Canonical fragment: _when.design_system.install/design-system/mcp/shadcn.mcp.json. Project MCP servers require re-approval on first use.",
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
    #ack:endif
  }
}
