/** Types mirroring the backend Pydantic contracts exactly. */

export type Severity = 'Minor' | 'Major' | 'Critical';
export type ImpactLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type ImpactArea =
  | 'Product quality'
  | 'Patient safety'
  | 'Process impact'
  | 'Regulatory impact'
  | 'Batch integrity'
  | 'Process control';
export type DeviationStatus = 'Open' | 'Under Review' | 'Closed';
export type SourceType = 'pdf' | 'docx' | 'txt' | 'email' | 'text';

export const EXTRACTION_FIELDS = [
  'deviation_title',
  'deviation_description',
  'event_date',
  'reported_date',
  'department',
  'site',
  'product_name',
  'product_code',
  'batch_number',
  'manufacturing_stage',
  'process_parameter',
  'approved_range',
  'actual_value',
  'unit',
  'duration',
  'equipment',
  'equipment_id',
  'immediate_action',
  'potential_impact',
  'root_cause_indication',
] as const;

export type ExtractionFieldKey = (typeof EXTRACTION_FIELDS)[number];

/** The 20 extraction fields, each nullable — AI returns null, never a guess. */
export type ExtractedFields = Record<ExtractionFieldKey, string | null>;

export interface ExtractionResult {
  data: ExtractedFields;
  confidence: Record<string, number>;
  evidence: Record<string, string | null>;
}

export interface ValidationReport {
  missing_information: string[];
  low_confidence: string[];
  ungrounded: string[];
  errors: string[];
  critical_missing: boolean;
}

export interface ImpactAssessment {
  impact_level: ImpactLevel;
  impact_areas: ImpactArea[];
  reason: string;
  supporting_factors: string[];
  disclaimer: string;
}

export interface SeverityAssessment {
  recommended_severity: Severity;
  confidence: number;
  reason: string;
  factors: string[];
  missing_information: string[];
}

export interface AiPipelineResult {
  extraction: ExtractionResult;
  validation: ValidationReport;
  impact: ImpactAssessment | null;
  severity: SeverityAssessment | null;
  explanation: string | null;
  provider: string;
  model: string;
  elapsed_ms: number;
  errors: string[];
  request_id?: string | null;
}

export interface Proposal {
  field: string;
  current_value: string | null;
  proposed_value: string | null;
  reason: string;
}

export interface RefineResult {
  proposals: Proposal[];
  message: string | null;
  provider: string;
  model: string;
}

export interface AiAssessmentPayload {
  provider: string;
  model: string;
  extraction?: ExtractionResult | null;
  validation?: ValidationReport | null;
  impact?: ImpactAssessment | null;
  severity?: SeverityAssessment | null;
  explanation?: string | null;
  raw_text_excerpt?: string | null;
}

// ---------------------------------------------------------------------------
// Form (mirrors DeviationCreate: title/description replace deviation_*)
// ---------------------------------------------------------------------------

export const FORM_FIELDS = [
  'title',
  'description',
  'event_date',
  'reported_date',
  'department',
  'site',
  'product_name',
  'product_code',
  'batch_number',
  'manufacturing_stage',
  'process_parameter',
  'approved_range',
  'actual_value',
  'unit',
  'duration',
  'equipment',
  'equipment_id',
  'immediate_action',
  'potential_impact',
  'root_cause_indication',
] as const;

export type FormFieldKey = (typeof FORM_FIELDS)[number];

export type DeviationFormValues = Record<FormFieldKey, string> & {
  final_severity: Severity;
  status: DeviationStatus;
  source_type: string;
  initial_impact: string;
};

export const EXTRACTION_TO_FORM: Record<'deviation_title' | 'deviation_description', 'title' | 'description'> = {
  deviation_title: 'title',
  deviation_description: 'description',
};

export function toFormKey(key: string): FormFieldKey {
  return (EXTRACTION_TO_FORM as Record<string, FormFieldKey>)[key] ?? (key as FormFieldKey);
}

