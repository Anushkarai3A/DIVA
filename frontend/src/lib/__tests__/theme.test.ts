import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTheme, setTheme, THEME_STORAGE_KEY } from '../theme';

interface MediaStub {
  setDark: (value: boolean) => void;
  fire: () => void;
}

function stubMatchMedia(initialDark: boolean): MediaStub {
  const state = { dark: initialDark };
  const listeners: Array<(event: { matches: boolean }) => void> = [];
  const mql = {
    get matches() {
      return state.dark;
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_type: string, cb: (event: { matches: boolean }) => void) => {
      listeners.push(cb);
    },
    removeEventListener: (_type: string, cb: (event: { matches: boolean }) => void) => {
      const index = listeners.indexOf(cb);
      if (index >= 0) listeners.splice(index, 1);
    },
    addListener: (cb: (event: { matches: boolean }) => void) => {
      listeners.push(cb);
    },
    removeListener: (cb: (event: { matches: boolean }) => void) => {
      const index = listeners.indexOf(cb);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
  window.matchMedia = vi.fn().mockImplementation(() => mql) as unknown as typeof window.matchMedia;
  return {
    setDark: (value: boolean) => {
      state.dark = value;
    },
    fire: () => {
      listeners.slice().forEach((listener) => listener({ matches: state.dark }));
    },
  };
}

describe('theme system', () => {
  beforeEach(() => {
    localStorage.clear();
    if (getTheme() !== 'light') setTheme('light');
    document.documentElement.classList.remove('dark');
  });

  it('defaults to light', () => {
    expect(getTheme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('applies and persists the dark theme', () => {
    setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('returns to light', () => {
    setTheme('dark');
    setTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('system theme follows the OS preference', () => {
    stubMatchMedia(true);
    setTheme('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('system theme stays light when the OS prefers light', () => {
    stubMatchMedia(false);
    setTheme('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe('system');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('reacts to OS theme changes while System is selected', () => {
    const stub = stubMatchMedia(false);
    setTheme('system');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    stub.setDark(true);
    stub.fire();
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    stub.setDark(false);
    stub.fire();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('restores the persisted theme when the application loads', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    vi.resetModules();
    await import('../theme');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
  });
});
