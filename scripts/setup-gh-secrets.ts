#!/usr/bin/env tsx
import dotenv from "dotenv";
import { execSync } from "node:child_process";
import { detectProjectRef } from "./lib/supabase-detect.ts";

dotenv.config({ path: ".env" });

function setSecret(name: string, value: string) {
  console.log(`Setting ${name}...`);
  execSync(`gh secret set ${name} --body ${JSON.stringify(value)}`, {
    stdio: "inherit",
  });
}

const geminiKey = process.env.GEMINI_API_KEY;
const memKey = process.env.MEM_API_KEY;

if (!geminiKey) {
  console.error("GEMINI_API_KEY が .env に設定されていません。");
  process.exit(1);
}
if (!memKey) {
  console.error("MEM_API_KEY が .env に設定されていません。");
  process.exit(1);
}

const projectRef = detectProjectRef();

setSecret("SUPABASE_PROJECT_REF", projectRef);
setSecret("GEMINI_API_KEY", geminiKey);
setSecret("MEM_API_KEY", memKey);

console.log("\n完了。残り 2 つの Secret は GitHub Settings から手動登録してください:");
console.log("  SUPABASE_ACCESS_TOKEN  https://supabase.com/dashboard/account/tokens");
console.log("  SUPABASE_DB_PASSWORD   プロジェクト作成時のDBパスワード");
