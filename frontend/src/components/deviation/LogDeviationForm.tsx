import { type ReactNode } from 'react';
import { useController, type Control, type FieldError, type UseFormReturn } from 'react-hook-form';
import { RotateCcw, Save } from 'lucide-react';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Label } from '../ui/Label';
import { Spinner } from '../ui/Spinner';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { fieldEdited, impactUpdated, severitySelected } from '../../features/deviation/deviationSlice';
import {
  toExtractionKey,
  type DeviationFormValues,
  type ImpactLevel,
  type Severity,
} from '../../features/deviation/deviationTypes';

const SITE_OPTIONS = [
  { value: 'API Manufacturing Unit', label: 'API Manufacturing Unit' },
  { value: 'Quality Control Laboratory', label: 'Quality Control Laboratory' },
  { value: 'Packaging Unit', label: 'Packaging Unit' },
];

const SOURCE_OPTIONS = [
  { value: 'text', label: 'Manual Entry' },
  { value: 'txt', label: 'Plain Text' },
  { value: 'pdf', label: 'PDF Document' },
  { value: 'docx', label: 'Word Document (DOCX)' },
  { value: 'email', label: 'Email' },
];

const IMPACT_OPTIONS = ['Low', 'Medium', 'High', 'Critical'].map((value) => ({
  value,
  label: value,
}));

const SEVERITY_OPTIONS = ['Minor', 'Major', 'Critical'].map((value) => ({
  value,
  label: value,
}));

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-b border-[var(--divider)] pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--fg-secondary)]">
      {children}
    </h3>
  );
}

function AiIndicator({ name, value }: { name: keyof DeviationFormValues; value: string }) {
  const meta = useAppSelector((state) => state.deviation.fieldMeta[toExtractionKey(name)]);
  if (!value || !meta || meta.origin === 'user') return null;
  if (meta.origin === 'ai-applied') {
    return (
      <p className="text-[11px] leading-tight text-[var(--fg-muted)]" data-testid="field-ai-indicator">
        AI value applied
      </p>
    );
  }
  return (
    <p className="text-[11px] leading-tight text-[var(--fg-muted)]" data-testid="field-ai-indicator">
      AI Extracted · {Math.round(meta.confidence * 100)}%
    </p>
  );
}

function FieldLabel({
  htmlFor,
  label,
  required,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <Label htmlFor={htmlFor} className="text-[13px] text-[var(--heading)]">
      {label}
      {required ? (
        <span className="ml-0.5 text-red-500" aria-hidden>
          *
        </span>
      ) : null}
    </Label>
  );
}

interface QFieldProps {
  name: keyof DeviationFormValues;
  label: string;
  control: Control<DeviationFormValues>;
  error?: FieldError;
  required?: boolean;
  type?: string;
  placeholder?: string;
}

