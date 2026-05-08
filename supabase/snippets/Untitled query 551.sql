SELECT * FROM pgflow.runs
WHERE flow_slug = 'greetUser'
ORDER BY started_at DESC
LIMIT 1;