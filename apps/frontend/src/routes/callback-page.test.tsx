import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { mockApi, renderApp } from '../test/harness';

describe('CallbackPage', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('a sign-in that did not go through offers to try again, or to go home', async () => {
    mockApi([]);
    // No code in the address: the exchange fails at once.
    renderApp('/auth/callback', 'oidc');
    expect(await screen.findByText('La connexion n’a pas abouti')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute('href', '/');
  });

  it('a silent attempt the provider declines ends on the sign-in button, no exchange', async () => {
    const fetchMock = mockApi([]);
    sessionStorage.setItem('live.silentLoginState', 's1');
    window.history.replaceState(null, '', '/auth/callback?error=login_required&state=s1');
    const { router } = renderApp('/auth/callback', 'oidc');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ interactive: true });
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/auth/callback'),
      expect.anything(),
    );
  });

  it('a silent return after a sign-out in another tab is not exchanged', async () => {
    const fetchMock = mockApi([]);
    sessionStorage.setItem('live.silentLoginState', 's2');
    localStorage.setItem('live.oidcSignedOut', '1');
    window.history.replaceState(null, '', '/auth/callback?code=c&state=s2');
    const { router } = renderApp('/auth/callback', 'oidc');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/auth/callback'),
      expect.anything(),
    );
  });

  it('a silent attempt that fails otherwise says so', async () => {
    mockApi([]);
    sessionStorage.setItem('live.silentLoginState', 's3');
    window.history.replaceState(null, '', '/auth/callback?error=server_error&state=s3');
    renderApp('/auth/callback', 'oidc');
    expect(await screen.findByText('La connexion n’a pas abouti')).toBeInTheDocument();
  });
});
