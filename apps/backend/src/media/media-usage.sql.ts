import { Prisma } from '@prisma/client';

/**
 * Anything shaped like a media id (a ULID) in a text: a Markdown image's URL, a
 * slide's image block, a frozen snapshot. Matches that are quiz or question ids
 * fall away when joined to `media_asset`.
 */
const MEDIA_ID = '([0-9A-HJKMNP-TV-Z]{26})';

/**
 * Where a media can be used, said once for every reader: the author's library,
 * the credits, the administration, a deletion and the clean-up. A new place is
 * added here, to both forms, and to `media-usage.spec.ts`.
 */

/** The relations through which a quiz, or a theme, holds a media in a slot (its foreign keys). */
export const MEDIA_SLOTS = [
  'coverForQuizzes',
  'questionVisuals',
  'questionAudios',
  'questionBackgrounds',
  'slides',
  'slideImages',
  'slideVideos',
  'slideAudios',
  'options',
  // A quiz theme's icons, font, sounds and picture (docs/themes.md).
  'themes',
] as const satisfies readonly (keyof Prisma.MediaAssetCountOutputTypeSelect)[];

/**
 * Every (quiz, media) use, in one pass over the quizzes: the slots, the
 * options, the slides, and the ids found in their texts. Read once for a whole
 * page, where a `LIKE` per media would scan every text again for each (the
 * library of an author with 2,000 quizzes and 200 media: 28 s, against 0.2 s).
 */
export const QUIZ_MEDIA_REFS = Prisma.sql`
  SELECT q.id AS quiz_id, q.cover_media_id AS media_id FROM quiz q WHERE q.cover_media_id IS NOT NULL
  UNION ALL
  SELECT x.quiz_id, v.media_id FROM question x
    CROSS JOIN LATERAL (VALUES (x.visual_media_id), (x.audio_media_id), (x.background_media_id)) v (media_id)
    WHERE v.media_id IS NOT NULL
  UNION ALL
  -- A hint's picture (SPECIFICATIONS-HINTS), kept in the question's hint.
  SELECT x.quiz_id, x.hint->>'imageMediaId' FROM question x
    WHERE x.hint->>'imageMediaId' IS NOT NULL
  UNION ALL
  SELECT x.quiz_id, o.media_id FROM answer_option o JOIN question x ON x.id = o.question_id
    WHERE o.media_id IS NOT NULL
  UNION ALL
  SELECT s.quiz_id, v.media_id FROM slide s
    CROSS JOIN LATERAL (VALUES (s.media_id), (s.image_media_id), (s.video_media_id), (s.audio_media_id)) v (media_id)
    WHERE v.media_id IS NOT NULL
  UNION ALL
  SELECT q.id, r[1] FROM quiz q, regexp_matches(COALESCE(q.description, ''), ${MEDIA_ID}, 'g') r
  UNION ALL
  SELECT x.quiz_id, r[1] FROM question x,
    regexp_matches(x.prompt || ' ' || COALESCE(x.answer_explanation, ''), ${MEDIA_ID}, 'g') r
  UNION ALL
  SELECT x.quiz_id, r[1] FROM answer_option o JOIN question x ON x.id = o.question_id,
    regexp_matches(COALESCE(o.text, ''), ${MEDIA_ID}, 'g') r
  UNION ALL
  SELECT s.quiz_id, r[1] FROM slide s, regexp_matches(s.blocks::text, ${MEDIA_ID}, 'g') r`;

/** Every (archived session, media) its frozen snapshot shows, in one pass. */
export const ARCHIVED_MEDIA_REFS = Prisma.sql`
  SELECT g.id AS session_id, r[1] AS media_id
  FROM game_session_log g, regexp_matches(g.quiz_snapshot::text, ${MEDIA_ID}, 'g') r`;

/**
 * Whether a text still shows the media `id`: the text places of the two forms
 * above, for a single media once its slots are known to be empty. A `LIKE` per
 * table: ten times faster than reading every id out of every text.
 */
export function shownInText(id: string): Prisma.Sql {
  const pattern = `%${id}%`;
  return Prisma.sql`(
    EXISTS (SELECT 1 FROM quiz WHERE description LIKE ${pattern})
    OR EXISTS (SELECT 1 FROM question WHERE prompt LIKE ${pattern} OR answer_explanation LIKE ${pattern} OR hint::text LIKE ${pattern})
    OR EXISTS (SELECT 1 FROM answer_option WHERE text LIKE ${pattern})
    OR EXISTS (SELECT 1 FROM slide WHERE blocks::text LIKE ${pattern})
    OR EXISTS (SELECT 1 FROM game_session_log WHERE quiz_snapshot::text LIKE ${pattern})
  )`;
}
