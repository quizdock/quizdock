import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/**
 * Asks before a quiz is archived, wherever it is (its card's ⋮, the editor's): what it
 * costs, as restoring it brings it back as a draft, to publish again.
 */
export function ArchiveQuizDialog({
  title,
  onConfirm,
  onCancel,
}: {
  /** The quiz to archive, by its title; none: closed. */
  title: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('editor');
  return (
    <ConfirmDialog
      open={title !== null}
      title={t('archiveConfirm.title')}
      description={t('archiveConfirm.description', { title: title ?? '' })}
      confirmLabel={t('archiveConfirm.confirmLabel')}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
