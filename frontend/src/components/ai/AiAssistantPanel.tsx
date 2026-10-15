import { useEffect, useState, type DragEvent, type ReactNode } from 'react';
import { type UseFormReturn } from 'react-hook-form';
import { Bot, Check, ClipboardPaste, Sparkles, UploadCloud } from 'lucide-react';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { Textarea } from '../ui/Input';
import { AIChatInput } from './AIChatInput';
import { AIChangePreview } from './AIChangePreview';
import { cn } from '../../lib/utils';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  fieldApplied,
  inputTextChanged,
  proposalRejected,
  proposalsCleared,
  severityAccepted,
  severitySelected,
} from '../../features/deviation/deviationSlice';
import {
  averageConfidence,
  extractDocument,
  reassessImpact,
  reassessSeverity,
  refineRequest,
  runPipeline,
} from '../../features/deviation/deviationApi';
import {
  EXTRACTION_FIELDS,
  formValuesToExtractedFields,
  toExtractionKey,
  toFormKey,
  type DeviationFormValues,
  type Severity,
} from '../../features/deviation/deviationTypes';
import { SAMPLE_DEVIATION_TEXT } from '../../mocks/sampleText';

const ALLOWED = ['pdf', 'docx', 'txt', 'eml'];
const MAX_BYTES = 5 * 1024 * 1024;
const SEVERITIES: Severity[] = ['Minor', 'Major', 'Critical'];

const SEVERITY_DOT: Record<Severity, string> = {
  Minor: 'bg-[var(--neutral)]',
  Major: 'bg-[var(--warning)]',
  Critical: 'bg-[var(--critical)]',
};

const IMPACT_CHIP: Record<string, string> = {
  Low: 'bg-[var(--surface-muted)] text-[var(--body)]',
  Medium: 'bg-[var(--warning-chip-bg)] text-[var(--warning)]',
  High: 'bg-[var(--high-bg)] text-[var(--warning)]',
  Critical: 'bg-[var(--critical-chip-bg)] text-[var(--critical)]',
};

function validateFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED.includes(ext)) {
    return `Unsupported file type ".${ext}". Use PDF, DOCX, TXT or EML.`;
  }
  if (file.size > MAX_BYTES) {
    return 'File is larger than 5 MB.';
  }
  return null;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--fg-secondary)]">
      {children}
    </span>
  );
}

interface AiAssistantPanelProps {
  form: UseFormReturn<DeviationFormValues>;
}

