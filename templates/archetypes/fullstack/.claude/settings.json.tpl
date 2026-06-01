{
  "//": "ack:managed-keys json:hooks,env -- renderer owns ONLY these keys (O5). permissions and all other top-level keys are HUMAN-OWNED, never touched. ${CLAUDE_PROJECT_DIR} is preserved (uppercase, not matched by the lowercase ${var} regex).",

  "//hooks": "Owned only when features.sdd_gate=true; renderer deletes only the matcher entry it wrote when sdd_gate=false.",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PROJECT_DIR}/.claude/hooks/contract-gate"
          }
        ]
      }
    ]
  },

  "//env": "Owned only when features.agent_teams=true; within env ack owns ONLY CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS (nested-key ownership). Other env keys are user territory.",
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
