import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock next/headers before importing serverAuth
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

// Mock discordAuth to control getDiscordSessionFromRaw and hasDiscordAdminRole
vi.mock('@/lib/discordAuth', () => ({
  getDiscordSessionFromRaw: vi.fn(),
  hasDiscordAdminRole: vi.fn(),
}));

const { cookies } = await import('next/headers');
const { getDiscordSessionFromRaw, hasDiscordAdminRole } = await import('@/lib/discordAuth');
const { isDiscordAdminFromCookies } = await import('@/lib/serverAuth');

describe('isDiscordAdminFromCookies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when cookie is present, session is valid, and user has admin role', () => {
    cookies.mockReturnValue({ get: () => ({ value: 'valid.cookie' }) });
    getDiscordSessionFromRaw.mockReturnValue({ discordId: 'u1', username: 'Admin', roles: ['admin-role'] });
    hasDiscordAdminRole.mockReturnValue(true);

    expect(isDiscordAdminFromCookies()).toBe(true);
    expect(getDiscordSessionFromRaw).toHaveBeenCalledWith('valid.cookie');
    expect(hasDiscordAdminRole).toHaveBeenCalledWith(['admin-role']);
  });

  it('returns false when cookie is present but user does not have admin role', () => {
    cookies.mockReturnValue({ get: () => ({ value: 'valid.cookie' }) });
    getDiscordSessionFromRaw.mockReturnValue({ discordId: 'u2', username: 'Player', roles: ['captain-role'] });
    hasDiscordAdminRole.mockReturnValue(false);

    expect(isDiscordAdminFromCookies()).toBe(false);
  });

  it('returns false when no session cookie is present', () => {
    cookies.mockReturnValue({ get: () => undefined });

    expect(isDiscordAdminFromCookies()).toBe(false);
    expect(getDiscordSessionFromRaw).not.toHaveBeenCalled();
  });

  it('returns false when cookie value is null/empty', () => {
    cookies.mockReturnValue({ get: () => ({ value: null }) });
    getDiscordSessionFromRaw.mockReturnValue(null);

    expect(isDiscordAdminFromCookies()).toBe(false);
  });

  it('returns false when session is invalid (getDiscordSessionFromRaw returns null)', () => {
    cookies.mockReturnValue({ get: () => ({ value: 'expired.cookie' }) });
    getDiscordSessionFromRaw.mockReturnValue(null);

    expect(isDiscordAdminFromCookies()).toBe(false);
    expect(hasDiscordAdminRole).not.toHaveBeenCalled();
  });
});
