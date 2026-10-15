import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
import { renderWithProviders, makeStore } from '../../test/render';
import { makePipelineResult } from '../../test/fixtures';
import { SAMPLE_DEVIATION_TEXT } from '../../mocks/sampleText';
import { runPipeline } from '../../features/deviation/deviationApi';
import { NewDeviation } from '../../pages/NewDeviation';

const mockedAssessSeverity = vi.mocked(api.assessSeverity);

function renderReady() {
  const store = makeStore();
  store.dispatch(
    runPipeline.fulfilled({ result: makePipelineResult() }, 'req-1', {
      text: SAMPLE_DEVIATION_TEXT,
      sourceType: 'txt',
    }),
  );
  return renderWithProviders(<NewDeviation />, { store });
}

describe('Severity selection and override', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the AI recommendation and lets the human override it', async () => {
    const user = userEvent.setup();
    renderReady();

    expect(screen.getByTestId('ai-recommendation')).toHaveTextContent('Major');
    expect(screen.getByTestId('final-severity')).toHaveTextContent('Major');

    await user.click(screen.getByTestId('severity-critical'));

    expect(screen.getByTestId('final-severity')).toHaveTextContent('Critical');
    expect(screen.getByTestId('severity-overridden')).toBeInTheDocument();
  });

  it('keeps the human override when a re-assessment suggests a different severity', async () => {
    mockedAssessSeverity.mockResolvedValue({
      severity: {
        recommended_severity: 'Minor',
        confidence: 0.6,
        reason: 'Limited exposure duration.',
        factors: [],
        missing_information: [],
      },
      provider: 'demo',
      model: 'deterministic-demo',
    });
    const user = userEvent.setup();
    renderReady();

    await user.click(screen.getByTestId('severity-critical'));
    expect(screen.getByTestId('final-severity')).toHaveTextContent('Critical');

    await user.click(screen.getByTestId('rerun-severity'));

    await waitFor(() =>
      expect(screen.getByTestId('ai-recommendation')).toHaveTextContent('Minor'),
    );
    expect(screen.getByTestId('final-severity')).toHaveTextContent('Critical');
    expect(screen.getByTestId('severity-overridden')).toBeInTheDocument();
  });

  it('accepting the AI recommendation clears the override', async () => {
    const user = userEvent.setup();
    renderReady();

    await user.click(screen.getByTestId('severity-minor'));
    expect(screen.getByTestId('severity-overridden')).toBeInTheDocument();

    await user.click(screen.getByTestId('accept-ai-severity'));

    expect(screen.getByTestId('final-severity')).toHaveTextContent('Major');
    expect(screen.queryByTestId('severity-overridden')).not.toBeInTheDocument();
  });
});
