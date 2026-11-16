import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthProvider,
  bindOidcSession,
  claimSilentLogin,
  configureAuth,
  forgetStoredTokens,
  getLocalUser,
  isAuthenticated,
  useAuth,
} from './auth-context';
import { customFetch } from '../api/http';
import { useRole } from './use-role';

/** The app always has a query cache above the auth provider (see main.tsx). */
const withQueries = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {ui}
  </QueryClientProvider>
);

/** A fetch answering the auth endpoints of the backend (BFF). */
function authBackend(routes: Record<string, [number, unknown]>) {
  const fetchMock = vi.fn(async (...[url]: [string, RequestInit?]) => {
    const [status, body] = routes[url] ?? [404, { code: 'not_found' }];
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function Probe() {
  const { user, loginLocal, logout } = useAuth();
  return (
    <div>
      <span data-testid="who">{user ?? '∅'}</span>
      <button type="button" onClick={() => loginLocal('Marc')}>
        in
      </button>
      <button type="button" onClick={logout}>
        out
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
  afterEach(() => localStorage.clear());

  it('login/logout met à jour l’état et le stockage local', async () => {
    render(
      withQueries(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      ),
    );
    expect(screen.getByTestId('who').textContent).toBe('∅');

    act(() => screen.getByText('in').click());
    expect(screen.getByTestId('who').textContent).toBe('Marc');
    expect(getLocalUser()).toBe('Marc');

    act(() => screen.getByText('out').click());
    // La déconnexion locale rend d'abord le siège d'hôte (asynchrone).
    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('∅'));
    expect(getLocalUser()).toBeNull();
  });
});

function OidcProbe() {
  const { user, loginOidc, completeOidcLogin } = useAuth();
  return (
    <div>
      <span data-testid="who">{user ?? '∅'}</span>
      <button type="button" onClick={() => void loginOidc()}>
        go
      </button>
      <button
        type="button"
        onClick={() =>
          void completeOidcLogin(new URLSearchParams('code=c1&state=s1&iss=https://idp'))
        }
      >
        cb
      </button>
    </div>
  );
}

describe('AuthProvider: what the account may do follows who it is (audit E4)', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('reads the roles again once the host seat is taken, not a minute later', async () => {
    let role = 'player';
    const fetchMock = vi.fn(async (...[url]: [string, RequestInit?]) => {
      const body =
        url === '/api/v1/me'
          ? { id: 'u1', displayName: 'Marc', email: null, roles: [role] }
          : { holder: 'Marc', expiresAt: null };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('live.localUser', 'Marc');
    function Seat() {
      const { claimHostSeat } = useAuth();
      const { roles } = useRole();
      return (
        <button type="button" onClick={() => void claimHostSeat(null)}>
          {roles.join(',') || '…'}
        </button>
      );
    }
    render(
      withQueries(
        <AuthProvider>
          <Seat />
        </AuthProvider>,
      ),
    );
    await screen.findByText('player');
    role = 'host'; // what the server says once the seat is held
    await act(async () => screen.getByText('player').click());
    expect(await screen.findByText('host')).toBeInTheDocument();
  });
});

describe('AuthProvider (mode oidc)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    configureAuth('none');
  });

  it('loginOidc goes where the backend says; the callback hands the code to the backend', async () => {
    const fetchMock = authBackend({
      '/api/v1/auth/login': [200, { url: 'https://idp/auth?state=s1' }],
      '/api/v1/auth/callback': [200, { name: 'Marie' }],
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, pathname: '/login', assign });
    configureAuth('oidc', false);

    render(
      withQueries(
        <AuthProvider mode="oidc">
          <OidcProbe />
        </AuthProvider>,
      ),
    );
    await act(async () => {
      screen.getByText('go').click();
    });
    expect(assign).toHaveBeenCalledWith('https://idp/auth?state=s1');

    await act(async () => {
      screen.getByText('cb').click();
    });
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/v1/auth/callback')!;
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      code: 'c1',
      state: 's1',
      iss: 'https://idp',
    });
    expect(screen.getByTestId('who').textContent).toBe('Marie');
    expect(isAuthenticated()).toBe(true);
  });
});

