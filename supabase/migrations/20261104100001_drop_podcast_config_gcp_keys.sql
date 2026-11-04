-- GCP placement moved to Edge Function secrets (GCP_PROJECT_ID, GCP_REGION, GCP_RUN_JOB_NAME).
delete from podcast_config
where key in (
  'gcp.project_id',
  'gcp.region',
  'gcp.run.job_name'
);
