-- Seeded once migrated: a question behind its text, one alone, one on top.
INSERT INTO "user" (id, oidc_subject, display_name, updated_at)
VALUES ('RBUSER00000000000000000000', 'rollback-check', 'Ann', now());
INSERT INTO quiz (id, owner_id, title, updated_at)
VALUES ('RBQUIZ00000000000000000000', 'RBUSER00000000000000000000', 'Rollback', now());
INSERT INTO question (id, quiz_id, order_index, type, prompt, updated_at, media_position) VALUES
  ('RBQ1000000000000000000000', 'RBQUIZ00000000000000000000', 0, 'single_choice', 'behind', now(), 'behind'),
  ('RBQ2000000000000000000000', 'RBQUIZ00000000000000000000', 1, 'single_choice', 'alone', now(), 'alone'),
  ('RBQ3000000000000000000000', 'RBQUIZ00000000000000000000', 2, 'single_choice', 'top', now(), 'top');
-- after down
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM question WHERE media_position IN ('behind', 'alone')) THEN
    RAISE EXCEPTION 'a position the older release does not know is left';
  END IF;
  IF (SELECT media_position FROM question WHERE id = 'RBQ3000000000000000000000') <> 'top' THEN
    RAISE EXCEPTION 'a position the older release knows was changed';
  END IF;
END $$;
-- The older release moves the one alone to the top meanwhile.
UPDATE question SET media_position = 'top' WHERE id = 'RBQ2000000000000000000000';
-- after up again
DO $$
BEGIN
  IF (SELECT media_position FROM question WHERE id = 'RBQ1000000000000000000000') <> 'behind' THEN
    RAISE EXCEPTION 'the position set aside did not come back';
  END IF;
  IF (SELECT media_position FROM question WHERE id = 'RBQ2000000000000000000000') <> 'top' THEN
    RAISE EXCEPTION 'a position chosen on the older release was overwritten';
  END IF;
END $$;
