import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ClipboardList, PlusCircle, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { DeviationTable } from '../components/deviation/DeviationTable';
import { listDeviations } from '../services/api';
import type { Deviation } from '../features/deviation/deviationTypes';

export function Dashboard() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Deviation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listDeviations({ page_size: 100 })
      .then((result) => {
        if (!cancelled) setItems(result.items);
      })
      .catch(() => {
        /* dashboard stays usable with zero counts */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = items.filter((item) => item.status !== 'Closed').length;
  const major = items.filter((item) => item.final_severity === 'Major').length;
  const critical = items.filter((item) => item.final_severity === 'Critical').length;
  const recent = items.slice(0, 5);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 text-[var(--brand)]" />
      </div>
    );
  }

  return (
    <section className="space-y-6" aria-label="Dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--heading)]">Dashboard</h1>
          <p className="text-sm text-[var(--fg-secondary)]">Deviation intake at a glance.</p>
        </div>
        <Button onClick={() => navigate('/new-deviation')} data-testid="dashboard-new">
          <PlusCircle className="h-4 w-4" aria-hidden />
          Log Deviation
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[var(--fg-secondary)]">Open</CardTitle>
            <ClipboardList className="h-4 w-4 text-[var(--brand)]" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-[var(--heading)]" data-testid="count-open">
              {open}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[var(--fg-secondary)]">Major</CardTitle>
            <AlertTriangle className="h-4 w-4 text-[var(--warning)]" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-[var(--heading)]" data-testid="count-major">
              {major}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[var(--fg-secondary)]">Critical</CardTitle>
            <ShieldCheck className="h-4 w-4 text-[var(--critical)]" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-[var(--heading)]" data-testid="count-critical">
              {critical}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--heading)]">Recent deviations</h2>
          <Link to="/deviations" className="text-sm text-[var(--brand)] hover:underline">
            View all
          </Link>
        </div>
        <DeviationTable items={recent} />
      </div>
    </section>
  );
}
