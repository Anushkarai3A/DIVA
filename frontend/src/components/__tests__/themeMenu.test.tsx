import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { QmsNavbar } from '../layout/QmsNavbar';
import { renderWithProviders } from '../../test/render';
import { getTheme, setTheme, THEME_STORAGE_KEY } from '../../lib/theme';

function renderNavbar() {
  return renderWithProviders(<QmsNavbar />);
}

describe('theme controls in the MH menu', () => {
  beforeEach(() => {
    localStorage.clear();
    if (getTheme() !== 'light') setTheme('light');
  });

  it('shows Appearance with Light, Dark, and System options', async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByTestId('user-menu-button'));

    expect(screen.getByTestId('appearance-toggle')).toHaveAttribute('aria-expanded', 'true');
    const group = screen.getByTestId('appearance-options');
    expect(within(group).getByText('Light')).toBeInTheDocument();
    expect(within(group).getByText('Dark')).toBeInTheDocument();
    expect(within(group).getByText('System')).toBeInTheDocument();
    expect(within(group).getByTestId('theme-light')).toHaveAttribute('aria-checked', 'true');
    expect(within(group).getByTestId('theme-dark')).toHaveAttribute('aria-checked', 'false');
    expect(within(group).getByTestId('theme-system')).toHaveAttribute('aria-checked', 'false');
  });

  it('applies and persists Dark from the menu', async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByTestId('user-menu-button'));
    await user.click(screen.getByTestId('theme-dark'));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByTestId('theme-dark')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('theme-light')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('user-menu')).toBeInTheDocument();
  });

  it('applies Light from the menu', async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByTestId('user-menu-button'));
    await user.click(screen.getByTestId('theme-dark'));
    await user.click(screen.getByTestId('theme-light'));

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(screen.getByTestId('theme-light')).toHaveAttribute('aria-checked', 'true');
  });

  it('applies System from the menu', async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByTestId('user-menu-button'));
    await user.click(screen.getByTestId('theme-system'));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe('system');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(screen.getByTestId('theme-system')).toHaveAttribute('aria-checked', 'true');
  });

  it('keeps the Settings panel synchronized with the menu', async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByTestId('user-menu-button'));
    await user.click(screen.getByTestId('theme-dark'));
    await user.keyboard('{Escape}');

    await user.click(screen.getByTestId('user-menu-button'));
    await user.click(screen.getByTestId('user-settings'));

    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    expect(within(dialog).getByTestId('theme-option-dark')).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).getByTestId('theme-option-light')).toHaveAttribute(
      'aria-checked',
      'false',
    );

    await user.click(within(dialog).getByTestId('theme-option-light'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    await user.click(screen.getByTestId('settings-close'));

    await user.click(screen.getByTestId('user-menu-button'));
    expect(screen.getByTestId('theme-light')).toHaveAttribute('aria-checked', 'true');
  });
});
