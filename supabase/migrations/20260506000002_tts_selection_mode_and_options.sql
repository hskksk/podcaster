-- Add TTS selection mode and per-speaker voice/tone option pools
insert into podcast_config (key, value) values
  ('tts.selection_mode', '"fixed"'),
  ('tts.host.tone', '"落ち着いて信頼感のある進行"'),
  ('tts.host.voice_options', '["Charon","Achird","Puck","Kore","Fenrir","Aoede","Leda","Orus","Zephyr","Callirrhoe"]'),
  ('tts.host.tone_options', '["とても楽しげで勢いのある進行","明るく元気でテンポの良い進行","落ち着いて信頼感のある進行","柔らかく丁寧で包み込む進行","若々しくフレッシュな進行","知的でクールな進行","熱量高めでワクワク感のある進行","深夜ラジオのようにしっとりした進行","親密で距離の近い進行","上品でゆったりした進行"]'),
  ('tts.cohost.tone', '"親しみやすく好奇心のある受け答え"'),
  ('tts.cohost.voice_options', '["Achird","Charon","Puck","Kore","Fenrir","Aoede","Leda","Orus","Zephyr","Callirrhoe"]'),
  ('tts.cohost.tone_options', '["とても楽しげでリアクション豊かな受け答え","明るく元気で軽快な受け答え","落ち着いたトーンで的確な受け答え","柔らかく優しい受け答え","若々しくフレッシュな受け答え","知的でロジカルな受け答え","驚きや発見を素直に表す受け答え","深夜ラジオのように穏やかな受け答え","親密でフランクな受け答え","上品で聞き心地の良い受け答え"]')
on conflict (key) do nothing;
