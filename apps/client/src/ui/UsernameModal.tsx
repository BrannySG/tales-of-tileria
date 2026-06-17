import { useState } from 'react';

/**
 * The divine-name capture modal (see ADR-0011 / Phase 8). Shown once, when the
 * shrine is enabled undedicated. Confirming sends the name to the sim
 * (`player.setName`), which dedicates the shrine and unlocks crafting.
 */
export function UsernameModal({ onConfirm }: { onConfirm: (name: string) => void }) {
  const [name, setName] = useState('');
  const trimmed = name.trim();

  const submit = () => {
    if (trimmed) onConfirm(trimmed.slice(0, 16));
  };

  return (
    <div className="name-overlay">
      <div className="name-panel">
        <h2 className="name-title">What name should Tileria remember?</h2>
        <input
          className="name-input"
          autoFocus
          maxLength={16}
          value={name}
          placeholder="Enter your divine name…"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        <button className="name-confirm" disabled={!trimmed} onClick={submit}>
          Be Known
        </button>
      </div>
    </div>
  );
}
