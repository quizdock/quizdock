-- A slide's media placed as a question's (SPECIFICATIONS-STEP-EDITOR): its own picture, where
-- its picture or video sits against its blocks (behind, as its video always did), and their framing.
ALTER TABLE "slide"
  ADD COLUMN IF NOT EXISTS "image_media_id" CHAR(26),
  ADD COLUMN IF NOT EXISTS "media_position" "MediaPosition" NOT NULL DEFAULT 'behind',
  ADD COLUMN IF NOT EXISTS "media_style" JSONB;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'slide_image_media_id_fkey') THEN
    ALTER TABLE "slide" ADD CONSTRAINT "slide_image_media_id_fkey"
      FOREIGN KEY ("image_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
