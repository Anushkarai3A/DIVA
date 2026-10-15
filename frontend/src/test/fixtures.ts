import {
  EXTRACTION_FIELDS,
  type AiPipelineResult,
  type Deviation,
  type DeviationDetail,
  type ExtractedFields,
  type Proposal,
} from '../features/deviation/deviationTypes';

export const FIXTURE_DATA: ExtractedFields = {
  deviation_title: 'Reactor temperature exceeded approved range',
  deviation_description:
    'During manufacturing of API-Compound-X batch API-240617, reactor temperature exceeded the approved range of 78-82\u00b0C, reaching 86\u00b0C for approximately 12 minutes.',
  event_date: null,
  reported_date: null,
  department: 'Production',
  site: 'Bangalore API Manufacturing Unit',
  product_name: 'API-Compound-X',
  product_code: null,
  batch_number: 'API-240617',
  manufacturing_stage: 'Reaction',
  process_parameter: 'Reactor temperature',
  approved_range: '78-82',
  actual_value: '86',
  unit: '\u00b0C',
  duration: '12 minutes',
  equipment: 'Reactor R-204',
  equipment_id: 'R-204',
  immediate_action: 'Stopped heating step and notified production supervisor and QA',
  potential_impact: 'Potential impact on product quality and process consistency',
  root_cause_indication: null,
};

export function makePipelineResult(overrides?: Partial<AiPipelineResult>): AiPipelineResult {
  const confidence: Record<string, number> = {};
  const evidence: Record<string, string | null> = {};
  for (const field of EXTRACTION_FIELDS) {
    confidence[field] = FIXTURE_DATA[field] === null ? 0.5 : 0.9;
    evidence[field] = FIXTURE_DATA[field] === null ? null : `source line for ${field}`;
  }
  return {
    extraction: { data: { ...FIXTURE_DATA }, confidence, evidence },
    validation: {
      missing_information: ['event_date', 'product_code'],
      low_confidence: [],
      ungrounded: [],
      errors: [],
      critical_missing: false,
    },
    impact: {
      impact_level: 'High',
      impact_areas: ['Product quality', 'Process impact'],
      reason: 'Temperature exceeded approved range for 12 minutes.',
      supporting_factors: ['Actual 86 vs approved 78-82'],
      disclaimer: 'Advisory only.',
    },
    severity: {
      recommended_severity: 'Major',
      confidence: 0.85,
      reason: 'Temperature excursion outside approved range.',
      factors: ['Product exposed to out-of-range conditions'],
      missing_information: ['event_date'],
    },
    explanation: 'Extracted 16 of 20 fields with an average confidence of 90%.',
    provider: 'groq',
    model: 'openai/gpt-oss-120b',
    elapsed_ms: 9000,
    errors: [],
    ...overrides,
  };
}

export const FIXTURE_PROPOSALS: Proposal[] = [
  {
    field: 'batch_number',
    current_value: 'API-240617',
    proposed_value: 'API-240617-R1',
    reason: 'Document lists the revised batch number.',
  },
  {
    field: 'actual_value',
    current_value: '86',
    proposed_value: '86.5',
    reason: 'Document reports the peak as 86.5.',
  },
];

export function makeDeviation(overrides?: Partial<Deviation>): Deviation {
  return {
    id: 'dev-1',
    deviation_number: 'DEV-2026-0001',
    title: 'Reactor temperature exceeded approved range',
    description: 'Temperature excursion during reaction.',
    event_date: '2026-09-01',
    reported_date: '2026-09-01',
    department: 'Production',
    site: 'Bangalore API Manufacturing Unit',
    product_name: 'API-Compound-X',
    product_code: 'CMP-X',
    batch_number: 'API-240617',
    manufacturing_stage: 'Reaction',
    process_parameter: 'Reactor temperature',
    approved_range: '78-82',
    actual_value: '86',
    unit: '\u00b0C',
    duration: '12 minutes',
    equipment: 'Reactor R-204',
    equipment_id: 'R-204',
    immediate_action: 'Stopped heating step and notified supervisor.',
    potential_impact: 'Potential impact on product quality.',
    root_cause_indication: null,
    ai_recommended_severity: 'Major',
    final_severity: 'Major',
    ai_impact_level: 'High',
    ai_reason: 'Temperature excursion outside approved range.',
    status: 'Open',
    source_type: 'pdf',
    ai_confidence_avg: 0.9,
    created_by: 'MH',
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
    ...overrides,
  };
}

export function makeDetail(overrides?: Partial<DeviationDetail>): DeviationDetail {
  return {
    ...makeDeviation(),
    ai_assessments: [],
    audit_events: [],
    ...overrides,
  };
}
