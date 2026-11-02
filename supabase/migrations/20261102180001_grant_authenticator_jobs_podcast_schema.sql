-- PostgREST requires USAGE on exposed schemas for the authenticator role.
-- Dashboard → API → Exposed schemas must still list jobs and podcast (see AGENTS.md).

grant usage on schema jobs to authenticator;
grant usage on schema podcast to authenticator;

grant usage on schema jobs to anon;