export function toExtractionKey(key: string): ExtractionFieldKey {
  const reverse = Object.fromEntries(
    Object.entries(EXTRACTION_TO_FORM).map(([extraction, form]) => [form, extraction]),
  ) as Record<string, ExtractionFieldKey>;
  return reverse[key] ?? (key as ExtractionFieldKey);
}

/** Form values use "" for empty; backend contracts use null. */
export function emptyFormValues(): DeviationFormValues {
  const values = {} as DeviationFormValues;
  for (const field of FORM_FIELDS) {
    values[field] = '';
  }
  values.site = 'API Manufacturing Unit';
  values.final_severity = 'Minor';
  values.status = 'Open';
  values.source_type = 'text';
  values.initial_impact = '';
  return values;
}

export function extractionToFormValues(
  data: ExtractedFields,
  severity: Severity | null,
  sourceType?: SourceType | null,
  impactLevel?: ImpactLevel | null,
): DeviationFormValues {
  const values = emptyFormValues();
  for (const key of EXTRACTION_FIELDS) {
    const formKey = toFormKey(key);
    values[formKey] = data[key] ?? values[formKey];
  }
  values.final_severity = severity ?? 'Minor';
  values.source_type = sourceType ?? 'text';
  values.initial_impact = impactLevel ?? '';
  return values;
}

export function formValuesToExtractedFields(
  values: DeviationFormValues | Record<string, unknown>,
): ExtractedFields {
  const result = {} as ExtractedFields;
  for (const key of EXTRACTION_FIELDS) {
    const value = values[toFormKey(key)];
    result[key] = typeof value === 'string' && value.trim() ? value : null;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Persisted records
// ---------------------------------------------------------------------------

export interface Deviation {
  id: string;
  deviation_number: string;
  title: string;
  description: string | null;
  event_date: string | null;
  reported_date: string | null;
  department: string | null;
  site: string | null;
  product_name: string | null;
  product_code: string | null;
  batch_number: string | null;
  manufacturing_stage: string | null;
  process_parameter: string | null;
  approved_range: string | null;
  actual_value: string | null;
  unit: string | null;
  duration: string | null;
  equipment: string | null;
  equipment_id: string | null;
  immediate_action: string | null;
  potential_impact: string | null;
  root_cause_indication: string | null;
  ai_recommended_severity: Severity | null;
  final_severity: Severity;
  ai_impact_level: string | null;
  ai_reason: string | null;
  status: DeviationStatus;
  source_type: string | null;
  ai_confidence_avg: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AiAssessmentOut {
  id: string;
  provider: string;
  model: string;
  extraction: Record<string, unknown> | null;
  confidence: Record<string, unknown> | null;
  evidence: Record<string, unknown> | null;
  validation: Record<string, unknown> | null;
  impact: Record<string, unknown> | null;
  severity: Record<string, unknown> | null;
  explanation: string | null;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  event_type: string;
  actor: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface DeviationDetail extends Deviation {
  ai_assessments: AiAssessmentOut[];
  audit_events: AuditEvent[];
}

export interface DeviationListResponse {
  items: Deviation[];
  total: number;
}

export interface DeviationCreatePayload extends Record<string, unknown> {
  title: string;
  final_severity: Severity;
  ai_assessment?: AiAssessmentPayload | null;
}

export interface SystemConfig {
  demo_mode: boolean;
  model: string;
  provider: 'demo' | 'groq';
  max_upload_mb: number;
}

export interface DocumentExtractResult {
  text: string;
  source_type: SourceType;
  char_count: number;
  filename: string | null;
}

export interface ApiError {
  message: string;
  code: string;
}

/** Per-field UI metadata: where the value came from + confidence + evidence. */
export interface FieldMeta {
  confidence: number;
  evidence: string | null;
  origin: 'ai' | 'user' | 'ai-applied';
}
