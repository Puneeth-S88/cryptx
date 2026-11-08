'use client';

import { useState } from 'react';

interface BaconColourTilesProps {
  onWordChange: (word: string) => void;
  disabled?: boolean;
}

// Seed Bacon tile patterns (Blue=A, Orange=B)
// AAABA -> C, ABBBA -> O, AAABB -> D, AABAA -> E (CODE)
const tileGroups = [
  { label: 'Letter 1', tiles: ['Blue', 'Blue', 'Blue', 'Orange', 'Blue'] },
  { label: 'Letter 2', tiles: ['Blue', 'Orange', 'Orange', 'Orange', 'Blue'] },
  { label: 'Letter 3', tiles: ['Blue', 'Blue', 'Blue', 'Orange', 'Orange'] },
  { label: 'Letter 4', tiles: ['Blue', 'Blue', 'Orange', 'Blue', 'Blue'] },
];

export function BaconColourTiles({ onWordChange, disabled }: BaconColourTilesProps) {
  const [word, setWord] = useState('');

  const handleChange = (val: string) => {
    const upper = val.toUpperCase().replace(/[^A-Z]/g, '');
    setWord(upper);
    onWordChange(upper);
  };

  return (
    <div className="space-y-8">
      {/* Visual Baconian Tiles */}
      <div className="p-6 rounded-xl bg-surface-card border border-surface-border space-y-6">
        <div className="flex items-center justify-between">
          <span className="font-mono-code text-xs text-accent-blue uppercase tracking-widest">
            Visual Binary Steganography
          </span>
          <div className="flex items-center gap-4 text-xs font-mono-code">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-600 inline-block" /> Blue = A (0)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Orange = B (1)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {tileGroups.map((group, gIdx) => (
            <div key={gIdx} className="p-4 rounded-lg bg-surface-dark border border-surface-border text-center space-y-3">
              <span className="font-mono-code text-[11px] text-typography-muted">{group.label}</span>
              <div className="flex items-center justify-center gap-2">
                {group.tiles.map((color, tIdx) => (
                  <div
                    key={tIdx}
                    className={`w-7 h-10 rounded shadow-md transition-transform hover:scale-105 ${
                      color === 'Blue' ? 'bg-blue-600 shadow-blue-900/50' : 'bg-amber-500 shadow-amber-900/50'
                    }`}
                    title={`${color}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Answer Submission Field */}
      <div className="max-w-md mx-auto space-y-2">
        <label className="block text-xs font-mono-code text-typography-muted uppercase tracking-wider">
          Decoded 4-Letter Word
        </label>
        <input
          type="text"
          maxLength={4}
          disabled={disabled}
          value={word}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="e.g. WORD"
          className="w-full px-4 py-3 rounded-lg bg-surface-dark border border-surface-border focus:border-accent-blue text-white font-mono-code text-xl uppercase tracking-widest text-center"
        />
      </div>
    </div>
  );
}
