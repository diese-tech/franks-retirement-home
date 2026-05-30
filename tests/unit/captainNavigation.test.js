import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}));

vi.mock('next/link', async () => {
  const React = await import('react');
  return { default: ({ children, href, ...props }) => React.createElement('a', { href, ...props }, children) };
});

vi.mock('@/app/components/ThemeToggle', async () => {
  const React = await import('react');
  return { default: () => React.createElement('div', { 'data-testid': 'theme-toggle' }) };
});

import Nav from '@/components/Nav';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockFetchResponse(data, status = 200) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
    })
  );
}

function renderNav() {
  return render(createElement(Nav));
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Reset fetch
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) })
  );
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Nav component', () => {
  it('shows Login link when fetch returns 401 (anonymous user)', async () => {
    mockFetchResponse({}, 401);
    renderNav();
    await waitFor(() => {
      expect(screen.getByText('Login')).toBeInTheDocument();
    });
    expect(screen.queryByText('Captain')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('shows Captain link and username when captain is logged in', async () => {
    mockFetchResponse({ username: 'TestCaptain', teamId: 'team-1', isAdmin: false });
    renderNav();
    await waitFor(() => {
      expect(screen.getByText('TestCaptain')).toBeInTheDocument();
    });
    // Captain link should appear (rendered as <a> links with first letter <span>)
    const captainLinks = screen.getAllByRole('link').filter(
      (el) => el.getAttribute('href') === '/captain'
    );
    expect(captainLinks.length).toBeGreaterThan(0);
    // Admin link should NOT appear
    const adminLinks = screen.getAllByRole('link').filter(
      (el) => el.getAttribute('href') === '/admin'
    );
    expect(adminLinks).toHaveLength(0);
  });

  it('shows Admin link when admin is logged in without team', async () => {
    mockFetchResponse({ username: 'AdminUser', teamId: null, isAdmin: true });
    renderNav();
    await waitFor(() => {
      expect(screen.getByText('AdminUser')).toBeInTheDocument();
    });
    const adminLinks = screen.getAllByRole('link').filter(
      (el) => el.getAttribute('href') === '/admin'
    );
    expect(adminLinks.length).toBeGreaterThan(0);
    // Captain link should NOT appear (no teamId)
    const captainLinks = screen.getAllByRole('link').filter(
      (el) => el.getAttribute('href') === '/captain'
    );
    expect(captainLinks).toHaveLength(0);
  });

  it('shows both Captain and Admin links when user is captain and admin', async () => {
    mockFetchResponse({ username: 'CaptainAdmin', teamId: 'team-1', isAdmin: true });
    renderNav();
    await waitFor(() => {
      expect(screen.getByText('CaptainAdmin')).toBeInTheDocument();
    });
    const captainLinks = screen.getAllByRole('link').filter(
      (el) => el.getAttribute('href') === '/captain'
    );
    expect(captainLinks.length).toBeGreaterThan(0);
    const adminLinks = screen.getAllByRole('link').filter(
      (el) => el.getAttribute('href') === '/admin'
    );
    expect(adminLinks.length).toBeGreaterThan(0);
  });

  it('does not show Captain or Admin links for anonymous user', async () => {
    mockFetchResponse({}, 401);
    renderNav();
    await waitFor(() => {
      expect(screen.getByText('Login')).toBeInTheDocument();
    });
    const captainLinks = screen.getAllByRole('link').filter(
      (el) => el.getAttribute('href') === '/captain'
    );
    expect(captainLinks).toHaveLength(0);
    const adminLinks = screen.getAllByRole('link').filter(
      (el) => el.getAttribute('href') === '/admin'
    );
    expect(adminLinks).toHaveLength(0);
  });

  it('renders the hamburger button outside the right section so it is accessible on mobile', async () => {
    mockFetchResponse({}, 401);
    renderNav();
    // Ham button must exist in the DOM
    const ham = screen.getByRole('button', { name: /toggle menu/i });
    expect(ham).toBeInTheDocument();
    // The ham button must NOT be a descendant of .frh-menubar__right
    // (if it were, display:none on the parent would hide it on mobile)
    const rightSection = ham.closest('.frh-menubar__right');
    expect(rightSection).toBeNull();
  });

  it('hamburger opens and closes the drawer', async () => {
    mockFetchResponse({ username: 'TestUser', teamId: null, isAdmin: false });
    renderNav();
    const ham = screen.getByRole('button', { name: /toggle menu/i });
    // Drawer closed initially
    expect(screen.queryByRole('navigation', { hidden: true })?.querySelector('#nav-drawer')).toBeNull();
    // Open drawer
    ham.click();
    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument();
    });
    expect(ham).toHaveAttribute('aria-expanded', 'true');
    // Close drawer
    ham.click();
    await waitFor(() => {
      expect(ham).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
