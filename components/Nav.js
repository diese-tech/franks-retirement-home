import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-brand-900/85 backdrop-blur-md border-b border-brand-600/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-gold-400 to-ember-500 flex items-center justify-center font-display font-bold text-brand-900 text-sm group-hover:shadow-lg group-hover:shadow-gold-500/30 transition-shadow">
            F
          </div>
          <span className="font-display font-bold text-base uppercase tracking-wider text-gray-200 group-hover:text-gold-400 transition-colors">
            Frank's Retirement Home
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/" className="px-3 py-1.5 text-sm font-display font-medium text-gray-400 hover:text-gray-100 hover:bg-brand-700/50 rounded transition-colors">
            Home
          </Link>
          <Link href="/admin" className="px-3 py-1.5 text-sm font-display font-medium text-gray-400 hover:text-gray-100 hover:bg-brand-700/50 rounded transition-colors">
            Admin
          </Link>
        </div>
      </div>
    </nav>
  );
}
