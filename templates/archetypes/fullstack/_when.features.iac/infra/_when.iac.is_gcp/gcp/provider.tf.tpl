# GCP provider block for ${project.name} (${iac.tool}).
# Rendered only when features.iac AND iac.is_gcp (provider == gcp). HCL refers to
# variables as var.<name> (no interpolation braces) so they are not confused with
# the kit's render-time substitution.

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

variable "gcp_project_id" {
  description = "GCP project id to deploy into."
  type        = string
}

provider "google" {
  project = var.gcp_project_id
  region  = var.region
}

# Example resource: a Cloud Storage bucket for app assets/backups. Replace with the
# real infrastructure your product needs (per specs/ARCHITECTURE.md).
resource "google_storage_bucket" "assets" {
  name     = "${project.name}-assets-${iac.provider}"
  location = var.region
}
