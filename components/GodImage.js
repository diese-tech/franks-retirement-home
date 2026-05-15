'use client';

import Image from 'next/image';
import { useState } from 'react';
import { getGodIconUrl } from '@/lib/godArt';

export default function GodImage({ godId, name, size = 48, className = '', god = null }) {
  const [error, setError] = useState(false);
  const godMeta = god ?? { id: godId, name };

  if (error) {
    return (
      <div
        className={`rounded bg-brand-700 flex items-center justify-center text-gray-500 text-[10px] font-display font-bold uppercase shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        {name?.[0] ?? '?'}
      </div>
    );
  }

  return (
    <Image
      src={getGodIconUrl(godMeta)}
      alt={name ?? godId}
      width={size}
      height={size}
      className={`rounded object-cover shrink-0 ${className}`}
      onError={() => setError(true)}
    />
  );
}
