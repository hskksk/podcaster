# Railway Infrastructure as Code

This directory contains the Railway Infrastructure as Code configuration for the podcaster project.

## About

This configuration uses Railway IaC (Infrastructure as Code) to define and manage services, databases, volumes, and other resources in a single TypeScript file.

## Commands

```bash
# Preview changes (safe, read-only)
railway config plan

# Preview with actual values (for non-secret config)
railway config plan --show-values

# Apply changes after preview
railway config apply

# Pull current Railway configuration into this file
railway config pull
```

## Serverless Configuration

To enable Serverless mode for cost optimization (service sleeps after 10 minutes of inactivity):

1. Via CLI: Navigate to the service in your project and enable "Serverless" in the service settings
2. Via Dashboard: Project → Service → Settings → Enable "Serverless"

Serverless mode is not yet available in IaC (`.railway/railway.ts`), but can be toggled in the Railway dashboard or via the API.

## Migration from Config as Code

Previously, this project used `railway.json` for Config as Code configuration (deprecated as of 2026-12-01).

The configuration has been migrated to Infrastructure as Code (`.railway/railway.ts`) to:
- Manage project-wide resources (not just single service)
- Use a modern TypeScript DSL
- Benefit from upcoming features and improvements

For more information, see [Railway Infrastructure as Code](https://docs.railway.com/infrastructure-as-code).
