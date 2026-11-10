import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import {
  hostSeatControllerClaim,
  hostSeatControllerRelease,
  oidcSessionControllerCallback,
  oidcSessionControllerLogin,
  oidcSessionControllerLogout,
} from '../api/generated/auth/auth';
import { meControllerMe } from '../api/generated/me/me';
import { setAuthHeaders, setSessionAuthed, setUnauthorizedHandler } from '../api/http';
import { getDemo } from '../config';
import { forgetItem, storeItem } from '@/lib/storage';

const STORAGE_KEY = 'live.localUser';
const AFTER_LOGIN_KEY = 'live.afterLogin';
const SILENT_LOGIN_KEY = 'live.silentLoginState';
const SILENT_LOGIN_AT_KEY = 'live.silentLoginAt';
const SIGNED_OUT_KEY = 'live.oidcSignedOut';

/**
 * One silent attempt per browser in this window: every tab a restarted browser
 * restores comes to `/login` at once, and a session refused right after a silent
 * return must not send the page round again.
 */
const SILENT_LOGIN_EVERY_MS = 60_000;

/** The user signed out here: no sign-in comes back without them. */
export function signedOutHere(): boolean {
  try {
    return !!localStorage.getItem(SIGNED_OUT_KEY);
  } catch {
    return true;
  }
}

/**
 * Takes this browser's silent attempt, if it may make one. The mark is read back:
 * a storage that does not keep what it is given could not keep a sign-out either.
 */
export function claimSilentLogin(now = Date.now()): boolean {
  try {
    if (signedOutHere() || !window.sessionStorage) return false;
    const last = Number(localStorage.getItem(SILENT_LOGIN_AT_KEY));
    if (last && now - last < SILENT_LOGIN_EVERY_MS && last <= now) return false;
    localStorage.setItem(SILENT_LOGIN_AT_KEY, String(now));
    return localStorage.getItem(SILENT_LOGIN_AT_KEY) === String(now);
  } catch {
    return false;
  }
}

export function takeSilentLogin(state: string | null): boolean {
  try {
    if (!state || sessionStorage.getItem(SILENT_LOGIN_KEY) !== state) return false;
    sessionStorage.removeItem(SILENT_LOGIN_KEY);
    return true;
  } catch {
    return false;
  }
}

export type AuthMode = 'none' | 'oidc';
export type UserRole = 'host' | 'player' | 'admin';

// État hors-React, lu par la garde de route (synchrone) et configuré au démarrage.
let currentMode: AuthMode = 'none';
let oidcAuthed = false;

/** Configure le mode + l'état OIDC restauré (appelé par main.tsx avant le rendu). */
export function configureAuth(mode: AuthMode, oidcUserAuthed = false): void {
  currentMode = mode;
  oidcAuthed = oidcUserAuthed;
  setSessionAuthed(mode === 'oidc' && oidcUserAuthed);
}

/** How often a signed-in page reminds the backend of its session (well under a provider's idle timeout). */
const KEEP_ALIVE_MS = 4 * 60_000;

/** Tells the other tabs of this browser that the session began or is over. */
const SIGN_OUT_CHANNEL = 'quizdock-auth';

function broadcast(message: 'signed-in' | 'signed-out'): void {
  try {
    const channel = new BroadcastChannel(SIGN_OUT_CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch {
    // No BroadcastChannel: the other tabs find out at their next request (401).
  }
}

/**
 * Suit la session OIDC (mode oidc) : le backend la tient, le navigateur n'a qu'un
 * cookie `httpOnly`. Un 401 du backend (session finie ou refusée par le
 * fournisseur) ou une déconnexion dans un autre onglet ramène à la connexion, et
 * la page quittée attend la connexion suivante. Une connexion dans un autre onglet
 * fait repartir celui qui attendait à la connexion vers sa page.
 */
export function bindOidcSession(): void {
  const dropSession = () => {
    oidcAuthed = false;
    setSessionAuthed(false);
    const { pathname, search, hash } = window.location;
    if (pathname !== '/login') {
      rememberAfterLogin(pathname + search + hash);
      window.location.assign('/login');
    }
  };
  setUnauthorizedHandler(dropSession);
  // The backend renews the tokens when a request comes: a console left in a
  // background tab through a long game (the socket alone talks) would otherwise
  // let the provider's session lapse. Hidden tabs included, on purpose.
  window.setInterval(() => {
    if (oidcAuthed) void meControllerMe().catch(() => undefined);
  }, KEEP_ALIVE_MS);
  try {
    new BroadcastChannel(SIGN_OUT_CHANNEL).onmessage = (e) => {
      if (e.data === 'signed-out' && oidcAuthed) dropSession();
      if (e.data === 'signed-in' && !oidcAuthed && window.location.pathname === '/login') {
        window.location.assign(takeAfterLogin() ?? '/quizzes');
      }
    };
  } catch {
    // See broadcastSignOut.
  }
}

/**
 * Tokens an earlier version kept in this browser's storage (`oidc-client-ts`):
 * nothing reads them any more, and they must not linger — a token is exactly
 * what the move to a server-side session keeps away from scripts.
 */
export function forgetStoredTokens(): void {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      // Reading the property itself throws when site data is blocked.
      const store = window[name];
      // By the Storage API (`key(i)`): not every implementation lists its keys as properties.
      const keys = Array.from({ length: store.length }, (_, i) => store.key(i));
      for (const key of keys) {
        if (key?.startsWith('oidc.')) store.removeItem(key);
      }
    } catch {
      // Storage disabled: there is nothing in it either.
    }
  }
}

