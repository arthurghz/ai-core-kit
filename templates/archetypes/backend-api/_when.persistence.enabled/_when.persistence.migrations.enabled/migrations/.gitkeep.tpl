# ${project.name} — migrations (tool: ${persistence.migrations.tool})
# Nested path-segment guards AND together (O6): rendered only when
# persistence.enabled AND persistence.migrations.enabled are both truthy.
# Output path after segment-strip: migrations/.gitkeep  (== persistence.migrations.dir).
# Usually exempt from the contract gate.
# TODO(P4): DEEP migration scaffold (${persistence.migrations.tool} init) deferred to P4.
