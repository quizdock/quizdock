import { SETTINGS } from '@quiz-dock/contracts';
import { settings } from '../admin/settings/settings.service';

/** The socket.io room of the home pages watching the list, told when it changes. */
export const LISTING_WATCHERS = 'lobby-listing';

/**
 * Whether the home page lists the open lobbies (`LOBBY_LISTING=listed`): a lobby
 * opened while it is so is listed, until its host takes it off. Back to
 * `unlisted`, the list empties at once.
 */
export function listsLobbies(): boolean {
  return settings.get(SETTINGS.LOBBY_LISTING) === 'listed';
}
