import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ShowcaseBackdrop } from '@/components/showcase-backdrop';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { hostSeatControllerState, useHostSeatControllerState } from '../api/generated/auth/auth';
import { ApiError, apiErrorText } from '../api/http';
import { canTrySilentLogin, peekAfterLogin, useAuth } from '../auth/auth-context';

import { SEAT_DEFAULT_EXPIRY, SEAT_EXPIRY_OPTIONS } from '../auth/seat-options';
import { getDemo } from '../config';

/** Connexion animateur : mode local (nom) ou redirection OIDC selon `AUTH_MODE`. */
export function LoginPage() {
  const { t, i18n } = useTranslation(['auth', 'common']);
  const { mode, user, loginLocal, claimHostSeat, dropLocal, loginOidc } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [seatTaken, setSeatTaken] = useState(false);
  const { interactive } = useSearch({ from: '/login' });
  const [redirecting, setRedirecting] = useState(false);
  const triedSilent = useRef(false);
  useEffect(() => {
    if (mode !== 'oidc' || user || interactive || triedSilent.current || !canTrySilentLogin())
      return;
    triedSilent.current = true;
    setRedirecting(true);
    void loginOidc('none').catch(() => setRedirecting(false));
  }, [mode, user, interactive, loginOidc]);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<number>(SEAT_DEFAULT_EXPIRY);
  const demo = getDemo();
  // A participant sent here by the join guard (RG-15): the page is the host area,
  // the reason they are looking at it is not.
  const joining = mode === 'oidc' && (peekAfterLogin()?.startsWith('/join') ?? false);
  // Mode local : qui tient le siège d'hôte (et jusqu'à quand). Affiché avant même
  // de saisir un nom, pour expliquer le verrou.
  const seatQuery = useHostSeatControllerState({ query: { enabled: mode === 'none' } });
  const holder = seatQuery.data?.data.holder ?? null;
  // The seat is this browser's own: nothing to take, only to go back to.
  const mine = !!holder && user === holder;
  const expiresAt = seatQuery.data?.data.expiresAt ?? null;

  const formatUntil = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' });

  const refuse = () => {
    dropLocal();
    setSeatTaken(true);
    void seatQuery.refetch();
  };

  // One step (UI system §4): the name, how long to keep the seat, and take it. A name
  // that already holds the seat simply comes back; a seat taken meanwhile is said.
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || claiming) return;
    setSeatTaken(false);
    setClaimError(null);
    setClaiming(true);
    try {
      const role = await loginLocal(name);
      if (role === 'host' || role === 'admin' || role === null) {
        // Holder of the seat (or the backend unreachable: the API will decide).
        void navigate({ to: '/quizzes' });
        return;
      }
      const state = await hostSeatControllerState().catch(() => null);
      if (state?.data.holder) {
        refuse();
        return;
      }
      await claimHostSeat(expiry === 0 ? null : expiry);
      void navigate({ to: '/quizzes' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) refuse();
      else setClaimError(apiErrorText(err));
    } finally {
      setClaiming(false);
    }
  };

  // Public demo: one shared host account, no seat to claim — just walk in.
  const enterDemo = async () => {
    if (!demo) return;
    await loginLocal(demo.user);
    void navigate({ to: '/quizzes' });
  };

  return (
    <>
      <ShowcaseBackdrop />
      <Card className="content-sm">
        <CardHeader>
          <CardTitle>{joining ? t('login.joinTitle') : t('login.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {mode === 'oidc' ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {joining ? t('login.joinHint') : t('login.oidcHint')}
              </p>
              {/* Leaving for the provider takes a moment: the button says it is on its way. */}
              <Button
                type="button"
                size="lg"
                disabled={redirecting}
                onClick={() => {
                  setRedirecting(true);
                  void loginOidc().catch((err: unknown) => {
                    setRedirecting(false);
                    setClaimError(apiErrorText(err));
                  });
                }}
              >
                {redirecting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t('login.oidcSubmit')}
              </Button>
              {claimError ? (
                <p className="text-sm text-destructive" role="alert">
                  {claimError}
                </p>
              ) : null}
            </div>
          ) : demo ? (
            <div className="flex flex-col gap-4">
              <p className="rounded-md bg-muted p-3 text-sm" role="status">
                {t('login.demoShared', { user: demo.user })}
              </p>
              <Button type="button" onClick={() => void enterDemo()}>
                {t('login.demoEnter')}
              </Button>
            </div>
          ) : (
            <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4 text-left">
              {/* The seat's state first: it says what this page can do. */}
              <div className="flex flex-wrap items-center gap-2 text-sm" role="status">
                {holder ? (
                  <Badge variant="warning">
                    {expiresAt
                      ? t('login.heldUntil', { name: holder, until: formatUntil(expiresAt) })
                      : t('login.held', { name: holder })}
                  </Badge>
                ) : (
                  <>
                    <Badge variant="success">{t('login.free')}</Badge>
                    <span className="text-muted-foreground">{t('login.oneHost')}</span>
                  </>
                )}
              </div>
              {mine ? (
                // The holder is already signed in here: straight back to their quizzes.
                <Link to="/quizzes" className={cn(buttonVariants({ size: 'lg' }))}>
                  {t('landing.continueToQuizzes')} →
                </Link>
              ) : holder ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm">{t('login.takePart', { name: holder })}</p>
                  <Link to="/" className={cn(buttonVariants({ size: 'lg' }))}>
                    {t('login.joinAsParticipant')}
                  </Link>
                  <p className="text-muted-foreground border-t pt-3 text-sm">
                    {t('login.itsMe', { name: holder })}
                  </p>
                </div>
              ) : null}
              {mine ? null : (
                <>
                  <Label htmlFor="name">
                    {t('login.nameLabel')}
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('login.namePlaceholder')}
                      autoFocus={!holder}
                    />
                  </Label>
                  {holder ? null : (
                    <Label htmlFor="seat-expiry">
                      {t('login.keepSeat')}
                      <Select
                        id="seat-expiry"
                        value={expiry}
                        onChange={(e) => setExpiry(Number(e.target.value))}
                      >
                        {SEAT_EXPIRY_OPTIONS.map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {minutes === 0
                              ? t('claim.expiryNever')
                              : t('claim.expiryHours', { count: minutes / 60 })}
                          </option>
                        ))}
                      </Select>
                    </Label>
                  )}
                  <Button
                    type="submit"
                    size={holder ? 'default' : 'lg'}
                    variant={holder ? 'outline' : 'default'}
                    disabled={!name.trim() || claiming}
                  >
                    {claiming ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    {holder ? t('login.signBack') : t('login.takeSeat')}
                  </Button>
                  {claimError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {claimError}
                    </p>
                  ) : null}
                  {seatTaken ? (
                    <p className="text-sm text-destructive" role="alert">
                      {t('login.notHolder')}
                    </p>
                  ) : null}
                </>
              )}
              <p className="text-muted-foreground text-xs">{t('claim.ruleName')}</p>
              <small className="text-muted-foreground">{t('login.localHint')}</small>
            </form>
          )}
        </CardContent>
      </Card>
    </>
  );
}
