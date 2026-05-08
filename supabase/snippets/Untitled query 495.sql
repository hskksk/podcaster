SELECT * FROM pgflow.start_flow(
  flow_slug => 'greetUser',
  input => '{"firstName": "Alice", "lastName": "Smith"}'::jsonb
);