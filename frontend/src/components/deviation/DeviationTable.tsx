import { useNavigate } from 'react-router-dom';
import type { Deviation } from '../../features/deviation/deviationTypes';
import { Badge } from '../ui/Badge';

const SEVERITY_VARIANT: Record<string, 'muted' | 'warning' | 'danger'> = {
  Minor: 'muted',
  Major: 'warning',
  Critical: 'danger',
};

interface DeviationTableProps {
  items: Deviation[];
  showProduct?: boolean;
  numberLabel?: string;
}

export function DeviationTable({ items, showProduct, numberLabel = 'Number' }: DeviationTableProps) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--fg-secondary)]"
        data-testid="empty-table"
      >
        No deviations found. Use “Log Deviation” to create one.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--page)] text-left text-xs uppercase tracking-wide text-[var(--fg-secondary)]">
            <th className="px-4 py-3 font-medium">{numberLabel}</th>
            <th className="px-4 py-3 font-medium">Title</th>
            {showProduct ? <th className="px-4 py-3 font-medium">Product</th> : null}
            <th className="px-4 py-3 font-medium">Batch</th>
            <th className="px-4 py-3 font-medium">Severity</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {items.map((deviation) => (
            <tr
              key={deviation.id}
              className="cursor-pointer border-b border-[var(--border)] transition-colors last:border-b-0 hover:bg-[var(--ai-a60)]"
              data-testid="deviation-row"
              onClick={() => navigate(`/deviations/${deviation.id}`)}
            >
              <td className="px-4 py-3 font-mono text-xs">{deviation.deviation_number}</td>
              <td className="max-w-xs truncate px-4 py-3 font-medium text-[var(--body)]">
                {deviation.title}
              </td>
              {showProduct ? (
                <td className="px-4 py-3 text-[var(--body)]">{deviation.product_name ?? '—'}</td>
              ) : null}
              <td className="px-4 py-3 font-mono text-xs">{deviation.batch_number ?? '—'}</td>
              <td className="px-4 py-3">
                <Badge variant={SEVERITY_VARIANT[deviation.final_severity] ?? 'muted'}>
                  {deviation.final_severity}
                </Badge>
              </td>
              <td className="px-4 py-3 text-[var(--fg-secondary)]">{deviation.status}</td>
              <td className="px-4 py-3 text-xs text-[var(--fg-secondary)]">
                {new Date(deviation.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
