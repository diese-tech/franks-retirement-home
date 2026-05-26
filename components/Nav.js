'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import ThemeToggle from '@/app/components/ThemeToggle';

const NAV_LINKS = [
  { href: '/',          label: 'Home' },
  { href: '/schedule',  label: 'Schedule' },
  { href: '/teams',     label: 'Teams' },
  { href: '/standings', label: 'Standings' },
  { href: '/players',   label: 'Players' },
  { href: '/admin',     label: 'Admin' },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav className="frh-menubar">
      <Link href="/" className="frh-menubar__brand">
        <span className="frh-menubar__dot" />
        FRH
      </Link>

      <div className="frh-menubar__items">
        {NAV_LINKS.map(({ href, label }) => (
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
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={'frh-menubar__drawer-link' + (isActive(href) ? ' is-active' : '')}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
