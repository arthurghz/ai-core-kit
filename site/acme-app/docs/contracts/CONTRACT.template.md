# Contract template — acme-app

> **Hook reference:** this template seeds `docs/contracts/<id>.contract.md` files.
> The PreToolUse gate hook (`.claude/hooks/contract-gate`, mode **block**)
> treats a contract as the approved-oracle: an edit under a protected/scope path is
> allowed only when a contract whose `scope` covers it has `status: approved`.

## Identity
- **id:** `C-NNN-<slug>`  (pattern `^C-[0-9]{3}-[a-z0-9-]+$`)
- **status:** draft | proposed | approved | rejected
- **scope:** glob list this contract governs (dialect fnmatch)

## Surface
<!-- TODO(P4): DEEP contract body (web/api interface, invariants, acceptance,
     owners, approval workflow tied to contract_gate.require_approval_by) is
     deferred to P4. This skeleton gives the gate a real contract-file shape. -->

## Scope
- `app/**`
- `api/**`
