import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { COMPANIES, CompanySelector } from './CompanySelector';
import { UserMenu } from './UserMenu';

const COMPANY_STORAGE_KEY = 'diva-company';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Deviations', to: '/deviations' },
] as const;

function isActive(pathname: string, to: string): boolean {
  if (to === '/dashboard') return pathname === '/dashboard' || pathname === '/';
  if (to === '/deviations') {
    return pathname.startsWith('/deviations') || pathname === '/new-deviation';
  }
  return pathname === to;
}

export function QmsNavbar() {
  const { pathname } = useLocation();
  const [company, setCompany] = useState(() => {
    try {
      const stored = sessionStorage.getItem(COMPANY_STORAGE_KEY);
      if (stored && COMPANIES.includes(stored)) return stored;
    } catch {
      /* storage unavailable */
    }
    return COMPANIES[0];
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(COMPANY_STORAGE_KEY, company);
    } catch {
      /* storage unavailable */
    }
  }, [company]);

  return (
    <header
      className="sticky top-0 z-40 h-16 border-b border-[var(--navbar-border)] bg-[var(--navbar)]"
      data-testid="qms-navbar"
    >
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-6 px-4 lg:px-6">
        <div className="flex h-full items-center gap-5">
          <Link to="/dashboard" className="flex shrink-0 items-center gap-2.5" aria-label="DIVA home">
            <img
              src="/diva.png"
              alt="DIVA logo"
              className="h-10 w-auto object-contain"
              data-testid="diva-logo"
            />
            <span className="flex flex-col leading-none">
              <span className="text-[17px] font-bold tracking-tight text-[var(--heading)]">DIVA</span>
              <span className="mt-1 text-[10px] font-medium tracking-wide text-[var(--fg-secondary)]">
                AI for a Safer Tomorrow
              </span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden h-full items-stretch md:flex">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-full items-center px-3.5 text-sm font-medium transition-colors lg:px-4',
                    active
                      ? 'bg-[var(--ai)] text-[var(--brand)]'
                      : 'text-[var(--fg-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--heading)]',
                  )}
                >
                  {item.label}
                  {active ? (
                    <span
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--brand)]"
                      aria-hidden
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <CompanySelector company={company} onChange={setCompany} />
          <UserMenu company={company} />
        </div>
      </div>
    </header>
  );
}
