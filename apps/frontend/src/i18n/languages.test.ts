import { afterEach, describe, expect, it, vi } from 'vitest';

describe('supportedLngs', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('offers the released languages only, by default', async () => {
    const { supportedLngs } = await import('./languages');
    expect(supportedLngs).toContain('fr');
    expect(supportedLngs).not.toContain('et');
  });

  it('offers the locales in progress too on a translation staging', async () => {
    vi.stubEnv('VITE_LOCALES_IN_PROGRESS', 'all');
    const { supportedLngs } = await import('./languages');
    expect(supportedLngs).toContain('fr');
    expect(supportedLngs).toContain('et');
  });
});
