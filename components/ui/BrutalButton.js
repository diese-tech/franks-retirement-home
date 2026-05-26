import Link from 'next/link';

const VARIANTS = {
  primary:   'bg-frh-yellow text-frh-ink border-2 border-frh-ink shadow-[4px_4px_0px_#b89600]',
  secondary: 'bg-transparent text-frh-text border-2 border-frh-border shadow-[var(--shadow-hard)]',
  danger:    'bg-ember-500 text-white border-2 border-gray-900 shadow-[4px_4px_0px_rgba(0,0,0,0.5)]',
  ghost:     'bg-transparent text-frh-text-muted border border-frh-border',
};

const SIZES = {
  sm: 'px-3 py-1 text-[11px]',
  md: 'px-4 py-2 text-xs',
  lg: 'px-6 py-3 text-sm',
};

export default function BrutalButton({
  variant = 'primary',
  size = 'md',
  disabled,
  href,
  children,
  className = '',
  ...rest
}) {
  const classes = [
    'font-ui uppercase tracking-wide rounded-lg inline-flex items-center justify-center select-none',
    'active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-transform duration-75',
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
    className,
  ].join(' ');

  if (href && !disabled) {
    return <Link href={href} className={classes} {...rest}>{children}</Link>;
  }

  return (
    <button className={classes} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}
