'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function GodImage({ godId, name, size = 48, className = '' }) {
  const [error, setError] = useState(false);

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
      src={`https://www.smitefire.com/images/v2/god/icon/${godId}.png`}
      alt={name ?? godId}
      width={size}
      height={size}
      className={`rounded object-cover shrink-0 ${className}`}
      onError={() => setError(true)}
    />
  );
}
