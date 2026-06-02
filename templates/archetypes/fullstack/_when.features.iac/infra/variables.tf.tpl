# Input variables for the ${iac.tool} root module — ${project.name}.
# Rendered only when features.iac. HCL refers to these as var.<name>.

variable "project_name" {
  description = "Logical project/stack name used to tag and name resources."
  type        = string
  default     = "${project.name}"
}

variable "environment" {
  description = "Deployment environment (e.g. dev, staging, prod)."
  type        = string
  default     = "dev"
}

variable "region" {
  description = "Cloud region for the ${iac.provider} provider."
  type        = string
}
