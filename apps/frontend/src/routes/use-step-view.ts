import type { StepView } from '@quiz-dock/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  getMeControllerGetPreferencesQueryKey,
  meControllerUpdatePreferences,
  useMeControllerGetPreferences,
} from '../api/generated/me/me';

/**
 * How the builder shows a step's media, timeline or list: the account's choice
 * (`stepView`), so it follows the person wherever they sign in. Unreadable, the
 * timeline; a choice that fails to save still holds for this page.
 */
export function useStepView(): [StepView, (view: StepView) => void] {
  const queryClient = useQueryClient();
  const { data } = useMeControllerGetPreferences({ query: { staleTime: Infinity, retry: false } });
  // Chosen here: holds even when the preferences could not be read.
  const [chosen, setChosen] = useState<StepView | null>(null);
  const view = chosen ?? data?.data.stepView ?? 'timeline';
  const setView = (next: StepView) => {
    setChosen(next);
    const key = getMeControllerGetPreferencesQueryKey();
    queryClient.setQueryData(key, (old: typeof data) =>
      old ? { ...old, data: { ...old.data, stepView: next } } : old,
    );
    void meControllerUpdatePreferences({ stepView: next }).catch(() => undefined);
  };
  return [view, setView];
}
