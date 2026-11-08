'use client';

import { useState } from 'react';
import type { RoundType } from '@/lib/crypto/schemas';

export interface SpecialRoundContentConfig {
  round_type: RoundType;
  // Polybius
  grid_layout?: string[][];
  ciphertext_pairs?: string;
  polybius_plaintext?: string;
  // Scramble
  scramble_words?: Array<{ id: number; word: string; clue: string; points: number }>;
  // Memory
  substitution_key?: Record<string, string>;
  reveal_seconds?: number;
  memory_words?: Array<{ cipher_word: string; plain_word: string; points: number }>;
  // Auction
  auction_ciphertext?: string;
  auction_plaintext?: string;
  auction_base_points?: number;
  auction_penalty_per_hint?: number;
  auction_hints?: string[];
  // Colour
  colour_a?: string;
  colour_b?: string;
  colour_sequences?: string[][];
  colour_plaintext?: string;
  // Vigenere
  vigenere_ciphertext?: string;
  vigenere_key?: string;
  vigenere_plaintext?: string;
  vigenere_plaintext_points?: number;
  vigenere_explanation_points?: number;
  vigenere_keywords?: string[];
  // Jury
  jury_max_points?: number;
  jury_criteria?: string;
}

interface SpecialRoundEditorProps {
  roundType: RoundType;
  initialConfig: SpecialRoundContentConfig;
  onSave: (config: SpecialRoundContentConfig) => Promise<void>;
  isLockedOrScored: boolean;
  requireElevation: (action: () => Promise<void>) => void;
}

