-- The pgflow schema is exposed through PostgREST (config.toml [api] schemas)
-- because the app calls pgflow.start_flow via the service role. Postgres grants
-- EXECUTE to PUBLIC on new functions, so these SECURITY DEFINER helpers were
-- also callable by anon/authenticated through /rest/v1/rpc/... — including
-- start_flow_with_states, which starts a flow (and so spends Gemini quota).
--
-- Nothing in the app calls them as anon/authenticated: cron runs them as
-- postgres, and the CLI/TUI/Edge Functions use service_role.

revoke execute on function pgflow.cleanup_ensure_workers_logs(integer)
  from public, anon, authenticated;
revoke execute on function pgflow.get_run_with_states(uuid)
  from public, anon, authenticated;
revoke execute on function pgflow.requeue_stalled_tasks()
  from public, anon, authenticated;
revoke execute on function pgflow.setup_ensure_workers_cron(text)
  from public, anon, authenticated;
revoke execute on function pgflow.setup_requeue_stalled_tasks_cron(text)
  from public, anon, authenticated;
revoke execute on function pgflow.start_flow_with_states(text, jsonb, uuid)
  from public, anon, authenticated;

-- Revoking from PUBLIC also drops any access service_role only had via PUBLIC.
grant execute on function pgflow.cleanup_ensure_workers_logs(integer) to service_role;
grant execute on function pgflow.get_run_with_states(uuid) to service_role;
grant execute on function pgflow.requeue_stalled_tasks() to service_role;
grant execute on function pgflow.setup_ensure_workers_cron(text) to service_role;
grant execute on function pgflow.setup_requeue_stalled_tasks_cron(text) to service_role;
grant execute on function pgflow.start_flow_with_states(text, jsonb, uuid) to service_role;
