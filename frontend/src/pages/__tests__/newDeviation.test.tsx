import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
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
import { NewDeviation } from '../NewDeviation';

const mockedRunPipeline = vi.mocked(api.runPipeline);

describe('NewDeviation intake flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs the sample text through the pipeline and populates the log form', async () => {
    mockedRunPipeline.mockResolvedValue(makePipelineResult());
    const user = userEvent.setup();
    renderWithProviders(<NewDeviation />, { store: makeStore() });

    expect(screen.getByText('Log Deviation')).toBeInTheDocument();
    expect(screen.getByTestId('draft-badge')).toHaveTextContent('Draft');

    await user.click(screen.getByTestId('use-sample'));
    const textarea = screen.getByTestId('source-text') as HTMLTextAreaElement;
    expect(textarea.value).toContain('API-240617');

    await user.click(screen.getByTestId('process-button'));

    expect(await screen.findByTestId('extraction-results')).toBeInTheDocument();
    expect(mockedRunPipeline).toHaveBeenCalledWith(SAMPLE_DEVIATION_TEXT, 'txt', undefined);

    const batch = screen.getByLabelText(/batch\/lot number/i) as HTMLInputElement;
    expect(batch.value).toBe('API-240617');
    expect(
      (screen.getByLabelText(/title \/ short description/i) as HTMLInputElement).value,
    ).toBe('Reactor temperature exceeded approved range');
    expect((screen.getByLabelText(/related product/i) as HTMLInputElement).value).toBe(
      'API-Compound-X',
    );
    expect(
      (screen.getByLabelText(/detailed description/i) as HTMLTextAreaElement).value,
    ).toContain('86\u00b0C');
    expect(screen.getByTestId('final-severity')).toHaveTextContent('Major');
    expect(screen.getByTestId('extraction-results')).toHaveTextContent('16 of 20');
    expect(screen.getByTestId('extraction-results')).toHaveTextContent('Average confidence: 90%');
  });

  it('shows the error state with retry when the pipeline fails', async () => {
    mockedRunPipeline.mockRejectedValue(new Error('The AI service is down.'));
    const user = userEvent.setup();
    renderWithProviders(<NewDeviation />, { store: makeStore() });

    await user.click(screen.getByTestId('use-sample'));
    await user.click(screen.getByTestId('process-button'));

    const error = await screen.findByTestId('ai-error');
    expect(error).toHaveTextContent('The AI service is down.');
    expect(screen.getByTestId('retry-button')).toBeInTheDocument();
  });
});
