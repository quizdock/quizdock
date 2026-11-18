import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StepTimeline } from './step-timeline';
import { questionTimeline, slideTimeline } from './step-timeline-model';

describe('StepTimeline', () => {
  it('says the minimum and what the media stretch it to, and names each element', () => {
    render(
      <StepTimeline
        model={questionTimeline({
          timeLimitS: 20,
          listenFirst: false,
          visual: 'image',
          audio: { peaks: new Array(200).fill(0.5) },
          mediaMs: 30_000,
          tailS: 1,
          readMs: 3000,
        })}
      />,
    );
    expect(screen.getByText('20 s → 28 s')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Image, toute la durée' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Son, 30 s' })).toBeInTheDocument();
  });

  it('a slide moved on by hand has no end of its own', () => {
    render(
      <StepTimeline
        model={slideTimeline({
          displayDelayS: 0,
          defaultS: 5,
          background: false,
          video: null,
          audio: null,
          tailS: 1,
        })}
      />,
    );
    expect(screen.getAllByText('Manuel').length).toBeGreaterThan(0);
  });
});
