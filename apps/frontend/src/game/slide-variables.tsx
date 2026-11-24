import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { joinHostLabel } from './join-url';
import { roomLabel } from './room-components';
import { VariablesContext, type VariableValues } from '@/lib/variables';
import type { GameView } from './use-game-session';

/** The room's variables for a live screen, kept live (a count follows the room). */
export function useRoomVariables(view: GameView, pin: string): VariableValues {
  const { t, i18n } = useTranslation('live');
  const now = new Date();
  // The question the slide leads to (1-based), and what is left from it.
  const next = Math.min(view.questionIndex + 1, view.totalQuestions);
  return {
    room: roomLabel(t, view.roomName, view.hostName),
    host: view.hostName ?? '',
    pin,
    join: joinHostLabel(view),
    // A participant hears the count, not who comes and goes (#291); a screen has the list.
    players: view.lobbyCount?.total ?? view.players.length,
    question: next,
    total: view.totalQuestions,
    remaining: Math.max(0, view.totalQuestions - view.questionIndex),
    date: now.toLocaleDateString(i18n.language),
    time: now.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }),
  };
}

/** Gives the slides and questions inside the room's variables. */
export function RoomVariables({
  view,
  pin,
  children,
}: {
  view: GameView;
  pin: string;
  children: ReactNode;
}) {
  return (
    <VariablesContext.Provider value={useRoomVariables(view, pin)}>
      {children}
    </VariablesContext.Provider>
  );
}
