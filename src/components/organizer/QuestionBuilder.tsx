'use client';

import { useState, useEffect } from 'react';
import type { QuestionType } from '@/lib/crypto/schemas';

export interface QuestionDraft {
  id?: string;
  order_index: number;
  question_type: QuestionType;
  question_text: string;
  monospace_code?: string;
  image_url?: string;
  options: string[];
  points: number;
  correct_option_index: number;
  accepted_answers: string[];
  text_settings: {
    ignore_case: boolean;
    ignore_punct_space: boolean;
    accept_multiple_answers: boolean;
  };
}

interface QuestionBuilderProps {
  roundId: string;
  initialQuestions: QuestionDraft[];
  onSave: (questions: QuestionDraft[]) => Promise<void>;
  isLockedOrScored: boolean;
  requireElevation?: (action: () => Promise<void>) => void;
}

export function QuestionBuilder({
  roundId,
  initialQuestions,
  onSave,
  isLockedOrScored,
}: QuestionBuilderProps) {
  const [questions, setQuestions] = useState<QuestionDraft[]>(initialQuestions);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [newAnswerText, setNewAnswerText] = useState('');

  // Sync internal state if initialQuestions prop updates from server fetch
  useEffect(() => {
    if (initialQuestions && initialQuestions.length > 0) {
      setQuestions(initialQuestions);
      setIsDirty(false);
    }
  }, [initialQuestions]);

  const activeQuestion = questions[selectedIndex] || null;

  const handleAddQuestion = (type: QuestionType) => {
    const newQ: QuestionDraft = {
      id: `q_${roundId}_${questions.length + 1}_${Date.now()}`,
      order_index: questions.length + 1,
      question_type: type,
      question_text: `New ${type.toUpperCase()} Question`,
      options: type === 'mcq' ? ['Option A', 'Option B', 'Option C', 'Option D'] : [],
      points: 10,
      correct_option_index: 0,
      accepted_answers: type === 'text' ? ['CORRECT_ANSWER'] : [],
      text_settings: {
        ignore_case: true,
        ignore_punct_space: true,
        accept_multiple_answers: true,
      },
    };
    setQuestions([...questions, newQ]);
    setSelectedIndex(questions.length);
    setIsDirty(true);
  };

  const handleDuplicate = (idx: number) => {
    const target = questions[idx];
    if (!target) return;
    const duplicated: QuestionDraft = {
      ...JSON.parse(JSON.stringify(target)),
      id: `q_${roundId}_${questions.length + 1}_${Date.now()}`,
      order_index: questions.length + 1,
      question_text: `${target.question_text} (Copy)`,
    };
    setQuestions([...questions, duplicated]);
    setSelectedIndex(questions.length);
    setIsDirty(true);
  };

  const handleDelete = (idx: number) => {
    if (questions.length <= 1) return;
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated);
    setSelectedIndex(Math.max(0, idx - 1));
    setIsDirty(true);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= questions.length) return;
    const items = [...questions];
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    setQuestions(items.map((q, i) => ({ ...q, order_index: i + 1 })));
    setSelectedIndex(toIndex);
    setIsDirty(true);
  };

  const updateActive = (field: Partial<QuestionDraft>) => {
    if (!activeQuestion) return;
    const updated = [...questions];
    updated[selectedIndex] = { ...activeQuestion, ...field };
    setQuestions(updated);
    setIsDirty(true);
  };

  const handleToggleQuestionType = (newType: QuestionType) => {
    if (!activeQuestion || activeQuestion.question_type === newType) return;
    updateActive({
      question_type: newType,
      options:
        newType === 'mcq' && (!activeQuestion.options || activeQuestion.options.length === 0)
          ? ['Option A', 'Option B', 'Option C', 'Option D']
          : activeQuestion.options,
      accepted_answers:
        newType === 'text' && (!activeQuestion.accepted_answers || activeQuestion.accepted_answers.length === 0)
          ? ['ANSWER']
          : activeQuestion.accepted_answers,
    });
  };

  const handleAddAcceptedAnswer = () => {
    const clean = newAnswerText.trim();
    if (!clean || !activeQuestion) return;
    if (!activeQuestion.accepted_answers.includes(clean)) {
      updateActive({
        accepted_answers: [...activeQuestion.accepted_answers, clean],
      });
    }
    setNewAnswerText('');
  };

  const handleRemoveAcceptedAnswer = (idx: number) => {
    if (!activeQuestion) return;
    updateActive({
      accepted_answers: activeQuestion.accepted_answers.filter((_, i) => i !== idx),
    });
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await onSave(questions);
      setSaveMessage('✓ All questions successfully saved and synced to database.');
      setIsDirty(false);
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message || 'Failed to save questions'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk Export JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(questions, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', `round_${roundId}_questions.json`);
    dl.click();
  };

  // Sum total marks automatically
  const totalMarks = questions.reduce((acc, q) => acc + (Number(q.points) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Bar with Total Marks & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-surface-card border border-surface-border">
        <div className="flex items-center gap-3">
          <span className="font-mono-code text-xs text-typography-muted">TOTAL QUESTIONS:</span>
          <span className="font-mono-code font-bold text-white text-base">{questions.length}</span>
          <span className="text-surface-border">|</span>
          <span className="font-mono-code text-xs text-typography-muted">CALCULATED TOTAL MARKS:</span>
          <span className="font-mono-code font-bold text-accent-hover text-base">{totalMarks} pts</span>
          {isDirty && (
            <span className="text-[11px] font-mono-code text-amber-300 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded animate-pulse">
              ● Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportJSON}
            className="px-3 py-1.5 rounded bg-surface-dark border border-surface-border text-xs font-mono-code text-typography-muted hover:text-white transition-colors"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => handleAddQuestion('mcq')}
            disabled={isLockedOrScored}
            className="px-3 py-1.5 rounded bg-surface-dark border border-surface-border hover:border-accent-blue text-xs font-mono-code text-white transition-colors"
          >
            + Add MCQ
          </button>
          <button
            type="button"
            onClick={() => handleAddQuestion('text')}
            disabled={isLockedOrScored}
            className="px-3 py-1.5 rounded bg-surface-dark border border-surface-border hover:border-accent-blue text-xs font-mono-code text-white transition-colors"
          >
            + Add TEXT
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-5 py-1.5 rounded bg-accent-blue hover:bg-accent-hover text-white text-xs font-mono-code font-semibold shadow-sm shadow-accent-glow transition-all flex items-center gap-2"
          >
            {isSaving && <span className="w-2.5 h-2.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
            <span>{isSaving ? 'Saving...' : 'Save Questions'}</span>
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className={`p-3 rounded-lg text-xs font-mono-code border flex items-center justify-between ${
          saveMessage.startsWith('Error')
            ? 'bg-red-950/40 border-red-800/40 text-red-300'
            : 'bg-green-950/40 border-green-800/40 text-green-300'
        }`}>
          <span>{saveMessage}</span>
          <button type="button" onClick={() => setSaveMessage(null)} className="text-typography-muted hover:text-white">✕</button>
        </div>
      )}

      {/* Main Builder Grid: Sidebar list & Editor View */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left: Questions List & Reordering */}
        <div className="md:col-span-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono-code text-typography-muted uppercase tracking-widest block">
              Round Questions List
            </span>
            <span className="text-[10px] font-mono-code text-typography-muted">
              Select to Edit
            </span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {questions.map((q, idx) => (
              <div
                key={q.id || idx}
                onClick={() => setSelectedIndex(idx)}
                className={`p-3 rounded-lg border text-xs font-mono-code cursor-pointer transition-all flex items-center justify-between ${
                  selectedIndex === idx
                    ? 'bg-surface-card border-accent-blue text-white shadow-neo-blue-sm font-semibold'
                    : 'bg-surface-dark border-surface-border text-typography-muted hover:border-surface-hover hover:text-typography-light'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden mr-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold ${
                    q.question_type === 'mcq'
                      ? 'bg-blue-950/50 border-blue-700/50 text-blue-300'
                      : 'bg-purple-950/50 border-purple-700/50 text-purple-300'
                  }`}>
                    Q{idx + 1} • {q.question_type}
                  </span>
                  <span className="truncate">{q.question_text || `Question ${idx + 1}`}</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-accent-hover font-bold mr-1">{q.points}p</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReorder(idx, idx - 1);
                    }}
                    disabled={idx === 0}
                    className="p-1 hover:text-white disabled:opacity-20"
                    title="Move question up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReorder(idx, idx + 1);
                    }}
                    disabled={idx === questions.length - 1}
                    className="p-1 hover:text-white disabled:opacity-20"
                    title="Move question down"
                  >
                    ▼
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Active Question Form & Live Preview */}
        {activeQuestion && (
          <div className="md:col-span-8 space-y-6">
            <div className="p-6 rounded-xl bg-surface-card border border-surface-border space-y-6">
              {/* Question Header: Title, Question Type Switcher, and Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-surface-border gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono-code px-2 py-0.5 rounded bg-accent-blue/20 text-accent-hover font-bold uppercase">
                    Question #{selectedIndex + 1}
                  </span>

                  {/* Question Type Toggle */}
                  <div className="flex items-center rounded-lg bg-surface-dark border border-surface-border p-0.5">
                    <button
                      type="button"
                      onClick={() => handleToggleQuestionType('mcq')}
                      className={`px-2.5 py-1 rounded text-xs font-mono-code font-bold uppercase transition-all ${
                        activeQuestion.question_type === 'mcq'
                          ? 'bg-accent-blue text-white shadow-neo-blue-sm'
                          : 'text-typography-muted hover:text-white'
                      }`}
                    >
                      MCQ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleQuestionType('text')}
                      className={`px-2.5 py-1 rounded text-xs font-mono-code font-bold uppercase transition-all ${
                        activeQuestion.question_type === 'text'
                          ? 'bg-accent-blue text-white shadow-neo-blue-sm'
                          : 'text-typography-muted hover:text-white'
                      }`}
                    >
                      Direct Text
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono-code">
                  <button
                    type="button"
                    onClick={() => handleDuplicate(selectedIndex)}
                    className="px-2.5 py-1 rounded bg-surface-dark border border-surface-border hover:text-white"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedIndex)}
                    disabled={questions.length <= 1}
                    className="px-2.5 py-1 rounded bg-surface-dark border border-surface-border hover:border-red-500/50 text-red-400 disabled:opacity-30"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Question Text & Marks */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                    Question Prompt / Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={activeQuestion.question_text}
                    onChange={(e) => updateActive({ question_text: e.target.value })}
                    placeholder="Enter the challenge prompt or cipher instruction..."
                    className="w-full px-3 py-2 rounded-lg bg-surface-dark border border-surface-border focus:border-accent-blue text-white text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                    Marks (pts)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={activeQuestion.points}
                    onChange={(e) => updateActive({ points: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-surface-dark border border-surface-border focus:border-accent-blue text-white font-mono-code text-xs"
                  />
                </div>
              </div>

              {/* Optional Monospace Cipher Display Block */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-mono-code text-typography-muted uppercase">
                    Monospace Display Box (Ciphertext, Algorithm Details, Binary)
                  </label>
                  <span className="text-[10px] font-mono-code text-typography-dim">
                    Rendered in high-contrast technical box
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={activeQuestion.monospace_code || ''}
                  onChange={(e) => updateActive({ monospace_code: e.target.value })}
                  placeholder="e.g. Ciphertext: FDW  |  Algorithm: Caesar Shift (Shift = 3) or 01001000 01001001"
                  className="w-full px-3 py-2 rounded-lg bg-surface-dark border border-surface-border focus:border-accent-blue text-accent-hover font-mono-code text-xs"
                />
              </div>

              {/* MCQ Type Editor */}
              {activeQuestion.question_type === 'mcq' && (
                <div className="space-y-3 pt-4 border-t border-surface-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-mono-code text-typography-muted uppercase block">
                        Options & Answer Key
                      </label>
                      <span className="text-[10px] font-mono-code text-typography-dim">
                        Click the radio button to select which option is the correct answer
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeQuestion.options.length < 6) {
                          updateActive({
                            options: [
                              ...activeQuestion.options,
                              `Option ${String.fromCharCode(65 + activeQuestion.options.length)}`,
                            ],
                          });
                        }
                      }}
                      disabled={activeQuestion.options.length >= 6}
                      className="text-xs font-mono-code text-accent-hover hover:underline disabled:opacity-30"
                    >
                      + Add Option (Max 6)
                    </button>
                  </div>

                  <div className="space-y-2">
                    {activeQuestion.options.map((opt, oIdx) => {
                      const isCorrect = activeQuestion.correct_option_index === oIdx;
                      return (
                        <div
                          key={oIdx}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                            isCorrect
                              ? 'bg-green-950/20 border-green-600/60 shadow-neo-green'
                              : 'bg-surface-dark border-surface-border'
                          }`}
                        >
                          <label className="flex items-center gap-2 cursor-pointer" title="Mark as correct answer">
                            <input
                              type="radio"
                              name={`correct_opt_${selectedIndex}`}
                              checked={isCorrect}
                              onChange={() => updateActive({ correct_option_index: oIdx })}
                              className="w-4 h-4 text-green-500 cursor-pointer"
                            />
                            <span className={`font-mono-code text-xs font-bold w-6 ${isCorrect ? 'text-green-400' : 'text-typography-muted'}`}>
                              {String.fromCharCode(65 + oIdx)})
                            </span>
                          </label>

                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const nextOpts = [...activeQuestion.options];
                              nextOpts[oIdx] = e.target.value;
                              updateActive({ options: nextOpts });
                            }}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-surface-card border border-surface-border focus:border-accent-blue text-white text-xs font-mono-code"
                          />

                          {isCorrect && (
                            <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-green-500/20 text-green-300 font-bold border border-green-500/40 whitespace-nowrap">
                              ✓ Correct Key
                            </span>
                          )}

                          {activeQuestion.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextOpts = activeQuestion.options.filter((_, i) => i !== oIdx);
                                updateActive({
                                  options: nextOpts,
                                  correct_option_index: Math.min(
                                    activeQuestion.correct_option_index,
                                    nextOpts.length - 1
                                  ),
                                });
                              }}
                              className="text-red-400 hover:text-red-300 text-xs px-2"
                              title="Delete option"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TEXT Type Editor */}
              {activeQuestion.question_type === 'text' && (
                <div className="space-y-4 pt-4 border-t border-surface-border">
                  <div>
                    <label className="block text-xs font-mono-code text-typography-muted uppercase mb-1">
                      Accepted Answers List
                    </label>
                    <p className="text-[10px] text-typography-dim mb-2">
                      Any answer in this list will award full question marks ({activeQuestion.points} pts).
                    </p>

                    {/* Interactive Accepted Answer Chips */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {activeQuestion.accepted_answers.map((ans, aIdx) => (
                        <span
                          key={aIdx}
                          className="px-2.5 py-1 rounded-lg bg-accent-blue/15 border border-accent-blue/40 text-accent-hover text-xs font-mono-code flex items-center gap-1.5"
                        >
                          <span className="font-bold">{ans}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAcceptedAnswer(aIdx)}
                            className="text-typography-muted hover:text-red-300 ml-1"
                            title="Remove answer"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                      {activeQuestion.accepted_answers.length === 0 && (
                        <span className="text-xs font-mono-code text-amber-400">
                          ⚠️ No accepted answers configured yet. Add at least one answer below.
                        </span>
                      )}
                    </div>

                    {/* Add New Answer Input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newAnswerText}
                        onChange={(e) => setNewAnswerText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddAcceptedAnswer();
                          }
                        }}
                        placeholder="Type an accepted answer (e.g. CAT, C A T) and press Enter..."
                        className="flex-1 px-3 py-2 rounded-lg bg-surface-dark border border-surface-border focus:border-accent-blue text-white font-mono-code text-xs uppercase"
                      />
                      <button
                        type="button"
                        onClick={handleAddAcceptedAnswer}
                        className="px-4 py-2 rounded-lg bg-surface-dark border border-surface-border hover:border-accent-blue text-white text-xs font-mono-code"
                      >
                        + Add Answer
                      </button>
                    </div>
                  </div>

                  {/* Text Normalization Settings */}
                  <div className="flex flex-wrap items-center gap-6 text-xs font-mono-code text-typography-muted pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeQuestion.text_settings.ignore_case}
                        onChange={(e) =>
                          updateActive({
                            text_settings: {
                              ...activeQuestion.text_settings,
                              ignore_case: e.target.checked,
                            },
                          })
                        }
                        className="rounded bg-surface-dark border-surface-border text-accent-blue"
                      />
                      <span>Ignore Case (e.g. &quot;cat&quot; = &quot;CAT&quot;)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeQuestion.text_settings.ignore_punct_space}
                        onChange={(e) =>
                          updateActive({
                            text_settings: {
                              ...activeQuestion.text_settings,
                              ignore_punct_space: e.target.checked,
                            },
                          })
                        }
                        className="rounded bg-surface-dark border-surface-border text-accent-blue"
                      />
                      <span>Ignore Punctuation &amp; Spaces (e.g. &quot;C A T&quot; = &quot;CAT&quot;)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* LIVE PARTICIPANT PREVIEW */}
            <div className="neo-card p-6 space-y-4 border-accent-blue/30">
              <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                <span className="text-[10px] font-mono-code text-accent-hover uppercase tracking-widest font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
                  Live Participant View Preview
                </span>
                <span className="text-[10px] font-mono-code text-typography-muted">
                  How competitors will see this question
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between font-mono-code text-xs">
                  <span className="text-accent-blue font-bold uppercase">
                    QUESTION {selectedIndex + 1} ({activeQuestion.question_type.toUpperCase()})
                  </span>
                  <span className="text-typography-muted font-bold">{activeQuestion.points} pts</span>
                </div>

                <p className="text-sm font-semibold text-white leading-relaxed">
                  {activeQuestion.question_text || 'Untitled Question'}
                </p>

                {activeQuestion.monospace_code && (
                  <div className="neo-inset p-3 font-mono-code text-xs text-accent-hover whitespace-pre-wrap">
                    {activeQuestion.monospace_code}
                  </div>
                )}

                {activeQuestion.question_type === 'mcq' && (
                  <div className="space-y-2 pt-1">
                    {activeQuestion.options.map((opt, oIdx) => {
                      const optLetter = String.fromCharCode(65 + oIdx);
                      return (
                        <div
                          key={oIdx}
                          className="p-3 rounded-lg border border-surface-border bg-surface-dark text-xs font-mono-code flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-4 h-4 rounded-full border border-surface-border flex items-center justify-center text-[9px] text-typography-muted">
                              {optLetter}
                            </span>
                            <span>{optLetter}) {opt}</span>
                          </div>
                          {activeQuestion.correct_option_index === oIdx && (
                            <span className="text-[10px] text-green-400 font-bold">
                              [Answer Key: Option {optLetter}]
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeQuestion.question_type === 'text' && (
                  <div className="pt-1 space-y-2">
                    <input
                      type="text"
                      disabled
                      placeholder="Type your answer here..."
                      className="w-full neo-input text-xs uppercase opacity-75 cursor-not-allowed"
                    />
                    <div className="text-[10px] font-mono-code text-green-400">
                      Accepted answers:{' '}
                      <span className="text-white font-bold">
                        {activeQuestion.accepted_answers.length > 0
                          ? activeQuestion.accepted_answers.join(' | ')
                          : '(None configured)'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
