import { useSyncExternalStore } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'diva-theme';

const listeners = new Set<() => void>();
let current: ThemeChoice = readStoredTheme();
let mediaQuery: MediaQueryList | null = null;
let animTimer: number | null = null;

function readStoredTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* storage unavailable */
  }
  return 'light';
}

function systemPrefersDark(): boolean {
  try {
    return typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
  } catch {
    return false;
  }
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return choice;
}

function animateThemeSwitch() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.add('theme-anim');
  if (animTimer !== null) window.clearTimeout(animTimer);
  animTimer = window.setTimeout(() => {
    root.classList.remove('theme-anim');
    animTimer = null;
  }, 220);
}

function applyTheme() {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(current);
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.dataset.theme = current;

  if (typeof window.matchMedia !== 'function') return;
  try {
    mediaQuery?.removeEventListener('change', onSystemChange);
    mediaQuery = null;
    if (current === 'system') {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', onSystemChange);
    }
  } catch {
    /* matchMedia listeners unavailable */
  }
}

function onSystemChange() {
  if (current !== 'system') return;
  animateThemeSwitch();
  applyTheme();
  listeners.forEach((listener) => listener());
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function getTheme(): ThemeChoice {
  return current;
}

export function setTheme(choice: ThemeChoice) {
  if (choice === current) return;
  animateThemeSwitch();
  current = choice;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    /* storage unavailable */
  }
  applyTheme();
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, getTheme);
  return { theme, setTheme, resolved: resolveTheme(theme) };
}

applyTheme();
