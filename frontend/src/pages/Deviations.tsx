import { useEffect, useState } from 'react';
import { PlusCircle, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { DeviationTable } from '../components/deviation/DeviationTable';
import { listDeviations } from '../services/api';
import type { Deviation } from '../features/deviation/deviationTypes';

const SEVERITIES = ['All', 'Minor', 'Major', 'Critical'] as const;

export function Deviations() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Deviation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('All');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await listDeviations({
          search: search || undefined,
          severity: severity === 'All' ? undefined : severity,
          page_size: 100,
        });
        if (!cancelled) {
          setItems(result.items);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, severity]);

  return (
    <section className="space-y-5" aria-label="Deviations">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--heading)]">Deviations</h1>
          <p className="text-sm text-[var(--fg-secondary)]">Manage and review reported deviations.</p>
        </div>
        <Button onClick={() => navigate('/new-deviation')} data-testid="new-deviation-cta">
          <PlusCircle className="h-4 w-4" aria-hidden />
          Log Deviation
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--fg-secondary)]" aria-hidden />
          <Input
            aria-label="Search deviations"
            placeholder="Search title, batch, product…"
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            data-testid="search-input"
          />
        </div>
        <div className="flex gap-1" role="group" aria-label="Filter by severity">
          {SEVERITIES.map((level) => (
            <button
              key={level}
              onClick={() => setSeverity(level)}
              data-testid={`filter-${level.toLowerCase()}`}
              className={
                severity === level
                  ? 'rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs font-medium text-white'
                  : 'rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--fg-secondary)] hover:bg-[var(--page)] hover:text-[var(--heading)]'
              }
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-[var(--critical)]" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6 text-[var(--brand)]" />
        </div>
      ) : (
        <DeviationTable items={items} showProduct numberLabel="Deviation Number" />
      )}
    </section>
  );
}
