'use client';

import Image from 'next/image';
import { useState } from 'react';
import { getGodWideArtUrl } from '@/lib/godArt';

export default function GodWideArt({
  god,
  alt,
  className = '',
  priority = false,
  opacity = 1,
  children,
}) {
  const [error, setError] = useState(false);

  if (!god || error) {
    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-r from-brand-700 via-brand-800 to-brand-900 ${className}`}
        style={{ opacity }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.14),transparent_40%)]" />
        {children}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ opacity }}>
      <Image
        src={getGodWideArtUrl(god)}
        alt={alt ?? god.name ?? god.id}
        fill
        priority={priority}
        className="object-cover"
        onError={() => setError(true)}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-black/55" />
      {children}
    </div>
  );
}
