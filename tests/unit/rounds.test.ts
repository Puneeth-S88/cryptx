import { describe, it, expect, beforeEach } from 'vitest';
import { getAllRounds, getRoundById, getActiveRound, updateRoundState, resetRoundsStore } from '@/lib/rounds';

describe('Round Lifecycle and Activation Store', () => {
  beforeEach(() => {
    resetRoundsStore();
  });
  it('loads all 8 championship rounds', () => {
    const rounds = getAllRounds();
    expect(rounds.length).toBe(8);
    expect(rounds[0].title).toBe('The Secret Code');
    expect(rounds[1].title).toBe('Cipher Breakers');
    expect(rounds[2].title).toBe('Code Grid');
  });

  it('can activate and open Round 2 after Round 1', async () => {
    // Initial: Round 1 is open
    const initialR2 = getRoundById('r2');
    expect(initialR2?.state).toBe('locked');

    // Activate Round 2
    const updatedR2 = await updateRoundState('r2', 'open', { duration_seconds: 600 });
    expect(updatedR2?.state).toBe('open');
    expect(updatedR2?.deadline).toBeTruthy();

    // Round 1 should be automatically marked closed
    const r1 = getRoundById('r1');
    expect(r1?.state).toBe('closed');

    // Active round should now be Round 2
    const active = getActiveRound();
    expect(active.id).toBe('r2');
  });

  it('can pause and resume a round', async () => {
    await updateRoundState('r2', 'open', { duration_seconds: 600 });
    const paused = await updateRoundState('r2', 'paused');
    expect(paused?.state).toBe('paused');

    const resumed = await updateRoundState('r2', 'open');
    expect(resumed?.state).toBe('open');
  });

  it('can extend deadline timer on active round', async () => {
    await updateRoundState('r2', 'open', { duration_seconds: 600 });
    const r2Before = getRoundById('r2');
    const oldDeadlineMs = new Date(r2Before!.deadline!).getTime();

    await updateRoundState('r2', 'extend_timer', { addMinutes: 5 });

    const r2After = getRoundById('r2');
    const newDeadlineMs = new Date(r2After!.deadline!).getTime();

    expect(newDeadlineMs).toBeGreaterThan(oldDeadlineMs);
    expect(newDeadlineMs - oldDeadlineMs).toBe(5 * 60 * 1000);
  });

  it('can close and score a round', async () => {
    await updateRoundState('r2', 'open', { duration_seconds: 600 });
    const closed = await updateRoundState('r2', 'closed');
    expect(closed?.state).toBe('closed');
    expect(closed?.closed_at).toBeTruthy();

    const scored = await updateRoundState('r2', 'scored');
    expect(scored?.state).toBe('scored');
  });

  it('can reopen a closed or scored round with a refreshed deadline and clear closed_at', async () => {
    await updateRoundState('r2', 'open', { duration_seconds: 600 });
    await updateRoundState('r2', 'closed');
    const closedRound = getRoundById('r2');
    expect(closedRound?.state).toBe('closed');
    expect(closedRound?.closed_at).toBeTruthy();

    const reopened = await updateRoundState('r2', 'open', { duration_seconds: 600 });
    expect(reopened?.state).toBe('open');
    expect(reopened?.closed_at).toBeNull();
    expect(reopened?.deadline).toBeTruthy();
    const deadlineMs = new Date(reopened!.deadline!).getTime();
    expect(deadlineMs).toBeGreaterThan(Date.now());

    // From scored to open
    await updateRoundState('r2', 'scored');
    const reopenedFromScored = await updateRoundState('r2', 'open', { duration_seconds: 300 });
    expect(reopenedFromScored?.state).toBe('open');
    expect(reopenedFromScored?.closed_at).toBeNull();
  });

  it('can reset a closed or scored round back to locked', async () => {
    await updateRoundState('r2', 'open', { duration_seconds: 600 });
    await updateRoundState('r2', 'closed');
    const lockedFromClosed = await updateRoundState('r2', 'locked');
    expect(lockedFromClosed?.state).toBe('locked');
    expect(lockedFromClosed?.deadline).toBeNull();
    expect(lockedFromClosed?.closed_at).toBeNull();

    await updateRoundState('r2', 'open', { duration_seconds: 600 });
    await updateRoundState('r2', 'scored');
    const lockedFromScored = await updateRoundState('r2', 'locked');
    expect(lockedFromScored?.state).toBe('locked');
    expect(lockedFromScored?.deadline).toBeNull();
    expect(lockedFromScored?.closed_at).toBeNull();
  });
});
