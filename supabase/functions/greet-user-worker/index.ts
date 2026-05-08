/**
 * To run this worker locally:
 *
 * 1. Start the Edge Runtime (in one terminal):
 *    npx supabase functions serve --no-verify-jwt
 *
 * 2. Start the worker (in another terminal):
 *    curl http://localhost:54321/functions/v1/greet-user-worker
 *
 * 3. Trigger a flow run (in Supabase Studio SQL Editor):
 *    SELECT * FROM pgflow.start_flow(
 *      flow_slug => 'greetUser',
 *      input => '{"firstName": "Alice", "lastName": "Smith"}'::jsonb
 *    );
 *
 * 4. Check run status:
 *    SELECT * FROM pgflow.runs
 *    WHERE flow_slug = 'greetUser'
 *    ORDER BY started_at DESC
 *    LIMIT 1;
 */
import { EdgeWorker } from '@pgflow/edge-worker';
import { GreetUser } from '../../flows/greet-user.ts';

EdgeWorker.start(GreetUser);