export function SpecialRoundEditor({
  roundType,
  initialConfig,
  onSave,
  isLockedOrScored,
  requireElevation,
}: SpecialRoundEditorProps) {
  const [config, setConfig] = useState<SpecialRoundContentConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSave = () => {
    requireElevation(async () => {
      setSaving(true);
      setStatusMsg(null);
      try {
        await onSave(config);
        setStatusMsg('Special round template configuration successfully synced.');
      } catch (err: any) {
        setStatusMsg(`Save Error: ${err.message || 'Failed to update'}`);
      } finally {
        setSaving(false);
      }
    });
  };

  return (
    <div className="p-6 rounded-xl bg-surface-card border border-surface-border space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-surface-border">
        <div>
          <span className="text-[10px] font-mono-code text-accent-blue uppercase tracking-widest block mb-1">
            Template Configuration Engine
          </span>
          <h3 className="text-xl font-bold text-white uppercase">
            {roundType} Content & Answer Secrets
          </h3>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || isLockedOrScored}
          className="px-5 py-2 rounded bg-accent-blue hover:bg-accent-hover text-white text-xs font-mono-code font-bold transition-all shadow-sm shadow-accent-glow disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save Template Content'}
        </button>
      </div>

      {statusMsg && (
        <div className={`p-3 rounded-lg text-xs font-mono-code border ${
          statusMsg.startsWith('Save Error')
            ? 'bg-red-950/40 border-red-800/40 text-red-300'
            : 'bg-green-950/40 border-green-800/40 text-green-300'
        }`}>
          {statusMsg}
        </div>
      )}

      {/* 1. POLYBIUS GRID EDITOR */}
      {roundType === 'polybius' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
              Row-Column Coordinate Pairs (Ciphertext)
            </label>
            <input
              type="text"
              value={config.ciphertext_pairs || '32-15-15-44 / 11-44 / 22-11-44-15'}
              onChange={(e) => setConfig({ ...config, ciphertext_pairs: e.target.value })}
              className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs font-mono-code"
            />
          </div>

          <div>
            <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
              Target Plaintext Answer (Private Secret)
            </label>
            <input
              type="text"
              value={config.polybius_plaintext || 'MEET AT GATE'}
              onChange={(e) => setConfig({ ...config, polybius_plaintext: e.target.value })}
              className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs font-mono-code"
            />
          </div>
        </div>
      )}

      {/* 2. CIPHER SCRAMBLE EDITOR */}
      {roundType === 'scramble' && (
        <div className="space-y-4">
          <label className="block text-xs font-mono-code text-typography-muted uppercase">
            Target Cryptographic Anagram Words & Clues
          </label>
          {(config.scramble_words || [
            { id: 1, word: 'VIGENERE', clue: 'Polyalphabetic cipher invented in the 16th century', points: 30 },
            { id: 2, word: 'ALPHABET', clue: 'Ordered set of letters forming the basis of a cipher system', points: 30 },
            { id: 3, word: 'PUZZLE', clue: 'Cryptanalytic challenge or enigma to be cracked', points: 30 },
            { id: 4, word: 'LEVEL', clue: 'A palindrome word often used in security tiers', points: 30 },
            { id: 5, word: 'TEXT', clue: 'Written words before or after encryption (plain or cipher)', points: 30 },
          ]).map((w, idx) => (
            <div key={idx} className="p-3 rounded bg-surface-dark border border-surface-border grid grid-cols-1 md:grid-cols-12 gap-3 text-xs font-mono-code">
              <div className="md:col-span-3">
                <span className="text-[10px] text-typography-muted block">WORD {idx + 1}</span>
                <input
                  type="text"
                  value={w.word}
                  onChange={(e) => {
                    const list = [...(config.scramble_words || [])];
                    list[idx] = { ...list[idx], word: e.target.value.toUpperCase() };
                    setConfig({ ...config, scramble_words: list });
                  }}
                  className="w-full px-2 py-1 rounded bg-surface-card border border-surface-border text-white text-xs"
                />
              </div>
              <div className="md:col-span-7">
                <span className="text-[10px] text-typography-muted block">CLUE PROMPT</span>
                <input
                  type="text"
                  value={w.clue}
                  onChange={(e) => {
                    const list = [...(config.scramble_words || [])];
                    list[idx] = { ...list[idx], clue: e.target.value };
                    setConfig({ ...config, scramble_words: list });
                  }}
                  className="w-full px-2 py-1 rounded bg-surface-card border border-surface-border text-white text-xs"
                />
              </div>
              <div className="md:col-span-2">
                <span className="text-[10px] text-typography-muted block">POINTS</span>
                <input
                  type="number"
                  value={w.points}
                  onChange={(e) => {
                    const list = [...(config.scramble_words || [])];
                    list[idx] = { ...list[idx], points: Number(e.target.value) };
                    setConfig({ ...config, scramble_words: list });
                  }}
                  className="w-full px-2 py-1 rounded bg-surface-card border border-surface-border text-white text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. MEMORY CIPHER EDITOR */}
      {roundType === 'memory' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                Display Duration (Seconds before key hides)
              </label>
              <input
                type="number"
                min={3}
                max={120}
                value={config.reveal_seconds || 15}
                onChange={(e) => setConfig({ ...config, reveal_seconds: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs font-mono-code"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono-code text-typography-muted uppercase mb-2">
              Words to Decode (Cipher Word $\rightarrow$ Plain Word)
            </label>
            <div className="space-y-2">
              {(config.memory_words || [
                { cipher_word: 'UQZT', plain_word: 'GATE', points: 40 },
                { cipher_word: 'XFRTK', plain_word: 'UNDER', points: 40 },
                { cipher_word: 'QEETLL', plain_word: 'ACCESS', points: 40 },
                { cipher_word: 'KTLTZ', plain_word: 'RESET', points: 40 },
                { cipher_word: 'RGGK', plain_word: 'DOOR', points: 40 },
              ]).map((mw, idx) => (
                <div key={idx} className="flex items-center gap-3 font-mono-code text-xs">
                  <span className="text-typography-muted w-16">Word {idx + 1}:</span>
                  <input
                    type="text"
                    placeholder="Cipher"
                    value={mw.cipher_word}
                    onChange={(e) => {
                      const list = [...(config.memory_words || [])];
                      list[idx] = { ...list[idx], cipher_word: e.target.value.toUpperCase() };
                      setConfig({ ...config, memory_words: list });
                    }}
                    className="w-32 px-2 py-1 rounded bg-surface-dark border border-surface-border text-white"
                  />
                  <span>$\rightarrow$</span>
                  <input
                    type="text"
                    placeholder="Plain Answer"
                    value={mw.plain_word}
                    onChange={(e) => {
                      const list = [...(config.memory_words || [])];
                      list[idx] = { ...list[idx], plain_word: e.target.value.toUpperCase() };
                      setConfig({ ...config, memory_words: list });
                    }}
                    className="w-32 px-2 py-1 rounded bg-surface-dark border border-surface-border text-white"
                  />
                  <input
                    type="number"
                    placeholder="Pts"
                    value={mw.points}
                    onChange={(e) => {
                      const list = [...(config.memory_words || [])];
                      list[idx] = { ...list[idx], points: Number(e.target.value) };
                      setConfig({ ...config, memory_words: list });
                    }}
                    className="w-20 px-2 py-1 rounded bg-surface-dark border border-surface-border text-white"
                  />
                  <span>pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. CIPHER AUCTION EDITOR */}
      {roundType === 'auction' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                Rail Fence Ciphertext
              </label>
              <input
                type="text"
                value={config.auction_ciphertext || 'MEADWETTAN'}
                onChange={(e) => setConfig({ ...config, auction_ciphertext: e.target.value })}
                className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs font-mono-code"
              />
            </div>
            <div>
              <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                Decoded Plaintext Answer
              </label>
              <input
                type="text"
                value={config.auction_plaintext || 'MEET AT DAWN'}
                onChange={(e) => setConfig({ ...config, auction_plaintext: e.target.value })}
                className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs font-mono-code"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                Base Points (0 Hints)
              </label>
              <input
                type="number"
                value={config.auction_base_points || 200}
                onChange={(e) => setConfig({ ...config, auction_base_points: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs font-mono-code"
              />
            </div>
            <div>
              <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                Deduction Per Hint (pts)
              </label>
              <input
                type="number"
                value={config.auction_penalty_per_hint || 50}
                onChange={(e) => setConfig({ ...config, auction_penalty_per_hint: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs font-mono-code"
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. COLOUR CIPHER EDITOR */}
      {roundType === 'colour' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                Colour for A (Bit 0)
              </label>
              <input
                type="text"
                value={config.colour_a || 'Blue'}
                onChange={(e) => setConfig({ ...config, colour_a: e.target.value })}
                className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs font-mono-code"
              />
            </div>
            <div>
              <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                Colour for B (Bit 1)
              </label>
              <input
                type="text"
                value={config.colour_b || 'Orange'}
                onChange={(e) => setConfig({ ...config, colour_b: e.target.value })}
                className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs font-mono-code"
              />
            </div>
            <div>
              <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                Target Word Answer
              </label>
              <input
                type="text"
                value={config.colour_plaintext || 'CODE'}
                onChange={(e) => setConfig({ ...config, colour_plaintext: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs font-mono-code"
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. VIGENERE CRYPTANALYST EDITOR */}
      {roundType === 'vigenere' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                Ciphertext
              </label>
              <input
                type="text"
                value={config.vigenere_ciphertext || 'LXFOPVEFRNHR'}
                onChange={(e) => setConfig({ ...config, vigenere_ciphertext: e.target.value })}
                className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs font-mono-code"
              />
            </div>
            <div>
              <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                Derived Key
              </label>
              <input
                type="text"
                value={config.vigenere_key || 'LEMON'}
                onChange={(e) => setConfig({ ...config, vigenere_key: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs font-mono-code"
              />
            </div>
            <div>
              <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                Target Plaintext
              </label>
              <input
                type="text"
                value={config.vigenere_plaintext || 'ATTACKATDAWN'}
                onChange={(e) => setConfig({ ...config, vigenere_plaintext: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs font-mono-code"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
              Required Auto-Grading Keywords (Comma-separated)
            </label>
            <input
              type="text"
              value={(config.vigenere_keywords || ['vigenere', 'lemon', 'repeat', 'shift', 'modular']).join(', ')}
              onChange={(e) =>
                setConfig({
                  ...config,
                  vigenere_keywords: e.target.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
                })
              }
              className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs font-mono-code"
            />
          </div>
        </div>
      )}

      {/* 7. JURY MANUAL ROUND EDITOR */}
      {roundType === 'jury' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
              Evaluation Criteria & Rubric
            </label>
            <textarea
              rows={3}
              value={config.jury_criteria || 'Jury marks teams out of 100 on cryptanalytic defense, algorithm explanation, and presentation.'}
              onChange={(e) => setConfig({ ...config, jury_criteria: e.target.value })}
              className="w-full px-3 py-2 rounded bg-surface-dark border border-surface-border text-white text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
