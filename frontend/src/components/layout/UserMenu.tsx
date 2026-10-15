import { useCallback, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Monitor,
  Moon,
  Palette,
  Settings as SettingsIcon,
  Sun,
  User,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDismiss } from '../../lib/useDismiss';
import { useTheme, type ThemeChoice } from '../../lib/theme';
import { ProfileModal } from './ProfileModal';
import { SettingsModal } from './SettingsModal';

type ModalKind = 'profile' | 'settings' | null;

const THEME_OPTIONS: Array<{
  value: ThemeChoice;
  label: string;
  icon: typeof Sun;
  testId: string;
}> = [
  { value: 'light', label: 'Light', icon: Sun, testId: 'theme-light' },
  { value: 'dark', label: 'Dark', icon: Moon, testId: 'theme-dark' },
  { value: 'system', label: 'System', icon: Monitor, testId: 'theme-system' },
];

interface UserMenuProps {
  company: string;
}

export function UserMenu({ company }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [showThemes, setShowThemes] = useState(true);
  const { theme, setTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(containerRef, open, close);

  const items: Array<{
    label: string;
    testId: string;
    icon: typeof User;
    onSelect: () => void;
  }> = [
    {
      label: 'Profile',
      testId: 'user-profile',
      icon: User,
      onSelect: () => {
        close();
        setModal('profile');
      },
    },
    {
      label: 'Settings',
      testId: 'user-settings',
      icon: SettingsIcon,
      onSelect: () => {
        close();
        setModal('settings');
      },
    },
  ];

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded={open}
          data-testid="user-menu-button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-1 rounded-md py-1 pl-1 pr-1.5 transition-colors hover:bg-[var(--hover)]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#172554] text-xs font-semibold text-white">
            MH
          </span>
          <ChevronDown
            className={cn('h-4 w-4 text-[var(--fg-secondary)] transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </button>

        {open ? (
          <div
            role="menu"
            aria-label="Account"
            data-testid="user-menu"
            className="absolute right-0 top-full z-50 mt-1.5 w-[212px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[0_10px_24px_-8px_var(--shadow-color)]"
          >
            <div className="border-b border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2.5">
              <div className="text-sm font-semibold text-[var(--heading)]">MH</div>
              <div className="text-xs text-[var(--fg-secondary)]">Quality User</div>
            </div>

            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.testId}
                  type="button"
                  role="menuitem"
                  data-testid={item.testId}
                  onClick={item.onSelect}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-[var(--body)] transition-colors hover:bg-[var(--surface-secondary)]"
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                </button>
              );
            })}

            <button
              type="button"
              role="menuitem"
              aria-expanded={showThemes}
              data-testid="appearance-toggle"
              onClick={() => setShowThemes((value) => !value)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-[var(--body)] transition-colors hover:bg-[var(--surface-secondary)]"
            >
              <Palette className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1">Appearance</span>
              <ChevronRight
                className={cn(
                  'h-4 w-4 shrink-0 text-[var(--fg-muted)] transition-transform',
                  showThemes && 'rotate-90',
                )}
                aria-hidden
              />
            </button>

            {showThemes ? (
              <div
                role="group"
                aria-label="Appearance"
                data-testid="appearance-options"
                className="border-t border-[var(--border)] bg-[var(--surface-secondary)] px-1 py-1"
              >
                {THEME_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = theme === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      data-testid={option.testId}
                      onClick={() => setTheme(option.value)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors',
                        selected
                          ? 'bg-[var(--ai)] font-medium text-[var(--brand)]'
                          : 'text-[var(--body)] hover:bg-[var(--surface-muted)]',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="flex-1">{option.label}</span>
                      {selected ? (
                        <Check className="h-4 w-4 shrink-0" aria-hidden />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <ProfileModal open={modal === 'profile'} onClose={() => setModal(null)} company={company} />
      <SettingsModal open={modal === 'settings'} onClose={() => setModal(null)} company={company} />
    </>
  );
}
