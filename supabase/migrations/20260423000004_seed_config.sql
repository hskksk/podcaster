-- Default podcast configuration
insert into podcast_config (key, value) values
  ('podcast.title',       '"My AI Podcast"'),
  ('podcast.description', '"An AI-generated tech podcast."'),
  ('podcast.cover_url',   '"https://example.com/cover.png"'),
  ('tts.model',           '"gemini-2.5-flash-preview-tts"'),
  ('tts.instructions',    '"これは2人のスピーカーによるポッドキャストの会話です。自然な会話のトーンで、スピーカーの切り替わりに適切な間を置いて話してください。Hostが議論をリードし、CoHostは質問をしながら興味深く反応します。"'),
  ('tts.host.name',       '"Host"'),
  ('tts.host.voice',      '"Charon"'),
  ('tts.cohost.name',     '"CoHost"'),
  ('tts.cohost.voice',    '"Achird"'),
  ('generator.model',     '"gemini-2.5-flash"')
on conflict (key) do nothing;
