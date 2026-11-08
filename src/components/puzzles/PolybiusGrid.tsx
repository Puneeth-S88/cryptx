'use client';

import { useState } from 'react';

interface PolybiusGridProps {
  onMessageChange: (message: string) => void;
  disabled?: boolean;
}

const gridMatrix = [
  ['A', 'B', 'C', 'D', 'E'],
  ['F', 'G', 'H', 'I/J', 'K'],
  ['L', 'M', 'N', 'O', 'P'],
  ['Q', 'R', 'S', 'T', 'U'],
  ['V', 'W', 'X', 'Y', 'Z'],
];

export function PolybiusGrid({ onMessageChange, disabled }: PolybiusGridProps) {
  const [constructed, setConstructed] = useState<string>('');

  const handleCellClick = (letter: string) => {
    if (disabled) return;
    const char = letter === 'I/J' ? 'I' : letter;
    const next = constructed + char;
    setConstructed(next);
    onMessageChange(next);
  };

  const handleSpace = () => {
    if (disabled) return;
    const next = constructed + ' ';
    setConstructed(next);
    onMessageChange(next);
  };

  const handleBackspace = () => {
    if (disabled) return;
    const next = constructed.slice(0, -1);
    setConstructed(next);
    onMessageChange(next);
  };

  const handleClear = () => {
    if (disabled) return;
    setConstructed('');
    onMessageChange('');
  };

  return (
    <div className="space-y-6">
      {/* Interactive Display Output */}
      <div className="p-4 rounded-lg bg-surface-dark border border-surface-border flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono-code text-typography-muted uppercase tracking-widest block mb-1">
            Constructed Plaintext
          </span>
          <span className="font-mono-code font-bold text-xl text-white tracking-widest min-h-[1.75rem] inline-block">
            {constructed || <span className="text-zinc-600 font-normal">Click cells to spell message...</span>}
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono-code text-xs">
          <button
            type="button"
            onClick={handleSpace}
            disabled={disabled}
            className="px-3 py-1.5 rounded bg-surface-card hover:bg-surface-border border border-surface-border text-white transition-colors"
          >
            [SPACE]
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            disabled={disabled}
            className="px-3 py-1.5 rounded bg-surface-card hover:bg-surface-border border border-surface-border text-white transition-colors"
          >
            ⌫ Backspace
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="px-3 py-1.5 rounded bg-surface-card hover:bg-surface-border border border-surface-border text-red-400 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* 5x5 Polybius Click Matrix */}
      <div className="inline-block p-4 rounded-xl bg-surface-card border border-surface-border mx-auto">
        <div className="grid grid-cols-6 gap-2 text-center font-mono-code">
          {/* Header Row (Column Indices 1-5) */}
          <div className="w-12 h-12 flex items-center justify-center text-typography-muted font-bold">R\C</div>
          {[1, 2, 3, 4, 5].map((col) => (
            <div key={col} className="w-12 h-12 flex items-center justify-center text-accent-blue font-bold">
              {col}
            </div>
          ))}

          {/* Grid Rows with Row Index */}
          {gridMatrix.map((row, rIdx) => (
            <div key={rIdx} className="contents">
              <div className="w-12 h-12 flex items-center justify-center text-accent-blue font-bold">
                {rIdx + 1}
              </div>
              {row.map((cell, cIdx) => (
                <button
                  key={cIdx}
                  type="button"
                  onClick={() => handleCellClick(cell)}
                  disabled={disabled}
                  className="w-12 h-12 rounded-lg bg-surface-dark border border-surface-border hover:border-accent-blue hover:text-white text-typography-muted font-bold text-base transition-all active:scale-95 flex items-center justify-center"
                >
                  {cell}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
