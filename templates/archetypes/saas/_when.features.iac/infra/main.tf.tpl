# Root ${iac.tool} module for ${project.name} (provider: ${iac.provider}).
#
# Rendered only when features.iac. The provider block + provider-specific resources
# live in the aws/ or gcp/ subdirectory (selected by iac.is_aws / iac.is_gcp). This
# root wires terraform settings and the input variables; extend it to instantiate
# the provider module under aws/ or gcp/.
#
# NOTE: HCL references variables as `var.<name>` (no interpolation braces) so they
# are NOT confused with the kit's render-time substitution.

terraform {
  required_version = ">= 1.6.0"

  # Configure a remote backend before `terraform init` in a real project; local
  # state is fine for first bring-up only.
  # backend "s3"  {}   # aws
  # backend "gcs" {}   # gcp
}

# Common locals derived from the input variables.
locals {
  name = var.project_name
  tags = {
    project = var.project_name
    env     = var.environment
    managed = "terraform"
  }
}
