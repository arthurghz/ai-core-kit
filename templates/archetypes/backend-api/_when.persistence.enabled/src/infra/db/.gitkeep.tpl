# ${project.name} — persistence layer (db: ${persistence.db}, orm: ${persistence.orm})
# Path-segment guard: _when.persistence.enabled/ => rendered only when
# persistence.enabled is truthy (segment stripped from output path => src/infra/db/).
# TODO(P4): DEEP persistence scaffold (models, session, ${persistence.orm} wiring)
# deferred to P4.
