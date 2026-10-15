import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of occurrence is required (YYYY-MM-DD)');

const optionalIsoDate = z
  .string()
  .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Use the format YYYY-MM-DD');

export const deviationSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z
    .string()
    .trim()
    .min(1, 'Detailed description is required')
    .max(2000, 'Description must be 2000 characters or fewer'),
  event_date: isoDate,
  reported_date: optionalIsoDate,
  department: z.string(),
  site: z.string().trim().min(1, 'Site / Plant is required'),
  product_name: z.string(),
  product_code: z.string(),
  batch_number: z.string(),
  manufacturing_stage: z.string(),
  process_parameter: z.string(),
  approved_range: z.string(),
  actual_value: z.string(),
  unit: z.string(),
  duration: z.string(),
  equipment: z.string(),
  equipment_id: z.string(),
  immediate_action: z.string(),
  potential_impact: z.string(),
  root_cause_indication: z.string(),
  final_severity: z.enum(['Minor', 'Major', 'Critical']),
  status: z.enum(['Open', 'Under Review', 'Closed']),
  source_type: z.string().min(1, 'Source is required'),
  initial_impact: z.string().min(1, 'Initial impact is required'),
});

export type DeviationSchemaValues = z.infer<typeof deviationSchema>;

export const deviationResolver = zodResolver(deviationSchema);
