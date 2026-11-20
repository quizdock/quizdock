import { Link } from '@tanstack/react-router';
import { Users } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useGameControllerListed } from '../api/generated/games/games';
import { type GameSocket, ensureGameSocket } from '../game/game-client';
import { roomLabel } from '../game/room-components';

/**
 * How often the list is read again anyway: the server says when a lobby opens,
 * starts, closes or leaves the list; this catches the participants coming in.
 */
const REFRESH_MS = 30_000;

/**
 * The open lobbies, under the PIN field of the home page (`LOBBY_LISTING`): each
 * one leads to `/join/$pin`, as typing its PIN would. Nothing at all while the
 * instance lists none, or no lobby is open.
 */
export function ListedLobbies() {
  const { t } = useTranslation(['auth', 'live']);
  const { data, refetch } = useGameControllerListed({
    query: { refetchInterval: REFRESH_MS, retry: false },
  });
  const listing = data?.status === 200 && data.data.listing;
  const lobbies = data?.status === 200 ? data.data.lobbies : [];

  // Told by the server when the list changes, while the instance lists lobbies.
  useEffect(() => {
    if (!listing) return;
    let gone = false;
    const reread = () => void refetch();
    let socket: GameSocket | null = null;
    // A reconnection leaves the watchers: watch again, and catch up on what was missed.
    const rewatch = () => {
      socket?.emit('listing:watch');
      reread();
    };
    void ensureGameSocket('guest').then((s) => {
      if (gone) return;
      socket = s;
      s.on('lobbies:changed', reread);
      s.on('connect', rewatch);
      s.emit('listing:watch');
    });
    return () => {
      gone = true;
      socket?.off('lobbies:changed', reread);
      socket?.off('connect', rewatch);
      socket?.emit('listing:unwatch');
    };
  }, [listing, refetch]);

  if (lobbies.length === 0) return null;
  return (
    <section className="content-md flex w-full flex-col gap-3" aria-labelledby="listed-lobbies">
      <h2 id="listed-lobbies" className="text-lg font-semibold">
        {t('landing.lobbies.title')}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {lobbies.map((lobby) => (
          <li key={lobby.pin}>
            <Link
              to="/join/$pin"
              params={{ pin: lobby.pin }}
              className="bg-card hover:border-primary focus-visible:ring-ring flex h-full flex-col gap-2 rounded-lg border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="font-semibold">{roomLabel(t, lobby.roomName, lobby.hostName)}</span>
              <span className="text-muted-foreground truncate text-sm">{lobby.quizTitle}</span>
              <span className="mt-auto flex items-center justify-between gap-2 text-xs">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 font-medium',
                    lobby.playing ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary',
                  )}
                >
                  {lobby.playing ? t('landing.lobbies.playing') : t('landing.lobbies.waiting')}
                </span>
                <span
                  className="text-muted-foreground flex items-center gap-1 tabular-nums"
                  aria-label={t('landing.lobbies.players', { n: lobby.playerCount })}
                >
                  <Users className="size-3.5" aria-hidden />
                  {lobby.playerCount}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
