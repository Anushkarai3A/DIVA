import { Monitor, Moon, Sun } from 'lucide-react';
import { useAppSelector } from '../../app/hooks';
import { cn } from '../../lib/utils';
import { useTheme, type ThemeChoice } from '../../lib/theme';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  company: string;
}

const THEME_OPTIONS: Array<{ value: ThemeChoice; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-3">
      <span className="text-xs uppercase tracking-wide text-[var(--fg-secondary)]">{label}</span>
      <span className="font-medium text-[var(--heading)]">{value}</span>
    </div>
  );
}

export function SettingsModal({ open, onClose, company }: SettingsModalProps) {
  const demoMode = useAppSelector((state) => state.deviation.demoMode);
  const { theme, setTheme } = useTheme();

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="space-y-3 text-sm" data-testid="settings-panel">
        <div>
          <span className="text-xs uppercase tracking-wide text-[var(--fg-secondary)]">
            Appearance
          </span>
          <div
            role="radiogroup"
            aria-label="Theme"
            data-testid="theme-radiogroup"
            className="mt-1.5 flex flex-wrap gap-2"
          >
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`theme-option-${option.value}`}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                    selected
                      ? 'border-[var(--brand)] bg-[var(--ai)] text-[var(--brand)]'
                      : 'border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--fg-secondary)] hover:bg-[var(--hover)]',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
                      selected ? 'border-[var(--brand)]' : 'border-[var(--border-strong)]',
                    )}
                    aria-hidden
                  >
                    {selected ? (
                      <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
                    ) : null}
                  </span>
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <SettingsRow label="AI Mode" value={demoMode ? 'Demo AI Mode' : 'Live AI'} />
        <SettingsRow label="Organization" value={company} />
      </div>
      <div className="mt-5 flex justify-end">
        <Button onClick={onClose} data-testid="settings-close">
          Close
        </Button>
      </div>
    </Modal>
  );
}
