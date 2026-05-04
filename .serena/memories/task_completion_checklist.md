# Task completion checklist
- Run at least `pnpm typecheck` when TypeScript/script logic is changed.
- If workflow/automation changed, validate YAML syntax and logic paths.
- If Supabase or ingestion behavior changed, verify related scripts (`scripts/ingest.ts` etc.) are still invoked with expected inputs.
- Do not create commits or push unless user explicitly asks.
- If workflow failure path appears ambiguous, report and ask user for decision per project rule.