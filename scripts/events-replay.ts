#!/usr/bin/env tsx
import dotenv from "dotenv";
import { replayAllEvents } from "../supabase/functions/_adapters/eventstore/postgres.ts";
import { connectPostgres } from "./lib/postgres-connect.ts";

dotenv.config({ path: ".env" });

async function main(): Promise<void> {
  const sql = connectPostgres();
  const count = await replayAllEvents(sql);
  console.log(`Replayed ${count} events into podcast projections.`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
