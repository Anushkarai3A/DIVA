import axios, { AxiosError } from 'axios';
import type {
  AiPipelineResult,
  ApiError,
  DeviationCreatePayload,
  DeviationDetail,
  DeviationListResponse,
  ExtractedFields,
  RefineResult,
  SeverityAssessment,
  ImpactAssessment,
  SystemConfig,
  ValidationReport,
  DocumentExtractResult,
  Deviation,
} from '../features/deviation/deviationTypes';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  timeout: 60000,
});

/** AI calls (pipeline / assess / refine) wait on Groq incl. bounded 429 retries. */
const AI_TIMEOUT_MS = 120000;

/** Backend AppError codes -> UI error categories (see ApiError.code). */
const CODED: Record<string, { code: string; message: string }> = {
  ai_rate_limited: {
    code: 'rate_limit',
    message: 'The AI service is temporarily rate limited. Please retry in a moment.',
  },
  ai_timeout: { code: 'ai_timeout', message: 'The AI request took too long. Please retry.' },
  ai_invalid_response: {
    code: 'validation_error',
    message: 'The AI returned incomplete or invalid deviation data. Please retry.',
  },
  ai_unavailable: {
    code: 'ai_processing_error',
    message: 'The AI service returned an error while processing this deviation.',
  },
  empty_document: {
    code: 'document_error',
    message: 'The document had no readable text. Try another file or paste the text.',
  },
  document_error: {
    code: 'document_error',
    message: 'The uploaded document could not be processed.',
  },
  unsupported_file_type: {
    code: 'document_error',
    message: 'Unsupported file type. Use PDF, DOCX, TXT or EML (max 5 MB).',
  },
  file_too_large: { code: 'document_error', message: 'The file is too large (max 5 MB).' },
  not_found: { code: 'not_found', message: 'Not found.' },
  internal_error: {
    code: 'unknown_error',
    message: 'Something went wrong while processing the deviation. Please retry.',
  },
};

/** HTTP statuses with a dedicated category (even without a structured body). */
const HTTP_STATUS: Record<number, { code: string; message: string }> = {
  429: {
    code: 'rate_limit',
    message: 'The AI service is temporarily rate limited. Please retry in a moment.',
  },
  500: {
    code: 'unknown_error',
    message: 'Something went wrong while processing the deviation. Please retry.',
  },
  502: {
    code: 'ai_processing_error',
    message: 'The AI service returned an error while processing this deviation.',
  },
  504: { code: 'ai_timeout', message: 'The AI request took too long. Please retry.' },
};

function isTimeout(error: AxiosError): boolean {
  return (
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT' ||
    /timeout/i.test(error.message)
  );
}

/** Normalize every failure into {message, code} — never leak axios internals. */
export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: unknown }>;
    // Timeout: the request went out but no answer arrived in time — NOT "backend down".
    if (isTimeout(axiosError)) {
      return { message: 'The AI request took too long. Please retry.', code: 'ai_timeout' };
    }
    const detail = axiosError.response?.data?.detail;
    if (detail && typeof detail === 'object' && !Array.isArray(detail) && 'message' in detail) {
      const body = detail as { message: string; code?: string };
      const mapped = body.code ? CODED[body.code] : undefined;
      return {
        message: mapped?.message ?? body.message,
        code: mapped?.code ?? body.code ?? 'unknown_error',
      };
    }
    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: string; loc?: (string | number)[] };
      const field = first?.loc?.slice(1).join('.') ?? 'field';
      return { message: `${field}: ${first?.msg ?? 'is invalid'}`, code: 'validation_error' };
    }
    if (!axiosError.response) {
      // No response at all: connection refused / DNS / backend not running.
      return {
        message: 'Unable to reach the DIVA backend. Please check that the backend is running.',
        code: 'network_error',
      };
    }
    const status = axiosError.response.status;
    const mapped = HTTP_STATUS[status];
    if (mapped) return mapped;
    return {
      message: `Request failed (${status}). Please retry.`,
      code: 'unknown_error',
    };
  }
  return { message: error instanceof Error ? error.message : 'Unexpected error.', code: 'unknown_error' };
}

async function request<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    const response = await fn();
    return response.data;
  } catch (error) {
    const normalized = toApiError(error);
    throw Object.assign(new Error(normalized.message), { apiError: normalized });
  }
}

export function getConfig(): Promise<SystemConfig> {
  return request(() => api.get('/api/config'));
}

export function extractDocument(file: File): Promise<DocumentExtractResult> {
  const form = new FormData();
  form.append('file', file);
  return request(() => api.post('/api/documents/extract', form, { timeout: 120000 }));
}

export function runPipeline(
  text: string,
  sourceType?: string | null,
  requestId?: string | null,
): Promise<AiPipelineResult> {
  const rid =
    (requestId || '').trim() ||
    (globalThis.crypto?.randomUUID?.() ?? `r-${Date.now().toString(36)}`).slice(0, 8);
  console.info('[diva] pipeline request', { request_id: rid, source_type: sourceType ?? 'text' });
  return request(() =>
    api.post(
      '/api/ai/extract-deviation',
      { text, source_type: sourceType ?? null, request_id: rid },
      { timeout: AI_TIMEOUT_MS },
    ),
  );
}

export function assessImpact(
  fields: ExtractedFields,
  rawText?: string | null,
): Promise<{ impact: ImpactAssessment; provider: string; model: string }> {
  return request(() =>
    api.post('/api/ai/assess-impact', { fields, raw_text: rawText ?? null }, { timeout: AI_TIMEOUT_MS }),
  );
}

export function assessSeverity(
  fields: ExtractedFields,
  validation?: ValidationReport | null,
  rawText?: string | null,
): Promise<{ severity: SeverityAssessment; provider: string; model: string }> {
  return request(() =>
    api.post(
      '/api/ai/assess-severity',
      {
        fields,
        validation: validation ?? null,
        raw_text: rawText ?? null,
      },
      { timeout: AI_TIMEOUT_MS },
    ),
  );
}

export function refineDeviation(payload: {
  instruction: string;
  current_fields: ExtractedFields;
  validation?: ValidationReport | null;
  raw_text?: string | null;
}): Promise<RefineResult> {
  return request(() => api.post('/api/ai/refine', payload, { timeout: AI_TIMEOUT_MS }));
}

export function createDeviation(payload: DeviationCreatePayload): Promise<Deviation> {
  return request(() => api.post('/api/deviations', payload));
}

export function listDeviations(params?: {
  search?: string;
  severity?: string;
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<DeviationListResponse> {
  return request(() => api.get('/api/deviations', { params }));
}

export function getDeviation(id: string): Promise<DeviationDetail> {
  return request(() => api.get(`/api/deviations/${id}`));
}

export function updateDeviation(id: string, payload: DeviationCreatePayload): Promise<Deviation> {
  return request(() => api.put(`/api/deviations/${id}`, payload));
}
