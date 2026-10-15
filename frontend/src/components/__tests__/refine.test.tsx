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
import { FIXTURE_PROPOSALS, makePipelineResult } from '../../test/fixtures';
import { SAMPLE_DEVIATION_TEXT } from '../../mocks/sampleText';
import { runPipeline } from '../../features/deviation/deviationApi';
import { inputTextChanged } from '../../features/deviation/deviationSlice';
import { NewDeviation } from '../../pages/NewDeviation';

const mockedRefine = vi.mocked(api.refineDeviation);

function renderReady() {
  const store = makeStore();
  store.dispatch(
    inputTextChanged({ text: SAMPLE_DEVIATION_TEXT, sourceType: 'txt' }),
  );
  store.dispatch(
    runPipeline.fulfilled({ result: makePipelineResult() }, 'req-1', {
      text: SAMPLE_DEVIATION_TEXT,
      sourceType: 'txt',
    }),
  );
  return renderWithProviders(<NewDeviation />, { store });
}

describe('AI refine proposals (apply / reject)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies a proposal into the form and removes it from the list', async () => {
    mockedRefine.mockResolvedValue({
      proposals: FIXTURE_PROPOSALS,
      message: null,
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
    });
    const user = userEvent.setup();
    renderReady();

    await user.type(screen.getByTestId('refine-input'), 'Fix the batch and actual value');
    await user.click(screen.getByTestId('refine-send'));

    expect(await screen.findAllByTestId('change-preview')).toHaveLength(2);
    expect(mockedRefine).toHaveBeenCalledWith(
      expect.objectContaining({
        instruction: 'Fix the batch and actual value',
        raw_text: SAMPLE_DEVIATION_TEXT,
        current_fields: expect.objectContaining({ batch_number: 'API-240617' }),
      }),
    );

    await user.click(screen.getAllByTestId('apply-proposal')[0]);

    await waitFor(() =>
      expect((screen.getByLabelText(/batch\/lot number/i) as HTMLInputElement).value).toBe(
        'API-240617-R1',
      ),
    );
    expect(screen.getAllByTestId('change-preview')).toHaveLength(1);
  });

  it('rejecting a proposal leaves the form value untouched', async () => {
    mockedRefine.mockResolvedValue({
      proposals: FIXTURE_PROPOSALS,
      message: null,
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
    });
    const user = userEvent.setup();
    renderReady();

    await user.type(screen.getByTestId('refine-input'), 'Correct the values');
    await user.click(screen.getByTestId('refine-send'));
    expect(await screen.findAllByTestId('change-preview')).toHaveLength(2);

    const previews = screen.getAllByTestId('change-preview');
    expect(previews[1]).toHaveTextContent('actual value');
    await user.click(screen.getAllByTestId('reject-proposal')[1]);

    await waitFor(() => expect(screen.getAllByTestId('change-preview')).toHaveLength(1));
    expect((screen.getByLabelText(/batch\/lot number/i) as HTMLInputElement).value).toBe(
      'API-240617',
    );
    expect((screen.getByLabelText(/related product/i) as HTMLInputElement).value).toBe(
      'API-Compound-X',
    );
  });

  it('renders the AI message when no proposals come back', async () => {
    mockedRefine.mockResolvedValue({
      proposals: [],
      message: 'The fields event_date and product_code are missing from the document.',
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
    });
    const user = userEvent.setup();
    renderReady();

    await user.type(screen.getByTestId('refine-input'), 'What information is missing?');
    await user.click(screen.getByTestId('refine-send'));

    expect(await screen.findByTestId('refine-message')).toHaveTextContent(
      'event_date and product_code are missing',
    );
  });
});
