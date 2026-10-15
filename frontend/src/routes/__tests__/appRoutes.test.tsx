import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  getConfig: vi.fn(),
  extractDocument: vi.fn(),
  runPipeline: vi.fn(),
  assessImpact: vi.fn(),
  assessSeverity: vi.fn(),
  refineDeviation: vi.fn(),
  createDeviation: vi.fn(),
  listDeviations: vi.fn(),
  getDeviation: vi.fn(),
  updateDeviation: vi.fn(),
  toApiError: (error: unknown) => ({
    message: error instanceof Error ? error.message : 'Unexpected error.',
    code: 'unknown',
  }),
}));

import * as api from '../../services/api';
import { AppRoutes } from '../AppRoutes';
import { renderWithProviders } from '../../test/render';
import { makeDetail, makeDeviation } from '../../test/fixtures';
import type { SystemConfig } from '../../features/deviation/deviationTypes';

const mockedGetConfig = vi.mocked(api.getConfig);
const mockedListDeviations = vi.mocked(api.listDeviations);
const mockedGetDeviation = vi.mocked(api.getDeviation);

function navLinks() {
  const nav = screen.getByRole('navigation', { name: 'Primary' });
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent);
}

describe('App routes and shared navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetConfig.mockResolvedValue({ demo_mode: false } as unknown as SystemConfig);
    mockedListDeviations.mockResolvedValue({ items: [], total: 0 });
    mockedGetDeviation.mockResolvedValue(makeDetail());
  });

  it('renders the dashboard at / with the shared navbar and no sidebar', async () => {
    renderWithProviders(<AppRoutes />, { route: '/' });

    expect(await screen.findByText('Deviation intake at a glance.')).toBeInTheDocument();
    expect(screen.getByTestId('qms-navbar')).toBeInTheDocument();
    expect(screen.getByTestId('diva-logo')).toHaveAttribute('src', '/diva.png');
    expect(screen.queryByLabelText('Notifications')).not.toBeInTheDocument();
    expect(screen.getByText('AI for a Safer Tomorrow')).toBeInTheDocument();
    expect(screen.getByText('Vasudha Pharma Chem Limited')).toBeInTheDocument();

    expect(navLinks()).toEqual(['Dashboard', 'Deviations']);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'AI Copilot' })).not.toBeInTheDocument();

    expect(document.querySelector('aside nav')).not.toBeInTheDocument();
    expect(screen.queryByText('CAPAs')).not.toBeInTheDocument();
    expect(screen.queryByText('Documents')).not.toBeInTheDocument();
  });

  it('renders the deviations list at /deviations with Deviations active', async () => {
    renderWithProviders(<AppRoutes />, { route: '/deviations' });

    expect(await screen.findByText('Manage and review reported deviations.')).toBeInTheDocument();
    expect(screen.getByTestId('new-deviation-cta')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Deviations' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByTestId('qms-navbar')).toBeInTheDocument();
  });

  it('renders the log form at /new-deviation with Deviations active', async () => {
    renderWithProviders(<AppRoutes />, { route: '/new-deviation' });

    expect(await screen.findByTestId('draft-badge')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Deviations' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByTestId('qms-navbar')).toBeInTheDocument();
    expect(document.querySelector('aside nav')).not.toBeInTheDocument();
  });

  it('redirects /ai-copilot to the dashboard with no AI Copilot page', async () => {
    renderWithProviders(<AppRoutes />, { route: '/ai-copilot' });

    expect(await screen.findByText('Deviation intake at a glance.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByRole('link', { name: 'AI Copilot' })).not.toBeInTheDocument();
    expect(screen.getByTestId('qms-navbar')).toBeInTheDocument();
  });

  it('renders deviation details at /deviations/:id', async () => {
    renderWithProviders(<AppRoutes />, { route: '/deviations/dev-1' });

    expect(await screen.findByRole('link', { name: 'Back to deviations' })).toBeInTheDocument();
    expect(await screen.findByText('DEV-2026-0001')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Deviations' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByTestId('qms-navbar')).toBeInTheDocument();
  });

  it('redirects legacy routes to the dashboard', async () => {
    renderWithProviders(<AppRoutes />, { route: '/copilot' });
    expect(await screen.findByText('Deviation intake at a glance.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByRole('link', { name: 'AI Copilot' })).not.toBeInTheDocument();
  });

  it('redirects /deviations/new to /new-deviation', async () => {
    renderWithProviders(<AppRoutes />, { route: '/deviations/new' });
    expect(await screen.findByTestId('draft-badge')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Deviations' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('keeps the dashboard usable with loaded deviations', async () => {
    mockedListDeviations.mockResolvedValue({
      items: [makeDeviation(), makeDeviation({ id: 'dev-2', final_severity: 'Critical', ai_recommended_severity: 'Critical' })],
      total: 2,
    });
    renderWithProviders(<AppRoutes />, { route: '/dashboard' });

    expect(await screen.findByTestId('count-critical')).toHaveTextContent('1');
    expect(screen.getAllByTestId('deviation-row')).toHaveLength(2);
  });
});