describe('OIDC session lifecycle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    configureAuth('none');
  });

  it('holds no token: the cookie authenticates, a 401 ends the session', async () => {
    const fetchMock = authBackend({ '/api/v1/me': [401, { code: 'auth.required' }] });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, pathname: '/dashboard', assign });
    configureAuth('oidc', true);
    bindOidcSession();

    await expect(customFetch('/api/v1/me', {})).rejects.toThrow('HTTP 401');
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(assign).toHaveBeenCalledWith('/login');
    expect(isAuthenticated()).toBe(false);
    // The page left waits for the next sign-in.
    expect(sessionStorage.getItem('live.afterLogin')).toBe('/dashboard');
  });

  it('a sign-in in another tab sends a tab waiting at the sign-in to its page', async () => {
    authBackend({});
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, pathname: '/login', assign });
    sessionStorage.setItem('live.afterLogin', '/quizzes/q1');
    configureAuth('oidc', false);
    bindOidcSession();

    const other = new BroadcastChannel('quizdock-auth');
    other.postMessage('signed-in');
    other.close();
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/quizzes/q1'));
  });

  it('keeps the session alive while signed in, hidden tab or not', async () => {
    vi.useFakeTimers();
    const fetchMock = authBackend({ '/api/v1/me': [200, { displayName: 'Marie' }] });
    configureAuth('oidc', true);
    bindOidcSession();
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/me', expect.anything());
    configureAuth('oidc', false);
    fetchMock.mockClear();
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('forgets the tokens an earlier version kept in the browser', () => {
    localStorage.setItem('oidc.user:https://idp:quiz-dock-frontend', '{"access_token":"x"}');
    sessionStorage.setItem('oidc.8f2e', '{}');
    localStorage.setItem('live.localUser', 'Marc');
    forgetStoredTokens();
    expect(localStorage.getItem('oidc.user:https://idp:quiz-dock-frontend')).toBeNull();
    expect(sessionStorage.getItem('oidc.8f2e')).toBeNull();
    expect(localStorage.getItem('live.localUser')).toBe('Marc');
    localStorage.clear();
  });

  it('logout ends the session on the backend, then at the provider', async () => {
    authBackend({ '/api/v1/auth/logout': [200, { url: 'https://idp/logout?id_token_hint=x' }] });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, pathname: '/quizzes', assign });
    function Out() {
      const { user, logout } = useAuth();
      return (
        <button type="button" onClick={() => void logout()}>
          {user ?? '∅'}
        </button>
      );
    }
    render(
      withQueries(
        <AuthProvider mode="oidc" initialUser="Marie">
          <Out />
        </AuthProvider>,
      ),
    );
    await act(async () => {
      screen.getByText('Marie').click();
    });
    expect(assign).toHaveBeenCalledWith('https://idp/logout?id_token_hint=x');
    expect(screen.getByText('∅')).toBeInTheDocument();
  });
});

describe('Silent sign-in (#282)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    configureAuth('none');
  });

  it('one attempt a minute for the whole browser, whatever the tabs and reloads', () => {
    expect(claimSilentLogin(1_000_000)).toBe(true);
    expect(claimSilentLogin(1_030_000)).toBe(false);
    expect(claimSilentLogin(1_061_000)).toBe(true);
  });

  it('none after a sign-out, nor when the storage keeps nothing', () => {
    localStorage.setItem('live.oidcSignedOut', '1');
    expect(claimSilentLogin()).toBe(false);
    localStorage.clear();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => undefined);
    expect(claimSilentLogin()).toBe(false);
  });

  it('leaves for the provider out of the history, its state kept for the callback', async () => {
    const fetchMock = authBackend({
      '/api/v1/auth/login?prompt=none': [200, { url: 'https://idp/auth?state=s9' }],
    });
    const replace = vi.fn();
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, pathname: '/login', assign, replace });
    configureAuth('oidc', false);
    let login: ((prompt?: 'none') => Promise<void>) | undefined;
    function Grab() {
      login = useAuth().loginOidc;
      return null;
    }
    render(
      withQueries(
        <AuthProvider mode="oidc">
          <Grab />
        </AuthProvider>,
      ),
    );
    await act(() => login!('none'));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/login?prompt=none', expect.anything());
    expect(replace).toHaveBeenCalledWith('https://idp/auth?state=s9');
    expect(assign).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('live.silentLoginState')).toBe('s9');
  });
});
