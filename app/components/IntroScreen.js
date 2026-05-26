'use client';

import { useEffect, useRef, useState } from 'react';

export default function IntroScreen() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!sessionStorage.getItem('frh-intro-seen')) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    if (fading) return;
    setFading(true);
    sessionStorage.setItem('frh-intro-seen', '1');
    setTimeout(() => setVisible(false), 600);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center cursor-pointer transition-opacity duration-[600ms] ${fading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      onClick={dismiss}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onEnded={dismiss}
        className="w-full h-full object-contain"
      >
        <source src="/video/record-loop.mp4" type="video/mp4" />
      </video>

      <button
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        className="absolute bottom-8 right-8 font-mono text-[11px] uppercase tracking-widest text-white/50 hover:text-white border border-white/20 hover:border-white/60 px-4 py-2 transition-colors"
      >
        Skip ›
      </button>

      <p className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-[10px] text-white/25 uppercase tracking-widest">
        click anywhere to enter
      </p>
    </div>
  );
}
