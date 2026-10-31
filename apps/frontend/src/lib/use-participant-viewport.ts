import { useEffect, useState } from 'react';

/**
 * The keyboard can shrink only the visual viewport, leaving `dvh` unchanged.
 * Fit the participant frame to that available height. Ignore pinch zoom: it must
 * magnify the existing layout, not make the game reflow with every gesture.
 * Without this API the shell uses its CSS dynamic viewport height.
 */
export function useParticipantViewport(active: boolean): number | undefined {
  const [height, setHeight] = useState<number>();
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!active || !viewport) return;
    const update = () => {
      if (viewport.scale === 1) setHeight(viewport.height);
    };
    update();
    viewport.addEventListener('resize', update);
    return () => viewport.removeEventListener('resize', update);
  }, [active]);
  return active ? height : undefined;
}
