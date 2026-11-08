'use client';

import { useState } from 'react';

interface VigenereDecoderToolProps {
  onPlaintextChange: (val: string) => void;
  onExplanationChange: (val: string) => void;
  disabled?: boolean;
}

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function VigenereDecoderTool({
  onPlaintextChange,
  onExplanationChange,
  disabled,
}: VigenereDecoderToolProps) {
  const [plaintext, setPlaintext] = useState('');
  const [explanation, setExplanation] = useState('');

  // Interactive Table lookup helper
  const [calcKey, setCalcKey] = useState('LEMON');
  const [calcCipher, setCalcCipher] = useState('LXFOPVEFRNHR');
  const [showTable, setShowTable] = useState(false);

  return (
    <div className="space-y-8">
      {/* Vigenere Cryptanalysis Workbench */}
      <div className="p-6 rounded-xl bg-surface-card border border-surface-border space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono-code text-xs text-accent-blue uppercase tracking-widest block mb-1">
              Cryptanalysis Workbench
            </span>
            <h3 className="text-xl font-bold text-white">Polyalphabetic Tabula Recta</h3>
          </div>
          <button
            type="button"
            onClick={() => setShowTable(!showTable)}
            className="px-3 py-1.5 rounded bg-surface-dark border border-surface-border text-xs font-mono-code text-typography-muted hover:text-white transition-colors"
          >
            {showTable ? 'Hide Tabula Recta' : 'View Tabula Recta Grid'}
          </button>
        </div>

        {/* Tabula Recta Matrix */}
        {showTable && (
          <div className="p-4 rounded-lg bg-surface-dark border border-surface-border overflow-x-auto">
            <div className="min-w-[600px] text-[10px] font-mono-code text-typography-muted">
              <div className="grid grid-cols-[auto_repeat(26,1fr)] gap-1 text-center font-bold text-accent-blue pb-1 border-b border-surface-border">
                <div> </div>
                {alphabet.split('').map((c) => (
                  <div key={c}>{c}</div>
                ))}
              </div>
              {alphabet.split('').map((rowChar, rIdx) => (
                <div key={rowChar} className="grid grid-cols-[auto_repeat(26,1fr)] gap-1 text-center py-0.5 hover:bg-surface-border/40">
                  <div className="font-bold text-accent-blue pr-2">{rowChar}</div>
                  {alphabet.split('').map((_, cIdx) => {
                    const shifted = alphabet[(rIdx + cIdx) % 26];
                    return <div key={cIdx}>{shifted}</div>;
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Target Ciphertext & Known Key */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-surface-dark border border-surface-border">
            <span className="text-[10px] font-mono-code text-typography-muted uppercase tracking-widest block mb-1">
              Target Intercepted Ciphertext
            </span>
            <span className="font-mono-code font-bold text-lg text-white tracking-widest">
              LXFOPVEFRNHR
            </span>
          </div>

          <div className="p-4 rounded-lg bg-surface-dark border border-surface-border">
            <span className="text-[10px] font-mono-code text-typography-muted uppercase tracking-widest block mb-1">
              Derived Key Keyword
            </span>
            <span className="font-mono-code font-bold text-lg text-accent-hover tracking-widest">
              LEMON
            </span>
          </div>
        </div>
      </div>

      {/* Two-Part Submission: Plaintext (150 pts) + Technical Proof Explanation (150 pts) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-surface-card border border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono-code text-white uppercase tracking-wider font-semibold">
              Part 1: Decrypted Plaintext
            </label>
            <span className="text-xs font-mono-code text-accent-blue">150 pts</span>
          </div>
          <p className="text-xs text-typography-muted">
            Enter the exact plaintext word resulting from Vigenere decryption.
          </p>
          <input
            type="text"
            disabled={disabled}
            value={plaintext}
            onChange={(e) => {
              const upper = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
              setPlaintext(upper);
              onPlaintextChange(upper);
            }}
            placeholder="e.g. ATTACK..."
            className="w-full px-4 py-3 rounded-lg bg-surface-dark border border-surface-border focus:border-accent-blue text-white font-mono-code text-base uppercase tracking-widest"
          />
        </div>

        <div className="p-6 rounded-xl bg-surface-card border border-surface-border space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono-code text-white uppercase tracking-wider font-semibold">
              Part 2: Technical Explanation Proof
            </label>
            <span className="text-xs font-mono-code text-accent-blue">150 pts</span>
          </div>
          <p className="text-xs text-typography-muted">
            Detail the cipher technique and how the repeating key was mapped modularly.
          </p>
          <textarea
            rows={4}
            disabled={disabled}
            value={explanation}
            onChange={(e) => {
              setExplanation(e.target.value);
              onExplanationChange(e.target.value);
            }}
            placeholder="Explain the Vigenere decryption formula, how the key LEMON repeats, and modular arithmetic applied..."
            className="w-full p-4 rounded-lg bg-surface-dark border border-surface-border focus:border-accent-blue text-white text-xs leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}
