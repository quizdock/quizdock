import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** A lobby the home page lists (`LOBBY_LISTING`): what a passer-by needs to pick it. */
export const listedLobbySchema = z.object({
  pin: z.string(),
  /** The lobby's own name; null = the default, "<host>'s lobby". */
  roomName: z.string().nullable(),
  hostName: z.string(),
  quizTitle: z.string(),
  /** A quiz under way; false while the lobby waits. */
  playing: z.boolean(),
  playerCount: z.number().int(),
  /** `account`: joining asks for a sign-in under OIDC. */
  participantAccess: z.enum(['account', 'open']),
});

/** The home page's list: whether the instance lists lobbies at all, and those it lists. */
export const lobbyListingSchema = z.object({
  /** `LOBBY_LISTING=listed`: the page follows the list (`listing:watch`). */
  listing: z.boolean(),
  lobbies: z.array(listedLobbySchema),
});

export class LobbyListingDto extends createZodDto(lobbyListingSchema) {}
