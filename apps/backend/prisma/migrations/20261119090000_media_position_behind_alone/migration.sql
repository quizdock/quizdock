-- A question's picture or video behind its text, or alone in its place.
ALTER TYPE "MediaPosition" ADD VALUE IF NOT EXISTS 'behind';
ALTER TYPE "MediaPosition" ADD VALUE IF NOT EXISTS 'alone';
-- Run again after a rollback (down.sql): the positions set aside come back on the questions
-- still where the rollback put them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'question' AND column_name = 'media_position_ghost') THEN
    EXECUTE 'UPDATE "question" SET "media_position" = "media_position_ghost"::"MediaPosition"
             WHERE "media_position_ghost" IS NOT NULL AND "media_position" = ''bottom''';
    EXECUTE 'ALTER TABLE "question" DROP COLUMN "media_position_ghost"';
  END IF;
END $$;
