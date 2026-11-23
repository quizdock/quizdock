-- A question's hint: a text revealed during the question, for part of its points.
ALTER TABLE "question" ADD COLUMN IF NOT EXISTS "hint" JSONB;
