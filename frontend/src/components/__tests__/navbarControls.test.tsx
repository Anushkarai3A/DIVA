import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { QmsNavbar } from '../layout/QmsNavbar';
import { makeStore, renderWithProviders } from '../../test/render';

function renderNavbar(demoMode = true) {
  return renderWithProviders(<QmsNavbar />, { store: makeStore({ demoMode }) });
}

describe('Company selector', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('opens the dropdown with the company list and the current company checked', async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByTestId('company-selector'));

    const menu = screen.getByTestId('company-menu');
    expect(within(menu).getByText('Company')).toBeInTheDocument();
    const options = within(menu).getAllByTestId('company-option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Vasudha Pharma Chem Limited');
    expect(options[1]).toHaveTextContent('DIVA Demo Organization');
    expect(options[0]).toHaveAttribute('aria-checked', 'true');
    expect(options[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('selecting another company updates the navbar, closes the menu, and persists', async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByTestId('company-selector'));
    await user.click(
      within(screen.getByTestId('company-menu')).getByRole('menuitemradio', {
        name: /DIVA Demo Organization/,
      }),
    );

    expect(screen.queryByTestId('company-menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('company-selector')).toHaveTextContent('DIVA Demo Organization');
    expect(sessionStorage.getItem('diva-company')).toBe('DIVA Demo Organization');
  });

  it('closes on outside click and on Escape', async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByTestId('company-selector'));
    expect(screen.getByTestId('company-menu')).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByTestId('company-menu')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('company-selector'));
    expect(screen.getByTestId('company-menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('company-menu')).not.toBeInTheDocument();
  });

  it('restores the stored company during the session', () => {
    sessionStorage.setItem('diva-company', 'DIVA Demo Organization');
    renderNavbar();
    expect(screen.getByTestId('company-selector')).toHaveTextContent('DIVA Demo Organization');
  });
});

describe('User menu', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('opens the menu with Profile, Settings, and Appearance only', async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByTestId('user-menu-button'));

    const menu = screen.getByTestId('user-menu');
    expect(within(menu).getByText('MH')).toBeInTheDocument();
    expect(within(menu).getByText('Quality User')).toBeInTheDocument();
    expect(within(menu).getByTestId('user-profile')).toBeInTheDocument();
    expect(within(menu).getByTestId('user-settings')).toBeInTheDocument();
    expect(within(menu).getByTestId('appearance-toggle')).toBeInTheDocument();
    expect(within(menu).queryByTestId('user-signout')).not.toBeInTheDocument();
    expect(within(menu).queryByText('Sign out')).not.toBeInTheDocument();
  });

  it('closes on outside click and on Escape', async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByTestId('user-menu-button'));
    expect(screen.getByTestId('user-menu')).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('user-menu-button'));
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument();
  });

  it('opens the profile panel with user details', async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByTestId('user-menu-button'));
    await user.click(screen.getByTestId('user-profile'));

    expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument();
    const dialog = await screen.findByRole('dialog', { name: 'Profile' });
    expect(within(dialog).getByTestId('profile-panel')).toHaveTextContent('MH');
    expect(within(dialog).getByTestId('profile-panel')).toHaveTextContent('Quality User');
    expect(within(dialog).getByTestId('profile-panel')).toHaveTextContent(
      'Vasudha Pharma Chem Limited',
    );

    await user.click(screen.getByTestId('profile-close'));
    expect(screen.queryByRole('dialog', { name: 'Profile' })).not.toBeInTheDocument();
  });

  it('opens the settings panel with display-only settings', async () => {
    const user = userEvent.setup();
    renderNavbar(false);

    await user.click(screen.getByTestId('user-menu-button'));
    await user.click(screen.getByTestId('user-settings'));

    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    const panel = within(dialog).getByTestId('settings-panel');
    expect(panel).toHaveTextContent('Light');
    expect(panel).toHaveTextContent('Live AI');
    expect(panel).toHaveTextContent('Vasudha Pharma Chem Limited');

    await user.click(screen.getByTestId('settings-close'));
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument();
  });
});
