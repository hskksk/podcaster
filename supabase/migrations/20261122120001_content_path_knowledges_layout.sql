-- Remap legacy monorepo paths to hskksk/knowledges layout (S3).

update podcast.articles
set content_path = replace(content_path, 'content/docs/', 'content/ai-podcast/')
where content_path like 'content/docs/%';

update podcast.articles
set content_path = replace(content_path, 'content/web-clips/', 'notes/')
where content_path like 'content/web-clips/%';