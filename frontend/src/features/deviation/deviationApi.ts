import { createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../../services/api';
import { toApiError } from '../../services/api';
import {
  EXTRACTION_FIELDS,
  type AiPipelineResult,
  type DeviationCreatePayload,
  type DeviationFormValues,
  type ExtractedFields,
  type Proposal,
  type SourceType,
  type SystemConfig,
  type ValidationReport,
  formValuesToExtractedFields,
} from './deviationTypes';

type ThunkConfig = { rejectValue: string };

function messageOf(error: unknown): string {
  return toApiError(error).message;
}

export const loadConfig = createAsyncThunk<SystemConfig, void, ThunkConfig>(
  'deviation/loadConfig',
  async (_, { rejectWithValue }) => {
    try {
      return await api.getConfig();
    } catch (error) {
      return rejectWithValue(messageOf(error));
    }
  },
);

export const extractDocument = createAsyncThunk<
  { text: string; source_type: SourceType },
  File,
  ThunkConfig
>('deviation/extractDocument', async (file, { rejectWithValue }) => {
  try {
    return await api.extractDocument(file);
  } catch (error) {
    return rejectWithValue(messageOf(error));
  }
});

export const runPipeline = createAsyncThunk<
  { result: AiPipelineResult },
  { text: string; sourceType?: SourceType | null; requestId?: string | null },
  ThunkConfig
>('deviation/runPipeline', async ({ text, sourceType, requestId }, { rejectWithValue }) => {
  try {
    const result = await api.runPipeline(text, sourceType, requestId);
    console.info('[diva] pipeline result', {
      request_id: result.request_id,
      provider: result.provider,
      elapsed_ms: result.elapsed_ms,
      errors: result.errors,
    });
    return { result };
  } catch (error) {
    const apiError = toApiError(error);
    console.info('[diva] pipeline failed', { code: apiError.code });
    return rejectWithValue(apiError.message);
  }
});

export const refineRequest = createAsyncThunk<
  { proposals: Proposal[]; message: string | null },
  {
    instruction: string;
    currentFields: ExtractedFields;
    validation?: ValidationReport | null;
    rawText?: string | null;
  },
  ThunkConfig
>('deviation/refineRequest', async (args, { rejectWithValue }) => {
  try {
    const result = await api.refineDeviation({
      instruction: args.instruction,
      current_fields: args.currentFields,
      validation: args.validation ?? null,
      raw_text: args.rawText ?? null,
    });
    return { proposals: result.proposals, message: result.message };
  } catch (error) {
    return rejectWithValue(messageOf(error));
  }
});

export const reassessImpact = createAsyncThunk<
  Awaited<ReturnType<typeof api.assessImpact>>,
  { fields: ExtractedFields; rawText?: string | null },
  ThunkConfig
>('deviation/reassessImpact', async ({ fields, rawText }, { rejectWithValue }) => {
  try {
    return await api.assessImpact(fields, rawText);
  } catch (error) {
    return rejectWithValue(messageOf(error));
  }
});

export const reassessSeverity = createAsyncThunk<
  Awaited<ReturnType<typeof api.assessSeverity>>,
  {
    fields: ExtractedFields;
    validation?: ValidationReport | null;
    rawText?: string | null;
  },
  ThunkConfig
>('deviation/reassessSeverity', async (args, { rejectWithValue }) => {
  try {
    return await api.assessSeverity(args.fields, args.validation ?? null, args.rawText ?? null);
  } catch (error) {
    return rejectWithValue(messageOf(error));
  }
});

export function averageConfidence(result: AiPipelineResult): number {
  const populated = EXTRACTION_FIELDS.filter((field) => result.extraction.data[field] !== null);
  if (populated.length === 0) return 0;
  const total = populated.reduce(
    (sum, field) => sum + Math.max(0, Math.min(1, result.extraction.confidence[field] ?? 0)),
    0,
  );
  return Math.round((total / populated.length) * 1000) / 1000;
}

export function buildCreatePayload(
  values: DeviationFormValues,
  aiResult: AiPipelineResult | null,
  rawText: string | null,
): DeviationCreatePayload {
  const payload: DeviationCreatePayload = {
    title: values.title.trim(),
    final_severity: values.final_severity,
    status: values.status,
    source_type: values.source_type ?? null,
    ai_impact_level: values.initial_impact?.trim() ? values.initial_impact.trim() : null,
  };
  for (const field of Object.keys(values) as (keyof DeviationFormValues)[]) {
    if (
      field === 'final_severity' ||
      field === 'status' ||
      field === 'title' ||
      field === 'initial_impact'
    ) {
      continue;
    }
    const value = values[field];
    payload[field] = typeof value === 'string' && value.trim() ? value : null;
  }
  if (aiResult) {
    payload.ai_confidence_avg = averageConfidence(aiResult);
    payload.ai_assessment = {
      provider: aiResult.provider,
      model: aiResult.model,
      extraction: aiResult.extraction,
      validation: aiResult.validation,
      impact: aiResult.impact,
      severity: aiResult.severity,
      explanation: aiResult.explanation,
      raw_text_excerpt: rawText ? rawText.slice(0, 1500) : null,
    };
  }
  return payload;
}

export const createDeviationRequest = createAsyncThunk<
  Awaited<ReturnType<typeof api.createDeviation>>,
  { values: DeviationFormValues; aiResult: AiPipelineResult | null; rawText: string | null },
  ThunkConfig
>('deviation/createDeviationRequest', async ({ values, aiResult, rawText }, { rejectWithValue }) => {
  try {
    return await api.createDeviation(buildCreatePayload(values, aiResult, rawText));
  } catch (error) {
    return rejectWithValue(messageOf(error));
  }
});

export const updateDeviationRequest = createAsyncThunk<
  Awaited<ReturnType<typeof api.updateDeviation>>,
  {
    id: string;
    values: DeviationFormValues;
    aiResult: AiPipelineResult | null;
    rawText: string | null;
  },
  ThunkConfig
>('deviation/updateDeviationRequest', async ({ id, values, aiResult, rawText }, { rejectWithValue }) => {
  try {
    const payload = buildCreatePayload(values, aiResult, rawText);
    delete payload.ai_assessment;
    delete payload.ai_confidence_avg;
    return await api.updateDeviation(id, payload);
  } catch (error) {
    return rejectWithValue(messageOf(error));
  }
});

export { formValuesToExtractedFields };
