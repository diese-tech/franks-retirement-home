'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

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

  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav className="sticky top-0 z-50 bg-brand-900/95 backdrop-blur-md border-b-2 border-brand-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-gold-400 to-ember-500 flex items-center justify-center font-display font-bold text-brand-900 text-sm group-hover:shadow-lg group-hover:shadow-gold-500/30 transition-shadow">
            F
          </div>
          <span className="font-display font-bold text-base uppercase tracking-wider text-gray-200 group-hover:text-gold-400 transition-colors hidden sm:block">
            Frank&apos;s Retirement Home
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={[
                'px-3 py-1.5 text-xs font-ui uppercase tracking-widest transition-colors border-b-2',
                isActive(href)
                  ? 'text-frh-yellow border-b-frh-yellow'
                  : 'text-gray-400 border-b-transparent hover:text-gray-100 hover:border-b-brand-600',
              ].join(' ')}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2 group"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span className={`block w-6 h-0.5 bg-gray-400 transition-all group-hover:bg-frh-yellow ${open ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-6 h-0.5 bg-gray-400 transition-all group-hover:bg-frh-yellow ${open ? 'opacity-0' : ''}`} />
          <span className={`block w-6 h-0.5 bg-gray-400 transition-all group-hover:bg-frh-yellow ${open ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t-2 border-brand-700 bg-brand-900">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={[
                'block px-6 py-3 text-xs font-ui uppercase tracking-widest border-b border-brand-800 transition-colors',
                isActive(href)
                  ? 'text-frh-yellow bg-brand-800'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-brand-800',
              ].join(' ')}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
