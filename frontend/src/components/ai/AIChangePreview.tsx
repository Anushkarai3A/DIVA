import { ArrowDown, Check, X } from 'lucide-react';
import { Button } from '../ui/Button';
import type { Proposal } from '../../features/deviation/deviationTypes';

interface AIChangePreviewProps {
  proposal: Proposal;
  onApply: () => void;
  onReject: () => void;
}

export function AIChangePreview({ proposal, onApply, onReject }: AIChangePreviewProps) {
  return (
    <div
      className="space-y-2 rounded-lg border border-[var(--ai-border)] bg-[var(--ai-a50)] p-3"
      data-testid="change-preview"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">
        {proposal.field.replace(/_/g, ' ')}
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex items-start gap-2">
          <span className="w-16 shrink-0 text-xs text-[var(--fg-secondary)]">Current</span>
          <span className="break-all text-[var(--fg-soft)]" data-testid="current-value">
            {proposal.current_value ?? <em className="text-[var(--fg-muted)]">(empty)</em>}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <ArrowDown className="mt-1 h-3 w-3 shrink-0 text-[var(--brand)]" aria-hidden />
          <span className="w-12 shrink-0 text-xs text-[var(--fg-secondary)]">Proposed</span>
          <span className="break-all font-medium text-[var(--fg-strong)]" data-testid="proposed-value">
            {proposal.proposed_value ?? <em className="text-[var(--fg-muted)]">(empty)</em>}
          </span>
        </div>
      </div>
      <p className="text-xs text-[var(--fg-secondary)]">{proposal.reason}</p>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onReject}
          data-testid="reject-proposal"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Reject
        </Button>
        <Button size="sm" onClick={onApply} data-testid="apply-proposal">
          <Check className="h-3.5 w-3.5" aria-hidden />
          Apply
        </Button>
      </div>
    </div>
  );
}
