#!/usr/bin/env tsx
/**
 * Run external-operation-poller via pg_cron's SQL helper (kong:8000 from inside the DB stack).
 * Prefer this over curling :54331 when Kong returns {"message":"name resolution failed"}.
 */
import { execSync } from "node:child_process";

execSync("supabase db query", {
  input: "select public.invoke_external_operation_poller();",
  stdio: ["pipe", "inherit", "inherit"],
});
