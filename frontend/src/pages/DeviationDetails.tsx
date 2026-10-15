import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { AuditTimeline } from '../components/deviation/AuditTimeline';
import { getDeviation } from '../services/api';
import {
  FORM_FIELDS,
  type DeviationDetail,
} from '../features/deviation/deviationTypes';

const LABELS: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  event_date: 'Event date',
  reported_date: 'Reported date',
  department: 'Department',
  site: 'Site',
  product_name: 'Product name',
  product_code: 'Product code',
  batch_number: 'Batch number',
  manufacturing_stage: 'Manufacturing stage',
  process_parameter: 'Process parameter',
  approved_range: 'Approved range',
  actual_value: 'Actual value',
  unit: 'Unit',
  duration: 'Duration',
  equipment: 'Equipment',
  equipment_id: 'Equipment ID',
  immediate_action: 'Immediate action',
  potential_impact: 'Potential impact',
  root_cause_indication: 'Root cause indication',
};

const SEVERITY_VARIANT: Record<string, 'muted' | 'warning' | 'danger'> = {
  Minor: 'muted',
  Major: 'warning',
  Critical: 'danger',
};

export function DeviationDetails() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<DeviationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getDeviation(id)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load.');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <Alert variant="destructive" title="Could not load deviation">
        {error}
      </Alert>
    );
  }
  if (!detail) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 text-[var(--brand)]" />
      </div>
    );
  }

  const assessment = detail.ai_assessments[0] ?? null;
  const impact = assessment?.impact as
    | { impact_level?: string; impact_areas?: string[]; reason?: string }
    | null;
  const severity = assessment?.severity as
    | { recommended_severity?: string; confidence?: number; reason?: string; missing_information?: string[] }
    | null;
  const validation = assessment?.validation as
    | { missing_information?: string[]; ungrounded?: string[]; low_confidence?: string[] }
    | null;

  return (
    <section className="space-y-6" aria-label="Deviation details">
      <Link
        to="/deviations"
        className="inline-flex items-center gap-1 text-sm text-[var(--brand)] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to deviations
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm text-[var(--fg-secondary)]">{detail.deviation_number}</span>
        <h1 className="text-xl font-semibold">{detail.title}</h1>
        <Badge variant={SEVERITY_VARIANT[detail.final_severity] ?? 'muted'}>
          {detail.final_severity}
        </Badge>
        <Badge variant="outline">{detail.status}</Badge>
        {detail.ai_recommended_severity ? (
          <Badge variant="muted">AI: {detail.ai_recommended_severity}</Badge>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">
              Deviation Fields
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2" data-testid="detail-fields">
              {FORM_FIELDS.filter((field) => field !== 'title').map((field) => (
                <div key={field} className="min-w-0">
                  <dt className="text-xs uppercase tracking-wide text-[var(--fg-muted)]">
                    {LABELS[field] ?? field}
                  </dt>
                  <dd className="break-words text-sm text-[var(--fg-detail)]" data-testid={`detail-${field}`}>
                    {(detail as unknown as Record<string, string | null>)[field] ?? '—'}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card data-testid="ai-assessment-panel">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm font-semibold uppercase tracking-wide">
                AI Assessment
                {assessment ? (
                  <Badge variant="muted" className="font-mono">
                    {assessment.provider} · {assessment.model}
                  </Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!assessment ? (
                <p className="text-sm text-muted-foreground">
                  No AI assessment attached to this deviation.
                </p>
              ) : (
                <>
                  {impact ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">Impact:</span>
                        <Badge variant="warning">{impact.impact_level ?? '—'}</Badge>
                        {(impact.impact_areas ?? []).map((area) => (
                          <Badge key={area} variant="outline">
                            {area}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-[var(--fg-soft)]">{impact.reason}</p>
                    </div>
                  ) : null}
                  {severity ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">Severity:</span>
                        <Badge variant={SEVERITY_VARIANT[severity.recommended_severity ?? ''] ?? 'muted'}>
                          {severity.recommended_severity ?? '—'}
                        </Badge>
                        <span className="text-xs text-[var(--fg-secondary)]">
                          {severity.confidence !== undefined
                            ? `${Math.round(severity.confidence * 100)}% confidence`
                            : ''}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--fg-soft)]">{severity.reason}</p>
                    </div>
                  ) : null}
                  {validation && (validation.missing_information ?? []).length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-[var(--warning-strong)]">Missing:</span>
                      {(validation.missing_information ?? []).map((field) => (
                        <Badge key={field} variant="warning">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {assessment.explanation ? (
                    <p className="rounded-md bg-[var(--surface-secondary)] p-3 text-sm text-[var(--body)]">
                      {assessment.explanation}
                    </p>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wide">
                Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AuditTimeline events={detail.audit_events} />
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
