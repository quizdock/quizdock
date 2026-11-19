-- A slide's media placed as a question's (SPECIFICATIONS-STEP-EDITOR): its own picture, where
-- its picture or video sits against its blocks (behind, as its video always did), and their framing.
ALTER TABLE "slide"
  ADD COLUMN "image_media_id" CHAR(26),
  ADD COLUMN "media_position" "MediaPosition" NOT NULL DEFAULT 'behind',
  ADD COLUMN "media_style" JSONB;
ALTER TABLE "slide" ADD CONSTRAINT "slide_image_media_id_fkey"
  FOREIGN KEY ("image_media_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
