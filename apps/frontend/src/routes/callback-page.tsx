import { Link, useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorText } from '../api/http';
import { signedOutHere, takeAfterLogin, takeSilentLogin, useAuth } from '../auth/auth-context';

/** One exchange per return from the provider: its code and state are good once. */
let pending: { search: string; declined: boolean; done: Promise<void> } | null = null;

/** What a provider answers `prompt=none` when it needs the user (OIDC Core §3.1.2.6). */
const NEEDS_THE_USER = new Set([
  'login_required',
  'interaction_required',
  'consent_required',
  'account_selection_required',
]);

/**
 * Retour du fournisseur OIDC : le backend échange le code et ouvre la session
 * (cookie), puis on va au tableau de bord — ou à la page d'où venait la
 * connexion (un participant renvoyé vers `/login` depuis `/join/...`, RG-15).
 */
export function CallbackPage() {
  const { t } = useTranslation(['auth', 'common']);
  const { completeOidcLogin, loginOidc } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const search = window.location.search;
    // StrictMode runs effects twice: the second run waits for the first exchange.
    if (pending?.search !== search) {
      const params = new URLSearchParams(search);
      const silent = takeSilentLogin(params.get('state'));
      // A silent attempt the provider declines, or one the user signed out of
      // meanwhile (another tab), ends on the sign-in button; any other failure says so.
      const declined = silent && (NEEDS_THE_USER.has(params.get('error') ?? '') || signedOutHere());
      pending = {
        search,
        declined,
        done: declined ? Promise.reject(new Error('OIDC')) : completeOidcLogin(params),
      };
    }
    const { done, declined } = pending;
    let active = true;
    void done
      .then(() => {
        if (active) {
          return navigate({ to: (takeAfterLogin() ?? '/quizzes') as '/quizzes', replace: true });
        }
      })
      .catch((e: unknown) => {
        if (!active) return;
        if (declined) {
          void navigate({ to: '/login', search: { interactive: true }, replace: true });
        } else {
          setError(apiErrorText(e, t('callback.failed')));
        }
      });
    return () => {
      active = false;
    };
  }, [completeOidcLogin, navigate, t]);

  if (!error) {
    return (
      <p className="text-muted-foreground flex items-center justify-center gap-2 py-12">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t('callback.loading')}
      </p>
    );
  }
  // Never a dead end: try again, or go back where one started.
  return (
    <Card className="content-sm">
      <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
        <p className="font-semibold">{t('callback.errorTitle')}</p>
        <p className="text-muted-foreground text-sm" role="alert">
          {error}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/" className={cn(buttonVariants({ variant: 'outline' }))}>
            {t('callback.backHome')}
          </Link>
          <Button type="button" onClick={() => void loginOidc()}>
            {t('callback.tryAgain')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
