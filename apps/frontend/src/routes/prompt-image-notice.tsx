import { type QuestionMedia } from '@quiz-dock/contracts';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { promptImage } from '@/lib/prompt-image';
import { mediaControllerDescribe, mediaControllerSetAlt } from '../api/generated/media/media';

/**
 * An image written in the prompt (images are no longer added there, one already
 * there still shows): while the question has no visual, the editor offers to move
 * it to the question's media — framed on every screen, zoomable on the phones and
 * fetched ahead. The author decides, sees the result, and can cancel before saving.
 */
export function PromptImageNotice({
  prompt,
  media,
  onMove,
}: {
  prompt: string;
  media: QuestionMedia;
  onMove: (rest: string, media: QuestionMedia) => void;
}) {
  const { t } = useTranslation('editor');
  const found = media.visual ? null : promptImage(prompt);
  if (!found) return null;
  const move = () => {
    onMove(found.rest, {
      visual: { kind: 'image', assetId: found.mediaId },
      audio: media.audio,
    } as QuestionMedia);
    // Its description travels with it, when the media has none yet.
    if (found.alt.trim()) {
      void mediaControllerDescribe(found.mediaId)
        .then((res) =>
          res.data.alt ? null : mediaControllerSetAlt(found.mediaId, { alt: found.alt.trim() }),
        )
        .catch(() => undefined);
    }
  };
  return (
    <div
      role="note"
      className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
    >
      <ImageIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{t('questionForm.promptImageNotice')}</span>
      <Button type="button" size="sm" variant="outline" onClick={move}>
        {t('questionForm.promptImageMove')}
      </Button>
    </div>
  );
}
