import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { type SlideMediaValue, SlideTimelineSection } from './slide-timeline-section';

// The upload itself has its own tests: here, a button standing for the pick.
vi.mock('./media-upload', () => ({
  MediaUpload: ({
    kind,
    value,
    onChange,
  }: {
    kind: string;
    value: string | null;
    onChange: (id: string | null, uploaded?: { peaks?: number[] }) => void;
  }) => (
    <button type="button" data-testid={`upload-${kind}`} onClick={() => onChange(`${kind}-id`, {})}>
      {value ?? 'empty'}
    </button>
  ),
}));
// Every media lasts 12 s.
vi.mock('../api/generated/media/media', () => ({
  mediaControllerDescribe: () => Promise.resolve({ data: { durationMs: 12_000 } }),
}));

afterEach(cleanup);

const base: SlideMediaValue = {
  imageMediaId: null,
  videoMediaId: null,
  mediaPosition: 'behind',
  mediaStyle: {},
  videoLoop: true,
  videoSound: true,
  audioMediaId: null,
  waveformSize: 'hidden',
  audioTarget: null,
  displayDelayS: null,
};

const open = (value: SlideMediaValue, onChange = vi.fn()) => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SlideTimelineSection
        value={value}
        onChange={onChange}
        peaks={null}
        onPeaks={vi.fn()}
        defaultS={5}
        mediaTailS={1}
      />
    </QueryClientProvider>,
  );
  return onChange;
};
/** The + of the timeline: its modal, to query within. */
const add = () => {
  fireEvent.click(screen.getByRole('button', { name: i18n.t('editor:timeline.add') }));
  return within(screen.getByRole('dialog', { name: i18n.t('editor:timeline.add') }));
};

describe('SlideTimelineSection (#125)', () => {
  it('a video with its sound: the + refuses a sound, and says why', () => {
    open({ ...base, videoMediaId: 'v' });
    const modal = add();
    const audio = modal.getByRole('button', { name: /^Audio/ });
    expect(audio).toBeDisabled();
    expect(audio).toHaveTextContent(i18n.t('editor:timeline.refused.slideVideoSound'));
    expect(modal.getByRole('button', { name: /^Vidéo/ })).toBeDisabled();
  });

  it('a video picked next to a sound comes muted: one sound at a time', () => {
    const onChange = open({ ...base, audioMediaId: 'a' });
    fireEvent.click(add().getByRole('button', { name: /^Vidéo/ }));
    fireEvent.click(screen.getByTestId('upload-video'));
    expect(onChange).toHaveBeenCalledWith({ videoMediaId: 'video-id', videoSound: false });
  });

  it("a muted video's sound cannot be turned on while the slide has one", async () => {
    open({ ...base, videoMediaId: 'v', videoLoop: false, videoSound: false, audioMediaId: 'a' });
    fireEvent.click(await screen.findByRole('button', { name: 'Vidéo, 12 s, sans son' }));
    const sound = screen.getByRole('checkbox', {
      name: new RegExp(`^${i18n.t('editor:slideForm.videoSound')}`),
    });
    expect((sound as HTMLInputElement).disabled).toBe(true);
  });

  it('back to the slide’s defaults, once confirmed: no media, the default display', () => {
    const onChange = open({ ...base, audioMediaId: 'a', displayDelayS: 12 });
    fireEvent.click(
      screen.getByRole('button', {
        name: i18n.t('editor:timeline.reset', { type: i18n.t('editor:timeline.slideKind') }),
      }),
    );
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('editor:timeline.resetConfirm.confirm') }),
    );
    expect(onChange).toHaveBeenCalledWith({
      imageMediaId: null,
      videoMediaId: null,
      audioMediaId: null,
      displayDelayS: null,
      mediaPosition: 'behind',
      mediaStyle: {},
    });
  });

  it('a picture or a video, not both; the layouts wait for one (SPECIFICATIONS-STEP-EDITOR)', () => {
    const onChange = open({ ...base, imageMediaId: 'img' });
    const modal = add();
    expect(modal.getByRole('button', { name: /^Vidéo/ })).toHaveTextContent(
      i18n.t('editor:timeline.refused.oneSlideVisual'),
    );
    expect(modal.getByRole('button', { name: /^Image/ })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog', { name: i18n.t('editor:timeline.add') }), {
      key: 'Escape',
    });
    // Behind the blocks by default; another layout applied from its modal.
    fireEvent.click(screen.getByRole('button', { name: i18n.t('editor:timeline.layout') }));
    const layouts = within(screen.getByRole('dialog', { name: i18n.t('editor:timeline.layout') }));
    fireEvent.click(
      layouts.getByRole('button', { name: i18n.t('editor:questionForm.mediaPosition.left') }),
    );
    fireEvent.click(layouts.getByRole('button', { name: i18n.t('editor:timeline.layoutApply') }));
    expect(onChange).toHaveBeenCalledWith({ mediaPosition: 'left' });
  });

  it('without a picture nor a video, the layouts say why they wait', () => {
    open(base);
    expect(
      screen.getByRole('button', { name: i18n.t('editor:timeline.layoutNeedsVisual') }),
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('nothing to clear nor reset on an empty slide', () => {
    open(base);
    expect(screen.queryByRole('button', { name: i18n.t('editor:timeline.clear') })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Revenir aux valeurs par défaut/ })).toBeNull();
  });

  it('clearing, once confirmed, takes the video and the sound away', () => {
    const onChange = open({ ...base, videoMediaId: 'v', audioMediaId: 'a' });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('editor:timeline.clear') }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: i18n.t('editor:timeline.clearConfirm.confirm') }),
    );
    expect(onChange).toHaveBeenCalledWith({
      imageMediaId: null,
      videoMediaId: null,
      audioMediaId: null,
    });
  });
});
