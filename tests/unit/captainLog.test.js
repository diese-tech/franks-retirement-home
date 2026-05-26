import { describe, it, expect, vi, beforeEach } from 'vitest';
import { captainLog } from '@/lib/captainLog';

describe('captainLog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('emits structured JSON with event and timestamp', () => {
    captainLog('captain_result_reported');
    expect(console.info).toHaveBeenCalledTimes(1);
    const [prefix, json] = console.info.mock.calls[0];
    expect(prefix).toBe('[FRH:captain]');
    const parsed = JSON.parse(json);
    expect(parsed.event).toBe('captain_result_reported');
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('includes all provided details in output', () => {
    captainLog('captain_result_confirmed', {
      matchId: 'match-1',
      gameId: 'game-1',
      captainSide: 'home',
      source: 'discord',
    });
    const [, json] = console.info.mock.calls[0];
    const parsed = JSON.parse(json);
    expect(parsed.event).toBe('captain_result_confirmed');
    expect(parsed.matchId).toBe('match-1');
    expect(parsed.gameId).toBe('game-1');
    expect(parsed.captainSide).toBe('home');
    expect(parsed.source).toBe('discord');
    expect(parsed.timestamp).toBeDefined();
  });

  it('uses [FRH:captain] prefix', () => {
    captainLog('captain_auth_failed', { matchId: 'match-2', reason: 'no_auth_resolved' });
    const [prefix] = console.info.mock.calls[0];
    expect(prefix).toBe('[FRH:captain]');
  });

  it('handles events with empty details', () => {
    captainLog('captain_role_mismatch');
    const [, json] = console.info.mock.calls[0];
    const parsed = JSON.parse(json);
    expect(parsed.event).toBe('captain_role_mismatch');
    expect(parsed.timestamp).toBeDefined();
    // Should only have event and timestamp
    expect(Object.keys(parsed)).toEqual(['event', 'timestamp']);
  });

  it('logs captain_result_disputed with all fields', () => {
    captainLog('captain_result_disputed', {
      matchId: 'match-3',
      gameId: 'game-5',
      captainSide: 'away',
      source: 'key',
    });
    const [, json] = console.info.mock.calls[0];
    const parsed = JSON.parse(json);
    expect(parsed.event).toBe('captain_result_disputed');
    expect(parsed.matchId).toBe('match-3');
    expect(parsed.gameId).toBe('game-5');
    expect(parsed.captainSide).toBe('away');
    expect(parsed.source).toBe('key');
  });
});
