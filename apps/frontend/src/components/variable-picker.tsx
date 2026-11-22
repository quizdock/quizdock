import { QUIZ_VARIABLES, ROOM_VARIABLES, type SlideVariable } from '@quiz-dock/contracts';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { MenuItem } from '@/components/ui/menu-item';
import { Popover } from '@/components/ui/popover';
import { VariablesContext } from '@/lib/variables';

/** The variables in the picker: the quiz's, then the room's. */
const VARIABLE_GROUPS: { group: 'quiz' | 'room'; names: readonly SlideVariable[] }[] = [
  { group: 'quiz', names: QUIZ_VARIABLES },
  { group: 'room', names: ROOM_VARIABLES },
];

/**
 * The variables a field may hold (a slide's heading or text, a question's prompt),
 * offered from its bar: each with what it reads here (the surrounding `VariablesContext`:
 * the quiz's in the editor), else what it becomes once played; the one picked is
 * written where the caret is.
 */
export function VariablePicker({ onPick }: { onPick: (variable: string) => void }) {
  const { t } = useTranslation('editor');
  const values = useContext(VariablesContext);
  return (
    <Popover
      className="w-80 p-2"
      trigger={({ open, toggle }) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 font-mono text-xs"
          aria-label={t('slideForm.variablesInsert')}
          title={t('slideForm.variablesInsert')}
          aria-expanded={open}
          onClick={toggle}
        >
          {'{…}'}
        </Button>
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground px-2 pb-1 text-xs">{t('slideForm.variablesHint')}</p>
          <div className="max-h-72 overflow-y-auto">
            {VARIABLE_GROUPS.map(({ group, names }) => (
              <div key={group} role="group" aria-label={t(`slideForm.variablesGroup.${group}`)}>
                <p className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-semibold">
                  {t(`slideForm.variablesGroup.${group}`)}
                </p>
                {names.map((name) => (
                  <MenuItem
                    key={name}
                    onClick={() => {
                      close();
                      onPick(`{${name}}`);
                    }}
                  >
                    <code className="bg-muted shrink-0 rounded px-1">{`{${name}}`}</code>
                    {/* What it reads here; the room's, known only once played, are described. */}
                    {values[name] != null && String(values[name]) !== '' ? (
                      <span className="truncate">{String(values[name])}</span>
                    ) : (
                      <span className="text-muted-foreground truncate">
                        {t(`slideForm.variables.${name}`)}
                      </span>
                    )}
                  </MenuItem>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}
