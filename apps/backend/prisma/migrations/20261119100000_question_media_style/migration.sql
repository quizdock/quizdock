-- How a question's picture or video is framed and revealed: ratio, fill, crop point, reveal.
ALTER TABLE "question" ADD COLUMN IF NOT EXISTS "media_style" JSONB;
