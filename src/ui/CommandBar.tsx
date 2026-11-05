import { useState, type FormEvent, type RefObject } from 'react';

interface Props {
  busy: boolean;
  onSubmit: (text: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function CommandBar({ busy, onSubmit, inputRef }: Props) {
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    onSubmit(t);
    setText('');
  };
  return (
    <form className="command" onSubmit={submit} aria-label="Command">
      <label className="sr-only" htmlFor="command-input">
        Type a command
      </label>
      <input
        id="command-input"
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="या लिखिए: do kilo atta, Sharma ji ke khate mein"
        autoComplete="off"
        enterKeyHint="send"
      />
      <button type="submit" disabled={busy || !text.trim()} aria-label="Send">
        भेजें
      </button>
    </form>
  );
}
