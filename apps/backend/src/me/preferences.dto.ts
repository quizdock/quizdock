import { createZodDto } from 'nestjs-zod';
import {
  LANGUAGE_RE,
  PARTICIPANT_ACCESS,
  STEP_VIEWS,
  userPreferencesSchema,
} from '@quiz-dock/contracts';
import { z } from 'zod';

/** What the account remembers (`GET /me/preferences`); an absent key is the default. */
export class UserPreferencesDto extends createZodDto(userPreferencesSchema) {}

/**
 * Partial change (`PATCH /me/preferences`): a key left out is kept, `null` goes
 * back to the default. Unknown keys are refused rather than stored unread.
 */
export const updatePreferencesSchema = z
  .object({
    participantAccess: z.enum(PARTICIPANT_ACCESS).nullable().optional(),
    language: z.string().regex(LANGUAGE_RE).max(10).nullable().optional(),
    stepView: z.enum(STEP_VIEWS).nullable().optional(),
  })
  .strict();

export class UpdatePreferencesDto extends createZodDto(updatePreferencesSchema) {}
