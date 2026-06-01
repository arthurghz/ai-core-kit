{
  "//": "ack:managed-keys json:mcpServers (O5). Within mcpServers ack owns ONLY ack-prefixed (ack-*) server entries; user-added servers are never touched. Included only when features.mcp=true (render.map.yaml).",
  "mcpServers": {
    "ack-example": {
      "//": "TODO(P4): DEEP MCP server wiring deferred to P4. Stub keeps the .mcp.json conditional real for the branch-matrix test.",
      "command": "python3",
      "args": ["${CLAUDE_PROJECT_DIR}/.claude/mcp/ack-example-server.py"]
    }
  }
}