export function AiAssistantPanel({ form }: AiAssistantPanelProps) {
  const dispatch = useAppDispatch();
  const {
    status,
    aiResult,
    input,
    error,
    proposals,
    refineMessage,
    proposalsLoading,
    severity,
    demoMode,
  } = useAppSelector((state) => state.deviation);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pct, setPct] = useState(20);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [rerunningImpact, setRerunningImpact] = useState(false);
  const [rerunningSeverity, setRerunningSeverity] = useState(false);

  const busy = status === 'extracting' || status === 'processing';
  const ready = status === 'ready' && aiResult !== null;
  const failed = status === 'error';

  useEffect(() => {
    if (!busy) {
      setPct(20);
      return;
    }
    setPct(20);
    const timer = window.setInterval(() => {
      setPct((current) => Math.min(95, current + 15));
    }, 500);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    if (form.getValues('final_severity') !== severity.final) {
      form.setValue('final_severity', severity.final, { shouldDirty: false });
    }
  }, [severity.final, form]);

  const handleFile = async (file: File | undefined) => {
    if (!file || busy) return;
    const problem = validateFile(file);
    setUploadError(problem);
    if (problem) return;
    setPasteOpen(true);
    const action = await dispatch(extractDocument(file));
    if (extractDocument.fulfilled.match(action)) {
      dispatch(
        runPipeline({ text: action.payload.text, sourceType: action.payload.source_type }),
      );
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  const process = () => {
    if (!input.text.trim() || busy) return;
    dispatch(runPipeline({ text: input.text, sourceType: input.sourceType ?? 'text' }));
  };

  const loadSample = () => {
    dispatch(inputTextChanged({ text: SAMPLE_DEVIATION_TEXT, sourceType: 'txt' }));
    setPasteOpen(true);
    setUploadError(null);
  };

  const sendRefine = (instruction: string) => {
    dispatch(
      refineRequest({
        instruction,
        currentFields: formValuesToExtractedFields(form.getValues()),
        validation: aiResult?.validation ?? null,
        rawText: input.text,
      }),
    );
  };

  const applyProposal = (index: number) => {
    const proposal = proposals[index];
    if (!proposal) return;
    form.setValue(toFormKey(proposal.field), proposal.proposed_value ?? '', {
      shouldValidate: true,
      shouldDirty: true,
    });
    dispatch(fieldApplied(toExtractionKey(proposal.field)));
    dispatch(proposalRejected(index));
  };

  const rerunImpact = async () => {
    setRerunningImpact(true);
    const action = await dispatch(
      reassessImpact({
        fields: formValuesToExtractedFields(form.getValues()),
        rawText: input.text,
      }),
    );
    setRerunningImpact(false);
    if (reassessImpact.fulfilled.match(action) && !form.formState.dirtyFields.initial_impact) {
      form.setValue('initial_impact', action.payload.impact.impact_level, {
        shouldValidate: true,
      });
    }
  };

  const rerunSeverity = async () => {
    setRerunningSeverity(true);
    await dispatch(
      reassessSeverity({
        fields: formValuesToExtractedFields(form.getValues()),
        validation: aiResult?.validation ?? null,
        rawText: input.text,
      }),
    );
    setRerunningSeverity(false);
  };

  const pasteVisible = pasteOpen || input.text.trim().length > 0;
  const populated = aiResult
    ? EXTRACTION_FIELDS.filter((field) => aiResult.extraction.data[field] !== null).length
    : 0;
  const average = aiResult ? Math.round(averageConfidence(aiResult) * 100) : 0;
  const missing = aiResult?.validation.missing_information ?? [];
  const impact = aiResult?.impact ?? null;
  const assessment = aiResult?.severity ?? null;

  return (
    <aside
      className="flex flex-col gap-4 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm"
      aria-label="AI Deviation Assistant"
      data-testid="ai-assistant-panel"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--brand)]" aria-hidden />
          <h2 className="text-[15px] font-semibold text-[var(--heading)]">AI Deviation Assistant</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={demoMode ? 'warning' : 'success'} data-testid="provider-badge">
            {demoMode ? 'Demo AI Mode' : 'Live AI'}
          </Badge>
          <span className="rounded-full border border-[var(--info-border)] bg-[var(--ai)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--brand)]">
            Beta
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div
          data-testid="dropzone"
          role="button"
          tabIndex={0}
          aria-label="Upload supporting document"
          onClick={() => {
            if (!busy) document.getElementById('ai-upload-input')?.click();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (!busy) document.getElementById('ai-upload-input')?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex h-[110px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 text-center transition-colors',
            dragging
              ? 'border-[var(--brand)] bg-[var(--ai)]'
              : 'border-[var(--border-strong)] bg-[var(--surface-secondary-a60)] hover:border-[var(--brand-soft)] hover:bg-[var(--ai-a50)]',
          )}
        >
          <UploadCloud className="h-5 w-5 text-[var(--brand)]" aria-hidden />
          <p className="text-sm font-medium text-[var(--heading)]">
            Drag &amp; drop supporting document here
          </p>
          <p className="text-xs font-medium text-[var(--brand)]">or click to browse</p>
          <input
            id="ai-upload-input"
            type="file"
            accept=".pdf,.docx,.txt,.eml"
            className="hidden"
            aria-label="Choose a supporting document"
            disabled={busy}
            onChange={(event) => handleFile(event.target.files?.[0])}
            onClick={(event) => event.stopPropagation()}
          />
        </div>

        <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-[var(--fg-muted)]">
          <span className="h-px flex-1 bg-[var(--border-soft)]" aria-hidden />
          or
          <span className="h-px flex-1 bg-[var(--border-soft)]" aria-hidden />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full justify-center"
          onClick={() => setPasteOpen((open) => !open)}
          disabled={busy}
          data-testid="paste-toggle"
        >
          <ClipboardPaste className="h-4 w-4" aria-hidden />
          Paste deviation details / notes
        </Button>

        {pasteVisible ? (
          <div className="space-y-2">
            <Textarea
              data-testid="source-text"
              aria-label="Deviation text"
              placeholder="Paste the deviation report text here…"
              rows={6}
              value={input.text}
              onChange={(event) => dispatch(inputTextChanged({ text: event.target.value }))}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-[var(--fg-muted)]">{input.text.length} characters</span>
              <Button
                type="button"
                size="sm"
                onClick={process}
                disabled={!input.text.trim() || busy}
                data-testid="process-button"
                className="bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]"
              >
                {busy ? (
                  <>
                    <Spinner /> Processing…
                  </>
                ) : (
                  'Extract with AI'
                )}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end">
          <button
            type="button"
            data-testid="use-sample"
            onClick={loadSample}
            disabled={busy}
            className="text-xs font-medium text-[var(--brand)] hover:underline disabled:opacity-50"
          >
            Use sample deviation
          </button>
        </div>

        {uploadError ? (
          <Alert variant="destructive" data-testid="upload-error">
            {uploadError}
          </Alert>
        ) : null}

        <div className="rounded-md border border-[var(--success-border)] bg-[var(--success-surface)] px-3 py-2 text-xs leading-relaxed text-[var(--success-chip-fg)]">
          <p>
            <span className="font-semibold">Supported formats:</span> PDF, DOCX, TXT, EML
          </p>
          <p>
            <span className="font-semibold">Max file size:</span> 5MB
          </p>
        </div>
      </div>

      {busy ? (
        <div data-testid="extraction-progress">
          <div className="flex items-center justify-between">
            <SectionLabel>Extraction Progress</SectionLabel>
            <span className="text-xs font-semibold text-[var(--brand)]">{pct}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--fg-secondary)]">
            Analyzing document content and extracting key details...
          </p>
          <p className="text-xs font-semibold text-[var(--brand)]">Please wait...</p>
          <p className="mt-1 text-xs text-[var(--fg-soft)]">
            Rate-limited AI requests are retried automatically (up to 3 attempts).
          </p>
        </div>
      ) : null}

      {failed && error ? (
        <div className="space-y-3">
          <Alert variant="destructive" title="AI processing failed" data-testid="ai-error">
            {error}
          </Alert>
          <Button type="button" size="sm" onClick={process} data-testid="retry-button">
            Retry
          </Button>
        </div>
      ) : null}

      {ready && aiResult ? (
        <div className="space-y-4" data-testid="extraction-results">
          <div className="space-y-2">
            <SectionLabel>Extraction Results</SectionLabel>
            <div className="rounded-lg border border-[var(--success-border)] bg-[var(--success-surface)] p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--success-fg)]">
                <Check className="h-4 w-4" aria-hidden />
                AI Extraction Complete
              </div>
              <p className="mt-1 text-sm text-[var(--success-strong)]">{populated} of 20 fields extracted</p>
              <p className="text-sm text-[var(--success-strong)]">Average confidence: {average}%</p>
            </div>
          </div>

          {aiResult.errors.length > 0 ? (
            <Alert variant="warning" title="AI notes" data-testid="ai-notes">
              <ul className="list-disc space-y-0.5 pl-4">
                {aiResult.errors.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <SectionLabel>Impact Assessment</SectionLabel>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={rerunImpact}
                disabled={rerunningImpact}
                data-testid="rerun-impact"
              >
                {rerunningImpact ? 'Re-running…' : 'Re-run'}
              </Button>
            </div>
            {impact ? (
              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-sm font-semibold ${IMPACT_CHIP[impact.impact_level] ?? IMPACT_CHIP.Medium}`}
                    data-testid="impact-level"
                  >
                    {impact.impact_level}
                  </span>
                  {impact.impact_areas.map((area) => (
                    <Badge key={area} variant="outline">
                      {area}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-[var(--fg-soft)]">{impact.reason}</p>
              </div>
            ) : (
              <p className="text-xs text-[var(--fg-secondary)]" data-testid="impact-empty">
                No impact assessment — the source lacked the information needed. Nothing was
                assumed.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <SectionLabel>Initial Severity</SectionLabel>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={rerunSeverity}
                disabled={rerunningSeverity}
                data-testid="rerun-severity"
              >
                {rerunningSeverity ? 'Re-running…' : 'Re-run'}
              </Button>
            </div>
            <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
              {assessment ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-[var(--fg-secondary)]">AI recommends</span>
                  <Badge variant="warning" data-testid="ai-recommendation">
                    {assessment.recommended_severity}
                  </Badge>
                  <span className="text-xs text-[var(--fg-secondary)]">
                    · {Math.round(assessment.confidence * 100)}% confidence
                  </span>
                </div>
              ) : (
                <p className="text-sm text-[var(--fg-secondary)]" data-testid="severity-empty">
                  No AI recommendation — classify manually.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-[var(--fg-secondary)]">Selected:</span>
                <strong className="text-[var(--heading)]" data-testid="final-severity">
                  {form.watch('final_severity')}
                </strong>
                {assessment && severity.final !== assessment.recommended_severity ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => dispatch(severityAccepted())}
                    data-testid="accept-ai-severity"
                  >
                    Accept AI recommendation
                  </Button>
                ) : null}
              </div>

              <div role="radiogroup" aria-label="Final severity" className="flex flex-wrap gap-2">
                {SEVERITIES.map((level) => (
                  <label
                    key={level}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                      severity.final === level
                        ? 'border-[var(--brand-soft)] bg-[var(--ai)] text-[var(--brand)]'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--body)] hover:bg-[var(--surface-secondary)]',
                    )}
                  >
                    <input
                      type="radio"
                      name="final_severity"
                      value={level}
                      checked={severity.final === level}
                      data-testid={`severity-${level.toLowerCase()}`}
                      onChange={() => {
                        form.setValue('final_severity', level, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        dispatch(severitySelected(level));
                      }}
                      className="sr-only"
                    />
                    <span className={cn('h-2.5 w-2.5 rounded-full', SEVERITY_DOT[level])} />
                    {level}
                  </label>
                ))}
              </div>

              {severity.overridden ? (
                <p className="text-xs text-[var(--warning-strong)]" data-testid="severity-overridden">
                  Overridden from the AI recommendation — your choice will be saved as final.
                </p>
              ) : null}

              {assessment ? (
                <p className="text-xs leading-relaxed text-[var(--fg-soft)]">{assessment.reason}</p>
              ) : null}
            </div>
          </div>

          {missing.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5" data-testid="missing-information">
              <span className="text-xs font-semibold text-[var(--warning-strong)]">Missing information:</span>
              {missing.map((field) => (
                <Badge key={field} variant="warning">
                  {field}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {!busy && !ready && !failed ? (
        <div className="rounded-lg border border-[var(--ai-border)] bg-[var(--ai)] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--brand-hover)]">
            <Bot className="h-4 w-4" aria-hidden />
            AI Assistant
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--body)]">
            Upload a report or paste notes above — I will extract the deviation details, assess
            impact and recommend a severity. Nothing is saved until you review it and press Save
            Deviation.
          </p>
        </div>
      ) : null}

      {proposals.length > 0 ? (
        <div className="space-y-3">
          {proposals.map((proposal, index) => (
            <AIChangePreview
              key={`${proposal.field}-${index}`}
              proposal={proposal}
              onApply={() => applyProposal(index)}
              onReject={() => dispatch(proposalRejected(index))}
            />
          ))}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => dispatch(proposalsCleared())}
            >
              Dismiss all
            </Button>
          </div>
        </div>
      ) : refineMessage ? (
        <p
          className="rounded-md bg-[var(--surface-secondary)] p-2 text-xs leading-relaxed text-[var(--fg-soft)]"
          data-testid="refine-message"
        >
          {refineMessage}
        </p>
      ) : null}

      <div className="mt-auto space-y-2 border-t border-[var(--border-soft)] pt-3">
        <AIChatInput
          onSend={sendRefine}
          loading={proposalsLoading}
          placeholder="Ask me anything about deviations…"
          showQuickPrompts={false}
        />
        <p className="text-[11px] leading-relaxed text-[var(--fg-muted)]">
          AI suggestions are advisory — final classification is your decision. Verify
          AI-generated content before saving.
        </p>
      </div>
    </aside>
  );
}
