import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/harness';

// La cible de navigation (`/join/$pin` → PlayerPage) s'appuie sur useGameSession :
// on le neutralise (no-session) pour vérifier uniquement la navigation depuis /join.
vi.mock('../game/use-game-session', () => ({
  useGameSession: () => ({
    showOnScreen: () => undefined,
    view: { status: 'no-session', players: [], questionIndex: -1 },
    socket: null,
    markJoined: vi.fn(),
  }),
}));
vi.mock('../game/game-client', () => ({
  joinSession: vi.fn(),
  peekSession: (pin: string) =>
    pin === '771122'
      ? Promise.resolve({
          hasSound: false,
          participantAccess: 'open',
          roomName: null,
          hostName: 'Claire',
          quizTitle: 'Histoire',
          joinLocked: false,
        })
      : Promise.reject(
          Object.assign(new Error('Salon introuvable'), { code: 'session.not_found' }),
        ),
  loadPlayerSession: () => null,
  loadAvatarSeed: () => null,
  loadNickname: () => '',
  saveNickname: () => undefined,
  clearPlayerSession: () => undefined,
  saveAvatarSeed: () => undefined,
}));

describe('JoinPage (saisie du PIN)', () => {
  it('names the room at the 6th digit, then goes to /join/$pin', async () => {
    renderApp('/join');

    fireEvent.change(await screen.findByRole('textbox', { name: 'PIN, 6 chiffres' }), {
      target: { value: '771122' },
    });
    expect(await screen.findByText(/Claire/)).toBeInTheDocument();
    expect(screen.getByText(/Histoire/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));

    // PlayerPage (no-session) demande alors le pseudo.
    expect(await screen.findByPlaceholderText('Votre pseudo')).toBeInTheDocument();
  });

  it('says a wrong PIN at once, under the boxes', async () => {
    renderApp('/join');
    fireEvent.change(await screen.findByRole('textbox', { name: 'PIN, 6 chiffres' }), {
      target: { value: '000000' },
    });
    expect(
      await screen.findByText('Aucun salon ouvert avec ce PIN. Vérifie le grand écran.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continuer/ })).toBeNull();
  });
});
