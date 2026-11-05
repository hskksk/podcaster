terraform {
  # Pinned to the HCP Terraform workspace setting and
  # .github/workflows/terraform-audio-transcode.yml. See TFC.md.
  required_version = "~> 1.17.1"

  cloud {
    organization = "hskksk"

    workspaces {
      name = "podcaster-audio-transcode"
    }
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.40.0"
    }
  }
}
