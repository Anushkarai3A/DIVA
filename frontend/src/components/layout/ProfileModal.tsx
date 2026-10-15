import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  company: string;
}

const ROWS: Array<{ label: string; value: string }> = [
  { label: 'Name', value: 'MH' },
  { label: 'Role', value: 'Quality User' },
];

export function ProfileModal({ open, onClose, company }: ProfileModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Profile">
      <dl className="space-y-3 text-sm" data-testid="profile-panel">
        {ROWS.map((row) => (
          <div key={row.label} className="grid grid-cols-[110px_1fr] items-baseline gap-3">
            <dt className="text-xs uppercase tracking-wide text-[var(--fg-secondary)]">{row.label}</dt>
            <dd className="font-medium text-[var(--heading)]">{row.value}</dd>
          </div>
        ))}
        <div className="grid grid-cols-[110px_1fr] items-baseline gap-3">
          <dt className="text-xs uppercase tracking-wide text-[var(--fg-secondary)]">Organization</dt>
          <dd className="font-medium text-[var(--heading)]">{company}</dd>
        </div>
      </dl>
      <div className="mt-5 flex justify-end">
        <Button onClick={onClose} data-testid="profile-close">
          Close
        </Button>
      </div>
    </Modal>
  );
}
