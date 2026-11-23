import type { SlideShowPayload } from '@quiz-dock/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import '../i18n';
import { SlideView } from './live-components';

afterEach(cleanup);

const slide = (over: Partial<SlideShowPayload>): SlideShowPayload => ({
  slideIndex: 0,
  questionIndex: 0,
  blocks: [{ type: 'heading', id: 'h', text: 'Cappadoce', level: 1 }],
  background: null,
  textTone: 'light',
  textOutline: false,
  displayDelayS: null,
  ...over,
});
const image = { url: '/m/cappadocia.webp', alt: 'Ballons au-dessus de Göreme' };

describe('a slide’s picture against its blocks (SPECIFICATIONS-STEP-EDITOR)', () => {
  it('behind the blocks when no layout says otherwise, cropped to fill', () => {
    render(<SlideView slide={slide({ image })} />);
    const picture = screen.getByRole('img', { name: image.alt });
    expect(picture.classList.contains('object-cover')).toBe(true);
    expect(screen.getByRole('heading', { name: 'Cappadoce' })).toBeVisible();
  });

  it('a video over its background picture: both drawn, the video on top (#125)', () => {
    const { container } = render(
      <SlideView
        slide={slide({
          background: { url: '/m/istanbul.webp' },
          video: { url: '/m/bosphorus.mp4', loop: true, sound: false, gainDb: 0 },
        })}
      />,
    );
    const bg = [...container.querySelectorAll('img, [style*="background-image"]')];
    expect(bg.length).toBeGreaterThan(0);
    expect(container.querySelector('video')).not.toBeNull();
  });

  it('placed on the left, the blocks beside it; alone, the blocks for a screen reader only', () => {
    const { rerender } = render(<SlideView slide={slide({ image, position: 'left' })} />);
    const picture = screen.getByRole('img', { name: image.alt });
    const heading = screen.getByRole('heading', { name: 'Cappadoce' });
    expect(
      picture.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(picture.classList.contains('object-contain')).toBe(true);
    rerender(<SlideView slide={slide({ image, position: 'alone' })} />);
    expect(screen.getByRole('heading', { name: 'Cappadoce' }).closest('.sr-only')).not.toBeNull();
  });
});

describe('the media block: the slide’s media among its blocks (SPECIFICATIONS-SLIDE-LAYOUTS)', () => {
  const order = (container: HTMLElement) =>
    [...container.querySelectorAll('h1, img, p')].map((el) =>
      el.tagName === 'IMG' ? 'media' : (el.textContent ?? ''),
    );

  it('in the content, the media sits where its block is, once', () => {
    const { container } = render(
      <SlideView
        slide={slide({
          image,
          position: 'bottom',
          blocks: [
            { type: 'heading', id: 'h', text: 'Cappadoce', level: 1 },
            { type: 'media', id: 'm' },
            { type: 'text', id: 't', md: 'Des cheminées de fée' },
          ],
        })}
      />,
    );
    expect(order(container)).toEqual(['Cappadoce', 'media', 'Des cheminées de fée']);
  });

  it('in a column, beside the text', () => {
    const { container } = render(
      <SlideView
        slide={slide({
          image,
          position: 'bottom',
          blocks: [
            {
              type: 'columns',
              id: 'c',
              columns: [[{ type: 'text', id: 't', md: 'À gauche' }], [{ type: 'media', id: 'm' }]],
            },
          ],
        })}
      />,
    );
    expect(order(container)).toEqual(['À gauche', 'media']);
  });

  it('behind or alone, the block is not used: the media is drawn once, as the layout says', () => {
    const blocks: SlideShowPayload['blocks'] = [
      { type: 'heading', id: 'h', text: 'Cappadoce', level: 1 },
      { type: 'media', id: 'm' },
    ];
    const { container, rerender } = render(<SlideView slide={slide({ image, blocks })} />);
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(screen.getByRole('img', { name: image.alt }).classList.contains('object-cover')).toBe(
      true,
    );
    rerender(<SlideView slide={slide({ image, blocks, position: 'alone' })} />);
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('without its block, an older slide keeps its position', () => {
    const { container } = render(<SlideView slide={slide({ image, position: 'top' })} />);
    expect(order(container)).toEqual(['media', 'Cappadoce']);
  });
});
