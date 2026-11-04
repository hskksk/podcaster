terraform {
  required_version = ">= 1.5.0"

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
