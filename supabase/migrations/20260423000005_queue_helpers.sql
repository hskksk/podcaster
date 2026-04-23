-- Wrapper functions so Supabase JS client can call pgmq via db.rpc()

create or replace function pgmq_read(queue_name text, vt int, qty int)
returns setof pgmq.message_record
language sql security definer
as $$
  select * from pgmq.read(queue_name, vt, qty);
$$;

create or replace function pgmq_send(queue_name text, msg jsonb)
returns bigint
language sql security definer
as $$
  select pgmq.send(queue_name, msg);
$$;

create or replace function pgmq_delete(queue_name text, msg_id bigint)
returns boolean
language sql security definer
as $$
  select pgmq.delete(queue_name, msg_id);
$$;
