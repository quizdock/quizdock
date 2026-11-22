import type { SlideVariable } from '@quiz-dock/contracts';
import { createContext } from 'react';

export type VariableValues = Partial<Record<SlideVariable, string | number | null>>;

/**
 * What the variables a text may hold (`{title}`, `{pin}`…) read where it shows: the
 * quiz's in the editor, the room's on a live screen (the quiz's came filled from the
 * server). Rendered Markdown fills the ones known; without a provider all stay as
 * written. The editor's own fields always keep them as written.
 */
export const VariablesContext = createContext<VariableValues>({});