function QField({ name, label, control, error, required, type = 'text', placeholder }: QFieldProps) {
  const dispatch = useAppDispatch();
  const id = `field-${name}`;
  const {
    field: { value, onChange, onBlur, ref },
  } = useController({ name, control });
  const text = typeof value === 'string' ? value : '';

  return (
    <div className="space-y-1.5" data-testid={`field-${name}`}>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <Input
        id={id}
        ref={ref}
        type={type}
        value={text}
        placeholder={placeholder}
        onBlur={onBlur}
        onChange={(event) => {
          onChange(event);
          dispatch(fieldEdited(toExtractionKey(name)));
        }}
        aria-invalid={!!error}
        className={cnError(error)}
      />
      <AiIndicator name={name} value={text} />
      {error ? (
        <p className="text-xs text-[var(--critical)]" role="alert">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

interface QTextareaProps {
  name: keyof DeviationFormValues;
  label: string;
  control: Control<DeviationFormValues>;
  error?: FieldError;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}

function QTextarea({
  name,
  label,
  control,
  error,
  required,
  placeholder,
  rows = 5,
  maxLength,
}: QTextareaProps) {
  const dispatch = useAppDispatch();
  const id = `field-${name}`;
  const {
    field: { value, onChange, onBlur, ref },
  } = useController({ name, control });
  const text = typeof value === 'string' ? value : '';

  return (
    <div className="space-y-1.5" data-testid={`field-${name}`}>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <Textarea
        id={id}
        ref={ref}
        rows={rows}
        maxLength={maxLength}
        value={text}
        placeholder={placeholder}
        onBlur={onBlur}
        onChange={(event) => {
          onChange(event);
          dispatch(fieldEdited(toExtractionKey(name)));
        }}
        aria-invalid={!!error}
        className={cnError(error)}
      />
      <div className="flex items-start justify-between gap-2">
        <AiIndicator name={name} value={text} />
        {maxLength ? (
          <span
            className="shrink-0 text-[11px] text-[var(--fg-muted)]"
            data-testid="description-counter"
          >
            {text.length} / {maxLength}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs text-[var(--critical)]" role="alert">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

interface QSelectProps {
  name: keyof DeviationFormValues;
  label: string;
  control: Control<DeviationFormValues>;
  error?: FieldError;
  required?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
  trackEdit?: boolean;
  onValueChange?: (value: string) => void;
}

function QSelect({
  name,
  label,
  control,
  error,
  required,
  options,
  placeholder,
  trackEdit,
  onValueChange,
}: QSelectProps) {
  const dispatch = useAppDispatch();
  const id = `field-${name}`;
  const {
    field: { value, onChange, onBlur, ref },
  } = useController({ name, control });
  const text = typeof value === 'string' ? value : '';
  const choices = options.some((option) => option.value === text) || !text
    ? options
    : [...options, { value: text, label: text }];

  return (
    <div className="space-y-1.5" data-testid={`field-${name}`}>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <select
        id={id}
        ref={ref}
        value={text}
        onBlur={onBlur}
        onChange={(event) => {
          onChange(event);
          if (trackEdit) dispatch(fieldEdited(toExtractionKey(name)));
          onValueChange?.(event.target.value);
        }}
        aria-invalid={!!error}
        className={`flex h-9 w-full rounded-md border border-input bg-[var(--input-bg)] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${error ? 'border-[var(--critical-border-strong)]' : ''}`}
      >
        {placeholder && !text ? (
          <option value="">{placeholder}</option>
        ) : null}
        {choices.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <AiIndicator name={name} value={text} />
      {error ? (
        <p className="text-xs text-[var(--critical)]" role="alert">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

function cnError(error?: FieldError): string | undefined {
  return error ? 'border-[var(--critical-border-strong)]' : undefined;
}

interface LogDeviationFormProps {
  form: UseFormReturn<DeviationFormValues>;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}

export function LogDeviationForm({ form, onSave, onReset, saving }: LogDeviationFormProps) {
  const dispatch = useAppDispatch();
  const { control, watch, formState } = form;
  const { errors } = formState;
  const { aiResult, status, error } = useAppSelector((state) => state.deviation);
  const description = watch('description') ?? '';
  const saveError = status !== 'error' ? error : null;

  const handleImpactChange = (value: string) => {
    if (aiResult?.impact) {
      dispatch(impactUpdated({ ...aiResult.impact, impact_level: value as ImpactLevel }));
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
      className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] shadow-sm"
      data-testid="log-deviation-form"
    >
      <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-6 py-4">
        <h2 className="text-lg font-semibold text-[var(--heading)]">Log Deviation</h2>
        <Badge variant="muted" data-testid="draft-badge">
          Draft
        </Badge>
      </div>

      <div className="space-y-5 px-6 py-5">
        <section className="space-y-4" aria-label="Deviation information">
          <SectionHeader>1. Deviation Information</SectionHeader>
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <QSelect
              name="site"
              label="Site / Plant"
              required
              trackEdit
              control={control}
              options={SITE_OPTIONS}
              error={errors.site}
            />
            <QField
              name="event_date"
              label="Date of Occurrence"
              type="date"
              required
              control={control}
              error={errors.event_date}
            />
            <QField
              name="title"
              label="Title / Short Description"
              required
              control={control}
              error={errors.title}
              placeholder="Short summary of the deviation"
            />
            <QSelect
              name="source_type"
              label="Source"
              required
              control={control}
              options={SOURCE_OPTIONS}
              error={errors.source_type}
            />
            <QField
              name="product_name"
              label="Related Product / Material"
              control={control}
              error={errors.product_name}
              placeholder="Search product or material"
            />
            <QField
              name="batch_number"
              label="Batch/Lot Number"
              control={control}
              error={errors.batch_number}
              placeholder="e.g. API-240617"
            />
          </div>
        </section>

        <div className="border-t border-[var(--border-soft)]" />

        <section className="space-y-4" aria-label="Deviation details">
          <SectionHeader>2. Deviation Details</SectionHeader>
          <QTextarea
            name="description"
            label="Detailed Description"
            required
            control={control}
            error={errors.description}
            placeholder="Describe what happened, when, where, and the immediate response…"
            rows={5}
            maxLength={2000}
          />
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <QSelect
              name="initial_impact"
              label="Initial Impact"
              required
              placeholder="Select impact"
              control={control}
              options={IMPACT_OPTIONS}
              error={errors.initial_impact}
              onValueChange={handleImpactChange}
            />
            <QSelect
              name="final_severity"
              label="Initial Severity"
              required
              control={control}
              options={SEVERITY_OPTIONS}
              error={errors.final_severity}
              onValueChange={(value) => dispatch(severitySelected(value as Severity))}
            />
          </div>
        </section>
      </div>

      {saveError ? (
        <div className="px-6 pb-4">
          <Alert variant="destructive" data-testid="save-error">
            {saveError}
          </Alert>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 border-t border-[var(--border-soft)] px-6 py-4">
        <Button type="button" variant="outline" onClick={onReset} data-testid="reset-button">
          <RotateCcw className="h-4 w-4" aria-hidden />
          Reset Form
        </Button>
        <Button
          type="submit"
          disabled={saving}
          data-testid="save-button"
          className="h-10 min-w-[145px] bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]"
        >
          {saving ? (
            <>
              <Spinner /> Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" aria-hidden />
              Save Deviation
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