/** Identité locale (mode none) — utilisée aussi par la garde. */
export function getLocalUser(): string | null {
  let stored: string | null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage disabled: no local identity kept
  }
  // A demo serves one shared account whatever the name: a name kept from before
  // would only show the wrong one in the menu.
  const demo = getDemo();
  if (stored && demo && stored !== demo.user) {
    storeItem(STORAGE_KEY, demo.user);
    return demo.user;
  }
  return stored;
}

/**
 * Page the sign-in was triggered from (a participant sent to `/login` by the
 * guard, RG-15, a host by a guarded page or an ended session). Kept for the round
 * trip to the IdP only — the callback reads it once and falls back to the
 * dashboard, which is where an host lands.
 */
export function rememberAfterLogin(path: string): void {
  try {
    sessionStorage.setItem(AFTER_LOGIN_KEY, path);
  } catch {
    // Private browsing / storage disabled: the callback simply goes to its default.
  }
}

/** Same, without consuming it: the login page adapts its wording to it. */
export function peekAfterLogin(): string | null {
  try {
    return sessionStorage.getItem(AFTER_LOGIN_KEY);
  } catch {
    return null;
  }
}

export function takeAfterLogin(): string | null {
  try {
    const path = sessionStorage.getItem(AFTER_LOGIN_KEY);
    sessionStorage.removeItem(AFTER_LOGIN_KEY);
    // Internal paths only: never send the browser somewhere a crafted link chose.
    return path && path.startsWith('/') && !path.startsWith('//') ? path : null;
  } catch {
    return null;
  }
}

/** Garde de route synchrone : l'utilisateur est-il authentifié ? */
export function isAuthenticated(): boolean {
  return currentMode === 'oidc' ? oidcAuthed : !!getLocalUser();
}

export function getAuthMode(): AuthMode {
  return currentMode;
}

function applyLocalUser(name: string | null): void {
  setAuthHeaders(name ? { 'X-Local-User': name } : {});
}

/**
 * Rôles côté backend de l'identité courante (`GET /me`), ou `null` si injoignable.
 * En mode local, le **siège d'hôte** en décide : qui l'a pris (explicitement, depuis
 * la page de connexion) est `host`, les autres restent participants. L'ensemble peut porter les
 * deux rôles (RG-14) ; la page de connexion ne regarde que « puis-je animer ? ».
 */
export async function fetchRole(): Promise<UserRole | null> {
  try {
    const { data } = await meControllerMe();
    const roles = (data.roles ?? []) as UserRole[];
    if (roles.includes('host')) return 'host';
    if (roles.includes('admin')) return 'admin';
    return 'player';
  } catch {
    return null;
  }
}

