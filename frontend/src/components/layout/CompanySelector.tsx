import { useCallback, useRef, useState } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDismiss } from '../../lib/useDismiss';

export const COMPANIES = ['Vasudha Pharma Chem Limited', 'DIVA Demo Organization'];

interface CompanySelectorProps {
  company: string;
  onChange: (company: string) => void;
}

export function CompanySelector({ company, onChange }: CompanySelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(containerRef, open, close);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="company-selector"
        onClick={() => setOpen((value) => !value)}
        className="hidden items-center gap-2 rounded-md border border-[var(--navbar-border)] px-3 py-2 text-[13px] font-medium text-[var(--body)] transition-colors hover:bg-[var(--page)] md:flex"
      >
        <Building2 className="h-4 w-4 text-[var(--fg-secondary)]" aria-hidden />
        <span className="max-w-[220px] truncate">{company}</span>
        <ChevronDown
          className={cn('h-4 w-4 text-[var(--fg-secondary)] transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Company"
          data-testid="company-menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-[272px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[0_10px_24px_-8px_var(--shadow-color)]"
        >
          <div className="border-b border-[var(--border)] bg-[var(--page)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-secondary)]">
            Company
          </div>
          {COMPANIES.map((option) => {
            const selected = option === company;
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                data-testid="company-option"
                onClick={() => {
                  onChange(option);
                  close();
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors',
                  selected
                    ? 'bg-[var(--ai)] font-medium text-[var(--brand)]'
                    : 'text-[var(--body)] hover:bg-[var(--page)]',
                )}
              >
                <span className="truncate">{option}</span>
                {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
