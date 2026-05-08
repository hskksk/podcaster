grant select, insert, update, delete on all tables in schema pgmq to service_role;
grant usage, select, update on all sequences in schema pgmq to service_role;

alter default privileges for role postgres in schema pgmq
grant select, insert, update, delete on tables to service_role;

alter default privileges for role postgres in schema pgmq
grant usage, select, update on sequences to service_role;
