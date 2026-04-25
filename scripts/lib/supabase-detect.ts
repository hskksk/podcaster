import { execSync } from "node:child_process";

export function detectLocalStatus(): { apiUrl: string; serviceKey: string } {
  try {
    const out = execSync("supabase status -o json", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const s = JSON.parse(out);
    if (s.API_URL && s.SERVICE_ROLE_KEY) {
      return { apiUrl: s.API_URL, serviceKey: s.SERVICE_ROLE_KEY };
    }
  } catch { /* ignore */ }
  console.error(
    "supabase status から API_URL / SERVICE_ROLE_KEY を取得できませんでした。supabase start を実行してください。",
  );
  process.exit(1);
}

export function detectProjectRef(): string {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF;
  try {
    const out = execSync("supabase projects list -o json", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const projects: Array<{ id: string; name: string }> = JSON.parse(out);
    if (projects.length === 1) {
      console.log(`Auto-detected project: ${projects[0].name} (${projects[0].id})`);
      return projects[0].id;
    }
    if (projects.length > 1) {
      console.error(
        "複数のプロジェクトが見つかりました。SUPABASE_PROJECT_REF に対象プロジェクトの ID を設定してください:\n" +
          projects.map((p) => `  ${p.id}  ${p.name}`).join("\n"),
      );
      process.exit(1);
    }
  } catch {
    // login していない、または CLI が使えない場合
  }
  console.error(
    "SUPABASE_PROJECT_REF が未設定で、supabase projects list からも取得できませんでした。",
  );
  process.exit(1);
}

export function detectServiceKey(projectRef: string): string {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const out = execSync(
      `supabase projects api-keys --project-ref ${projectRef} -o json`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
    const keys: Array<{ name: string; api_key: string }> = JSON.parse(out);
    const entry = keys.find((k) => k.name === "service_role");
    if (entry?.api_key) {
      console.log("Auto-detected service_role key from supabase projects api-keys.");
      return entry.api_key;
    }
  } catch {
    // 取得失敗
  }
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY が未設定で、supabase projects api-keys からも取得できませんでした。",
  );
  process.exit(1);
}
