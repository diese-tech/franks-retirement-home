import { describe, it, expect } from 'vitest';
import { resolveRole, SENDER_INFO } from '@/lib/draftAuth';

// Fixture draft with known keys
const DRAFT = {
  adminKey:    'admin-secret',
  captainAKey: 'captain-a-secret',
  captainBKey: 'captain-b-secret',
};

describe('resolveRole', () => {
  it('resolves admin key to admin', () => {
    expect(resolveRole('admin-secret', DRAFT)).toBe('admin');
  });

  it('resolves captainAKey to captainA', () => {
    expect(resolveRole('captain-a-secret', DRAFT)).toBe('captainA');
  });

  it('resolves captainBKey to captainB', () => {
    expect(resolveRole('captain-b-secret', DRAFT)).toBe('captainB');
  });

  it('resolves missing key to spectator', () => {
    expect(resolveRole(undefined, DRAFT)).toBe('spectator');
  });

  it('resolves null key to spectator', () => {
    expect(resolveRole(null, DRAFT)).toBe('spectator');
  });

  it('resolves empty string key to spectator', () => {
    expect(resolveRole('', DRAFT)).toBe('spectator');
  });

  it('resolves unknown key to spectator', () => {
    expect(resolveRole('completely-wrong', DRAFT)).toBe('spectator');
  });

  it('does not allow captainA key to resolve as admin', () => {
    expect(resolveRole('captain-a-secret', DRAFT)).not.toBe('admin');
  });

  it('does not allow captainB key to resolve as admin', () => {
    expect(resolveRole('captain-b-secret', DRAFT)).not.toBe('admin');
  });

  it('does not allow partial key match', () => {
    // Substring of admin key should not resolve as admin
    expect(resolveRole('admin', DRAFT)).toBe('spectator');
    expect(resolveRole('admin-secre', DRAFT)).toBe('spectator');
  });

  it('is case-sensitive', () => {
    expect(resolveRole('ADMIN-SECRET', DRAFT)).toBe('spectator');
    expect(resolveRole('Captain-A-Secret', DRAFT)).toBe('spectator');
  });

  it('returns spectator when draft has null adminKey', () => {
    const draft = { adminKey: null, captainAKey: 'a', captainBKey: 'b' };
    // Even if someone passes null as key, should not match
    expect(resolveRole('anything', draft)).toBe('spectator');
  });

  it('returns spectator when all keys are null', () => {
    const draft = { adminKey: null, captainAKey: null, captainBKey: null };
    expect(resolveRole('anything', draft)).toBe('spectator');
  });

  it('captainA and captainB keys being identical does not grant admin', () => {
    const draft = { adminKey: 'admin-key', captainAKey: 'same', captainBKey: 'same' };
    expect(resolveRole('same', draft)).toBe('captainA'); // first match wins
    expect(resolveRole('admin-key', draft)).toBe('admin');
  });
});

describe('SENDER_INFO', () => {
  it('has entries for all four roles', () => {
    expect(SENDER_INFO.captainA).toBeDefined();
    expect(SENDER_INFO.captainB).toBeDefined();
    expect(SENDER_INFO.admin).toBeDefined();
    expect(SENDER_INFO.spectator).toBeDefined();
  });

  it('captainA team is A', () => {
    expect(SENDER_INFO.captainA.team).toBe('A');
  });

  it('captainB team is B', () => {
    expect(SENDER_INFO.captainB.team).toBe('B');
  });

  it('admin team is admin', () => {
    expect(SENDER_INFO.admin.team).toBe('admin');
  });
});
