#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import { detectProjectRef } from "./lib/supabase-detect.ts";

function setSecret(name: string, value: string) {
  console.log(`Setting ${name}...`);
  execSync(`gh secret set ${name} --body ${JSON.stringify(value)}`, {
    stdio: "inherit",
  });
}

const projectRef = detectProjectRef();

setSecret("SUPABASE_PROJECT_REF", projectRef);

console.log("\n完了。残り 2 つの Secret は GitHub Settings から手動登録してください:");
console.log("  SUPABASE_ACCESS_TOKEN  https://supabase.com/dashboard/account/tokens");
console.log("  SUPABASE_DB_PASSWORD   プロジェクト作成時のDBパスワード");
console.log("\nGEMINI_API_KEY / GCP_* は Supabase Dashboard → Edge Functions → Secrets で設定（deploy CI では載せない）。");
