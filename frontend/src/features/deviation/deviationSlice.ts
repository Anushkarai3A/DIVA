import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  EXTRACTION_FIELDS,
  type AiPipelineResult,
  type Deviation,
  type ExtractionFieldKey,
  type FieldMeta,
  type ImpactAssessment,
  type Proposal,
  type Severity,
  type SeverityAssessment,
  type SourceType,
} from './deviationTypes';
import {
  createDeviationRequest,
  extractDocument,
  loadConfig,
  reassessImpact,
  reassessSeverity,
  refineRequest,
  runPipeline,
} from './deviationApi';

export type InputState = { text: string; sourceType: SourceType | null };
export type Status = 'idle' | 'extracting' | 'processing' | 'ready' | 'error';

export interface DeviationState {
  input: InputState;
  status: Status;
  aiResult: AiPipelineResult | null;
  fieldMeta: Partial<Record<ExtractionFieldKey, FieldMeta>>;
  proposals: Proposal[];
  refineMessage: string | null;
  proposalsLoading: boolean;
  severity: { ai: Severity | null; final: Severity; overridden: boolean };
  saved: Deviation | null;
  error: string | null;
  demoMode: boolean;
}

export const initialState: DeviationState = {
  input: { text: '', sourceType: null },
  status: 'idle',
  aiResult: null,
  fieldMeta: {},
  proposals: [],
  refineMessage: null,
  proposalsLoading: false,
  severity: { ai: null, final: 'Minor', overridden: false },
  saved: null,
  error: null,
  demoMode: true,
};

function seedFieldMeta(result: AiPipelineResult): DeviationState['fieldMeta'] {
  const meta: DeviationState['fieldMeta'] = {};
  for (const field of EXTRACTION_FIELDS) {
    meta[field] = {
      confidence: result.extraction.confidence[field] ?? 0,
      evidence: result.extraction.evidence[field] ?? null,
      origin: 'ai',
    };
  }
  return meta;
}

const deviationSlice = createSlice({
  name: 'deviation',
  initialState,
  reducers: {
    inputTextChanged(state, action: PayloadAction<{ text: string; sourceType?: SourceType | null }>) {
      state.input.text = action.payload.text;
      if (action.payload.sourceType !== undefined) state.input.sourceType = action.payload.sourceType;
      if (state.status === 'error') state.status = 'idle';
      state.error = null;
    },
    resetIntake(state) {
      return { ...initialState, demoMode: state.demoMode };
    },
    fieldEdited(state, action: PayloadAction<ExtractionFieldKey>) {
      const existing = state.fieldMeta[action.payload];
      state.fieldMeta[action.payload] = {
        confidence: existing?.confidence ?? 0,
        evidence: existing?.evidence ?? null,
        origin: 'user',
      };
    },
    fieldApplied(state, action: PayloadAction<ExtractionFieldKey>) {
      const existing = state.fieldMeta[action.payload];
      state.fieldMeta[action.payload] = {
        confidence: existing?.confidence ?? 0,
        evidence: existing?.evidence ?? null,
        origin: 'ai-applied',
      };
    },
    severitySelected(state, action: PayloadAction<Severity>) {
      state.severity.final = action.payload;
      state.severity.overridden = state.severity.ai !== null && action.payload !== state.severity.ai;
    },
    severityAccepted(state) {
      if (state.severity.ai) {
        state.severity.final = state.severity.ai;
        state.severity.overridden = false;
      }
    },
    proposalRejected(state, action: PayloadAction<number>) {
      state.proposals.splice(action.payload, 1);
    },
    proposalsCleared(state) {
      state.proposals = [];
      state.refineMessage = null;
    },
    impactUpdated(state, action: PayloadAction<ImpactAssessment>) {
      if (state.aiResult) state.aiResult.impact = action.payload;
    },
    severityUpdated(state, action: PayloadAction<SeverityAssessment>) {
      if (state.aiResult) state.aiResult.severity = action.payload;
      if (action.payload) {
        state.severity.ai = action.payload.recommended_severity;
        if (!state.severity.overridden) {
          state.severity.final = action.payload.recommended_severity;
        }
      }
    },
    savedCleared(state) {
      state.saved = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadConfig.fulfilled, (state, action) => {
        state.demoMode = action.payload.demo_mode;
      })
      .addCase(extractDocument.pending, (state) => {
        state.status = 'extracting';
        state.error = null;
      })
      .addCase(extractDocument.fulfilled, (state, action) => {
        state.input.text = action.payload.text;
        state.input.sourceType = action.payload.source_type;
        state.status = 'idle';
      })
      .addCase(extractDocument.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload ?? 'Could not read the document.';
      })
      .addCase(runPipeline.pending, (state) => {
        state.status = 'processing';
        state.error = null;
        state.proposals = [];
        state.refineMessage = null;
      })
      .addCase(runPipeline.fulfilled, (state, action) => {
        state.aiResult = action.payload.result;
        state.fieldMeta = seedFieldMeta(action.payload.result);
        const aiSeverity = action.payload.result.severity?.recommended_severity ?? null;
        state.severity = {
          ai: aiSeverity,
          final: aiSeverity ?? 'Minor',
          overridden: false,
        };
        state.status = 'ready';
      })
      .addCase(runPipeline.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload ?? 'AI processing failed. Please retry.';
      })
      .addCase(refineRequest.pending, (state) => {
        state.proposalsLoading = true;
      })
      .addCase(refineRequest.fulfilled, (state, action) => {
        state.proposalsLoading = false;
        state.proposals = action.payload.proposals;
        state.refineMessage = action.payload.message;
      })
      .addCase(refineRequest.rejected, (state, action) => {
        state.proposalsLoading = false;
        state.error = action.payload ?? 'Refinement failed. Please retry.';
      })
      .addCase(reassessImpact.fulfilled, (state, action) => {
        if (state.aiResult) state.aiResult.impact = action.payload.impact;
      })
      .addCase(reassessSeverity.fulfilled, (state, action) => {
        if (state.aiResult) state.aiResult.severity = action.payload.severity;
        state.severity.ai = action.payload.severity.recommended_severity;
        if (!state.severity.overridden) {
          state.severity.final = action.payload.severity.recommended_severity;
        }
      })
      .addCase(createDeviationRequest.pending, (state) => {
        state.error = null;
      })
      .addCase(createDeviationRequest.fulfilled, (state, action) => {
        state.saved = action.payload;
      })
      .addCase(createDeviationRequest.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not save the deviation.';
      });
  },
});

export const {
  inputTextChanged,
  resetIntake,
  fieldEdited,
  fieldApplied,
  severitySelected,
  severityAccepted,
  proposalRejected,
  proposalsCleared,
  impactUpdated,
  severityUpdated,
  savedCleared,
} = deviationSlice.actions;

export default deviationSlice.reducer;
