-- Back to a release without 'behind' and 'alone' (SPECIFICATIONS-ROLLBACK §3). The type keeps
-- both values, which that release never reads; its questions do not keep them.
-- Mapped: behind → bottom, alone → bottom; each position kept aside for an upgrade again.
ALTER TABLE "question" ADD COLUMN IF NOT EXISTS "media_position_ghost" TEXT;
UPDATE "question" SET "media_position_ghost" = "media_position"::text, "media_position" = 'bottom'
WHERE "media_position" IN ('behind', 'alone');
