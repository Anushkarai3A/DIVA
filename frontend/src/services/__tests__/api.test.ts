import { describe, expect, it } from 'vitest';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { toApiError } from '../api';

function axiosErr(opts: {
  code?: string;
  status?: number;
  detail?: unknown;
  message?: string;
}): AxiosError {
  const config = {} as InternalAxiosRequestConfig;
  const response: AxiosResponse | undefined =
    opts.status !== undefined
      ? ({
          status: opts.status,
          statusText: '',
          headers: {},
          config,
          data: opts.detail !== undefined ? { detail: opts.detail } : undefined,
        } as AxiosResponse)
      : undefined;
  return new AxiosError(
    opts.message ?? 'Request failed',
    opts.code,
    config,
    {},
    response,
  );
}

describe('toApiError', () => {
  it('maps an axios timeout (ECONNABORTED, no response) to ai_timeout, not network_error', () => {
    const result = toApiError(axiosErr({ code: 'ECONNABORTED', message: 'timeout of 120000ms exceeded' }));
    expect(result.code).toBe('ai_timeout');
    expect(result.message).not.toContain('Cannot reach');
    expect(result.message).not.toContain('backend');
  });

  it('maps a true connection failure to network_error with the backend message', () => {
    const result = toApiError(axiosErr({ code: 'ERR_NETWORK', message: 'Network Error' }));
    expect(result.code).toBe('network_error');
    expect(result.message).toBe(
      'Unable to reach the DIVA backend. Please check that the backend is running.',
    );
  });

  it('maps a coded 429 detail body to rate_limit', () => {
    const result = toApiError(
      axiosErr({
        status: 429,
        detail: { message: 'The AI service is rate limited.', code: 'ai_rate_limited' },
      }),
    );
    expect(result.code).toBe('rate_limit');
    expect(result.message).toBe('The AI service is temporarily rate limited. Please retry in a moment.');
  });

  it('maps a 429 without a body to rate_limit via HTTP status', () => {
    const result = toApiError(axiosErr({ status: 429 }));
    expect(result.code).toBe('rate_limit');
  });

  it('maps coded ai_timeout detail to ai_timeout', () => {
    const result = toApiError(
      axiosErr({ status: 504, detail: { message: 'AI request timed out.', code: 'ai_timeout' } }),
    );
    expect(result.code).toBe('ai_timeout');
  });

  it('maps ai_invalid_response to validation_error', () => {
    const result = toApiError(
      axiosErr({
        status: 502,
        detail: { message: 'Not valid JSON.', code: 'ai_invalid_response' },
      }),
    );
    expect(result.code).toBe('validation_error');
  });

  it('maps ai_unavailable to ai_processing_error with the friendly message', () => {
    const result = toApiError(
      axiosErr({ status: 502, detail: { message: 'boom', code: 'ai_unavailable' } }),
    );
    expect(result.code).toBe('ai_processing_error');
    expect(result.message).toBe(
      'The AI service returned an error while processing this deviation.',
    );
  });

  it('maps internal_error code to unknown_error with the friendly message', () => {
    const result = toApiError(
      axiosErr({ status: 500, detail: { message: 'traceback', code: 'internal_error' } }),
    );
    expect(result.code).toBe('unknown_error');
    expect(result.message).not.toContain('traceback');
  });

  it('passes through unknown backend codes and messages', () => {
    const result = toApiError(
      axiosErr({ status: 400, detail: { message: 'Custom backend message', code: 'custom_code' } }),
    );
    expect(result.code).toBe('custom_code');
    expect(result.message).toBe('Custom backend message');
  });

  it('maps pydantic validation arrays to validation_error with the field name', () => {
    const result = toApiError(
      axiosErr({
        status: 422,
        detail: [{ loc: ['body', 'text'], msg: 'Field required', type: 'missing' }],
      }),
    );
    expect(result.code).toBe('validation_error');
    expect(result.message).toBe('text: Field required');
  });

  it('maps an uncoded 502 body to ai_processing_error via HTTP status', () => {
    const result = toApiError(axiosErr({ status: 502, detail: 'upstream exploded' }));
    expect(result.code).toBe('ai_processing_error');
    expect(result.message).not.toContain('upstream exploded');
  });

  it('never claims Demo Mode works without a backend', () => {
    const noResponse = toApiError(axiosErr({ code: 'ERR_NETWORK' }));
    const coded = toApiError(
      axiosErr({ status: 502, detail: { message: 'boom', code: 'ai_unavailable' } }),
    );
    expect(noResponse.message).not.toContain('Demo Mode');
    expect(coded.message).not.toContain('Demo Mode');
  });

  it('falls back to unknown_error for non-axios errors', () => {
    const result = toApiError(new Error('plain failure'));
    expect(result.code).toBe('unknown_error');
    expect(result.message).toBe('plain failure');
  });
});
