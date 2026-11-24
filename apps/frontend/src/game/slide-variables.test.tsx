import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from '@/components/markdown';
import { RoomVariables } from './slide-variables';
import type { GameView } from './use-game-session';

const show = (over: Partial<GameView>) =>
  render(
    <RoomVariables
      view={{ players: [{ playerId: 'p1', nickname: 'Ann' }], ...over } as GameView}
      pin="482913"
    >
      <Markdown>{'{players} here'}</Markdown>
    </RoomVariables>,
  );

describe('{players} on a live screen (#291)', () => {
  it('a participant reads the count they hear, not the list they joined with', () => {
    show({ lobbyCount: { ready: 0, total: 7 } });
    expect(screen.getByText('7 here')).toBeInTheDocument();
  });

  it('a screen, told no count, reads its list', () => {
    show({ lobbyCount: null });
    expect(screen.getByText('1 here')).toBeInTheDocument();
  });
});
