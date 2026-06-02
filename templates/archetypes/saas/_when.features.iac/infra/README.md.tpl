# Infrastructure — ${project.name}

Provisioned with **${iac.tool}** targeting **${iac.provider}**.

Rendered only when `features.iac` is on (path-segment guard `_when.features.iac/`).
The provider-specific files are selected by the DERIVED booleans `iac.is_aws` /
`iac.is_gcp` (only one is true) via the `_when.iac.is_aws/` and `_when.iac.is_gcp/`
guards — so this directory ships exactly one provider's block.

## Layout

```
infra/
  main.tf            # root module: wires the provider + module instances
  variables.tf       # input variables (region, project/env name, ...)
  aws/   | gcp/       # provider block + provider-specific resources (one of them)
```

`infra/**` is a gate-protected surface (see the contract gate). Infra changes go
through a contract.

## Usage (${iac.tool})

```bash
cd infra
terraform init
terraform plan
terraform apply
```

Keep state in a remote backend (not committed). Wire secrets through your
provider's secret manager, never into `*.tf` literals.
