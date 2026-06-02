# AWS provider block for ${project.name} (${iac.tool}).
# Rendered only when features.iac AND iac.is_aws (provider == aws). HCL refers to
# variables as var.<name> (no interpolation braces) so they are not confused with
# the kit's render-time substitution.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      project = var.project_name
      env     = var.environment
      managed = "terraform"
    }
  }
}

# Example resource: an S3 bucket for app assets/backups. Replace with the real
# infrastructure your product needs (per specs/ARCHITECTURE.md).
resource "aws_s3_bucket" "assets" {
  bucket = "${project.name}-assets-${iac.provider}"
}
