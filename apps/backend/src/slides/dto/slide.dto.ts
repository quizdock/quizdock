import { createZodDto } from 'nestjs-zod';
import {
  AUDIO_TARGETS,
  MEDIA_POSITIONS,
  WAVEFORM_SIZES,
  backgroundStyleSchema,
  mediaStyleSchema,
} from '@quiz-dock/contracts';
import { z } from 'zod';
import { gradientSchema, slideBlockSchema } from './slide-content.schema';

/** A slide as returned by the API (#7). Position = `beforeQuestionId` (null = end) + `orderIndex`. */
export const slideSchema = z.object({
  id: z.string(),
  quizId: z.string(),
  beforeQuestionId: z.string().nullable(),
  orderIndex: z.number().int(),
  blocks: z.array(slideBlockSchema),
  /** Full-cover background image, if any. */
  mediaId: z.string().nullable(),
  gradient: gradientSchema.nullable(),
  /** How the background is laid (docs/themes.md); null: today's cover. */
  backgroundStyle: backgroundStyleSchema.nullable(),
  /** Its picture, placed by `mediaPosition` (never with a video). */
  imageMediaId: z.string().nullable(),
  videoMediaId: z.string().nullable(),
  /** Where its picture or video sits against its blocks; behind them by default. */
  mediaPosition: z.enum(MEDIA_POSITIONS),
  /** How its picture or video is framed; null = as its file is. */
  mediaStyle: mediaStyleSchema.nullable(),
  videoLoop: z.boolean(),
  videoSound: z.boolean(),
  audioMediaId: z.string().nullable(),
  waveformSize: z.enum(WAVEFORM_SIZES),
  audioTarget: z.enum(AUDIO_TARGETS).nullable(),
  textTone: z.enum(['light', 'dark']),
  textOutline: z.boolean(),
  displayDelayS: z.number().int().nullable(),
});

export class SlideDto extends createZodDto(slideSchema) {}