interface AuthState {
  mode: AuthMode;
  user: string | null;
  /**
   * Connexion mode local (nom). Résout le rôle courant : `host` = titulaire du
   * siège d'hôte, `player` = pas (encore) titulaire, `null` = backend injoignable.
   * L'identité reste posée ; la page décide (prise du siège ou `dropLocal`).
   */
  loginLocal: (name: string) => Promise<UserRole | null>;
  /** Prise **intentionnelle** du siège d'hôte (mode local), après confirmation. */
  claimHostSeat: (expiresInMinutes: number | null) => Promise<void>;
  /** Abandonne l'identité locale sans passer par le backend (siège refusé / annulé). */
  dropLocal: () => void;
  /** Connexion mode OIDC (redirection vers le fournisseur, préparée par le backend). */
  loginOidc: (prompt?: 'none') => Promise<void>;
  /** Finalise le retour du fournisseur (route /auth/callback) : le backend échange le code. */
  completeOidcLogin: (params: URLSearchParams) => Promise<void>;
  logout: () => void | Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({
  children,
  mode = 'none',
  initialUser = null,
}: {
  children: ReactNode;
  mode?: AuthMode;
  initialUser?: string | null;
}) {
  // Another identity, or other rights (the host seat): nothing read for the one before
  // is kept, and what is on screen is read again at once.
  const queryClient = useQueryClient();
  const forgetReads = useCallback(() => void queryClient.resetQueries(), [queryClient]);
  const [user, setUser] = useState<string | null>(() => {
    if (mode === 'oidc') return initialUser;
    const stored = getLocalUser();
    applyLocalUser(stored); // synchrone, avant tout rendu enfant
    return stored;
  });

  const loginLocal = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      storeItem(STORAGE_KEY, trimmed);
      applyLocalUser(trimmed);
      setUser(trimmed);
      forgetReads();
      return fetchRole();
    },
    [forgetReads],
  );

  const claimHostSeat = useCallback(
    async (expiresInMinutes: number | null) => {
      await hostSeatControllerClaim({ expiresInMinutes });
      forgetReads();
    },
    [forgetReads],
  );

  const dropLocal = useCallback(() => {
    // Pas d'identité conservée : sinon la garde de route et la nav la
    // traiteraient comme un hôte connecté.
    forgetItem(STORAGE_KEY);
    applyLocalUser(null);
    setUser(null);
    forgetReads();
  }, [forgetReads]);

  const loginOidc = useCallback(async (prompt?: 'none') => {
    const { data } = await oidcSessionControllerLogin(prompt ? { prompt } : undefined);
    if (!data.url) throw new Error('Missing provider authorization URL.');
    if (prompt) {
      const state = new URL(data.url).searchParams.get('state');
      if (!state) throw new Error('Silent sign-in unavailable.');
      sessionStorage.setItem(SILENT_LOGIN_KEY, state);
      // Out of the history: Back from the provider (or its error page, unreachable)
      // returns to where the user was, never to a page that leaves again.
      window.location.replace(data.url);
      return;
    }
    window.location.assign(data.url);
  }, []);

  const completeOidcLogin = useCallback(
    async (params: URLSearchParams) => {
      const code = params.get('code');
      const state = params.get('state');
      if (!code || !state)
        throw new Error(params.get('error_description') ?? params.get('error') ?? 'OIDC');
      const iss = params.get('iss') ?? undefined;
      const { data } = await oidcSessionControllerCallback({ code, state, iss });
      forgetItem(SIGNED_OUT_KEY);
      oidcAuthed = true;
      setSessionAuthed(true);
      setUser(data && 'name' in data ? data.name : null);
      forgetReads();
      broadcast('signed-in');
    },
    [forgetReads],
  );

  const logout = useCallback(async () => {
    if (mode === 'oidc') {
      storeItem(SIGNED_OUT_KEY, '1');
      oidcAuthed = false;
      setSessionAuthed(false);
      setUser(null);
      broadcast('signed-out');
      // The backend ends its session, then the provider's (RP-initiated logout,
      // when it has an end-session endpoint).
      const url = await oidcSessionControllerLogout()
        .then(({ data }) => data.url)
        .catch(() => null);
      window.location.assign(url ?? '/');
      return;
    } else {
      // Rend le siège d'hôte (no-op si on ne le tenait pas) avant d'oublier l'identité.
      await hostSeatControllerRelease().catch(() => undefined);
      forgetItem(STORAGE_KEY);
    }
    applyLocalUser(null);
    setUser(null);
    forgetReads();
  }, [mode, forgetReads]);

  const value = useMemo(
    () => ({
      mode,
      user,
      loginLocal,
      claimHostSeat,
      dropLocal,
      loginOidc,
      completeOidcLogin,
      logout,
    }),
    [mode, user, loginLocal, claimHostSeat, dropLocal, loginOidc, completeOidcLogin, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth doit être utilisé dans <AuthProvider>.');
  }
  return ctx;
}
