'use client';

import Image from 'next/image';
import { useState } from 'react';
import { getGodIconUrl } from '@/lib/godArt';

export default function GodImage({ godId, name, size = 48, fill = false, sizes, className = '', god = null }) {
  const [error, setError] = useState(false);
  const godMeta = god ?? { id: godId, name };

  if (error) {
    if (fill) {
      return (
        <div className={`rounded bg-brand-700 flex items-center justify-center text-gray-500 text-[10px] font-display font-bold uppercase ${className}`}>
          {name?.[0] ?? '?'}
        </div>
      );
    }
    return (
      <div
        className={`rounded bg-brand-700 flex items-center justify-center text-gray-500 text-[10px] font-display font-bold uppercase shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        {name?.[0] ?? '?'}
      </div>
    );
  }

  if (fill) {
    return (
      <Image
        src={getGodIconUrl(godMeta)}
        alt={name ?? godId}
        fill
        sizes={sizes ?? '100px'}
        className={`rounded object-cover ${className}`}
        onError={() => setError(true)}
      />
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
