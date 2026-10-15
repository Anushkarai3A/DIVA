import { Bot, CheckCircle2, PencilLine, ShieldCheck, Sparkles } from 'lucide-react';
import type { AuditEvent } from '../../features/deviation/deviationTypes';
import { cn } from '../../lib/utils';

const ICONS: Record<string, typeof Bot> = {
  created: CheckCircle2,
  ai_extracted: Sparkles,
  field_edited: PencilLine,
  severity_overridden: ShieldCheck,
  updated: PencilLine,
  ai_refinement_applied: Bot,
  ai_refinement_rejected: Bot,
};

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('from' in record || 'to' in record) {
      return `${String(record.from ?? '—')} → ${String(record.to ?? '—')}`;
    }
    return JSON.stringify(record);
  }
  return String(value);
}

function renderDetails(details: Record<string, unknown> | null): string[] {
  if (!details) return [];
  return Object.entries(details).map(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if ('from' in record || 'to' in record) {
        return `${key.replace(/_/g, ' ')}: ${renderValue(value)}`;
      }
    }
    if (Array.isArray(value)) {
      return `${key.replace(/_/g, ' ')}: ${value.join(', ')}`;
    }
    return `${key.replace(/_/g, ' ')}: ${renderValue(value)}`;
  });
}

const LABELS: Record<string, string> = {
  created: 'Deviation created',
  ai_extracted: 'AI extraction attached',
  field_edited: 'Field edited',
  severity_overridden: 'Severity overridden',
  updated: 'Deviation updated',
};

interface AuditTimelineProps {
  events: AuditEvent[];
}

export function AuditTimeline({ events }: AuditTimelineProps) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No audit events yet.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-[var(--border)] pl-5" data-testid="audit-timeline">
      {events.map((event) => {
        const Icon = ICONS[event.event_type] ?? PencilLine;
        return (
          <li key={event.id} className="relative" data-testid={`audit-${event.event_type}`}>
            <span
              className={cn(
                'absolute -left-[30px] flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface)] ring-2 ring-[var(--border)]',
              )}
            >
              <Icon className="h-3 w-3 text-[var(--brand)]" aria-hidden />
            </span>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-medium">
                {LABELS[event.event_type] ?? event.event_type}
              </span>
              <span className="text-xs text-[var(--fg-muted)]">
                {new Date(event.created_at).toLocaleString()}
              </span>
              <span className="text-xs text-[var(--fg-secondary)]">by {event.actor}</span>
            </div>
            {renderDetails(event.details).length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-xs text-[var(--fg-soft)]">
                {renderDetails(event.details).map((line) => (
                  <li key={line} className="font-mono">
                    {line}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
