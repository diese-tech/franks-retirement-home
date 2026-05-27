'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import ThemeToggle from '@/app/components/ThemeToggle';

const PUBLIC_LINKS = [
  { href: '/',          label: 'Home' },
  { href: '/schedule',  label: 'Schedule' },
  { href: '/teams',     label: 'Teams' },
  { href: '/standings', label: 'Standings' },
  { href: '/bulletin-board', label: 'Bulletin' },
  { href: '/players',   label: 'Players' },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState('');
  const [authState, setAuthState] = useState(null); // null=loading, object=loaded

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch('/api/auth/discord/me')
      .then((res) => {
        if (res.status === 401) return { anonymous: true };
        if (!res.ok) return { anonymous: true };
        return res.json();
      })
      .then(setAuthState)
      .catch(() => setAuthState({ anonymous: true }));
  }, []);

  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const handleLogout = async () => {
    await fetch('/api/auth/discord/logout', { method: 'POST' });
    window.location.reload();
  };

  // Build nav links based on auth state
  const navLinks = [...PUBLIC_LINKS];
  if (authState && authState.teamId) {
    navLinks.push({ href: '/captain', label: 'Captain' });
  }
  if (authState && authState.isAdmin) {
    navLinks.push({ href: '/admin', label: 'Admin' });
  }

  return (
    <nav className="frh-menubar">
      <Link href="/" className="frh-menubar__brand">
        <span className="frh-menubar__dot" />
        FRH
      </Link>

      <div className="frh-menubar__items">
        {navLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={'frh-menubar__item' + (isActive(href) ? ' is-active' : '')}
          >
            <span className="u">{label[0]}</span>{label.slice(1)}
          </Link>
        ))}
      </div>

      <div className="frh-menubar__right">
        <span className="frh-menubar__live-dot" />
        {time ? `ON AIR · ${time}` : 'FRH LIVE'}
        <ThemeToggle />
        {authState && !authState.anonymous && (
          <>
            <span className="frh-menubar__user" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', marginLeft: 8 }}>
              {authState.username}
            </span>
            <button
              onClick={handleLogout}
              className="frh-menubar__item"
              style={{ fontSize: 10, marginLeft: 4, cursor: 'pointer', border: 'none', background: 'none', color: 'inherit', fontFamily: 'inherit' }}
            >
              Logout
            </button>
          </>
        )}
        {authState && authState.anonymous && (
          <Link
            href={`/api/auth/discord?returnUrl=${encodeURIComponent(pathname)}`}
            className="frh-menubar__item"
            style={{ fontSize: 10, marginLeft: 8 }}
          >
            Login
          </Link>
        )}
        <button
          className="frh-menubar__ham"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {open && (
        <div className="frh-menubar__drawer">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={'frh-menubar__drawer-link' + (isActive(href) ? ' is-active' : '')}
            >
              {label}
            </Link>
          ))}
          {authState && authState.anonymous && (
            <Link
              href={`/api/auth/discord?returnUrl=${encodeURIComponent(pathname)}`}
              onClick={() => setOpen(false)}
              className="frh-menubar__drawer-link"
            >
              Login
            </Link>
          )}
          {authState && !authState.anonymous && (
            <button
              onClick={() => { setOpen(false); handleLogout(); }}
              className="frh-menubar__drawer-link"
              style={{ border: 'none', background: 'none', color: 'inherit', fontFamily: 'inherit', textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              Logout ({authState.username})
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
