import { useState } from 'react';
import { SendHorizonal } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';

const QUICK_PROMPTS = [
  'Rephrase the description professionally',
  'What information is missing?',
  'Explain why severity is Major',
  'Re-extract the batch number',
];

interface AIChatInputProps {
  onSend: (instruction: string) => void;
  loading?: boolean;
  placeholder?: string;
  showQuickPrompts?: boolean;
}

export function AIChatInput({
  onSend,
  loading,
  placeholder = 'Ask AI to refine a field…',
  showQuickPrompts = true,
}: AIChatInputProps) {
  const [value, setValue] = useState('');

  const send = (text?: string) => {
    const instruction = (text ?? value).trim();
    if (!instruction || loading) return;
    onSend(instruction);
    setValue('');
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          data-testid="refine-input"
          aria-label="Ask AI to refine"
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') send();
          }}
        />
        <Button
          size="icon"
          onClick={() => send()}
          disabled={loading || !value.trim()}
          aria-label="Send refinement request"
          data-testid="refine-send"
        >
          {loading ? <Spinner /> : <SendHorizonal className="h-4 w-4" />}
        </Button>
      </div>
      {showQuickPrompts ? (
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              data-testid={`quick-prompt-${QUICK_PROMPTS.indexOf(prompt)}`}
              onClick={() => send(prompt)}
              disabled={loading}
              className="rounded-full border bg-[var(--surface-secondary)] px-2.5 py-1 text-xs text-[var(--fg-soft)] transition-colors hover:bg-[var(--ai)] hover:text-[var(--brand)] disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
