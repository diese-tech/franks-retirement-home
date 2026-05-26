'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export default function IntroScreen() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [frozenFrame, setFrozenFrame] = useState(null);
  const videoRef = useRef(null);
  const dismissingRef = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    sessionStorage.setItem('frh-intro-seen', '1');

    // Snapshot current video frame so we can split-animate it
    try {
      const video = videoRef.current;
      if (video && video.videoWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        setFrozenFrame(canvas.toDataURL('image/jpeg', 0.9));
      }
    } catch (_) {
      // canvas taint or video not ready — fall through to plain fade
    }

    // Double rAF: let frozen-frame panels settle at translate-y-0 first,
    // then trigger the transition on the next paint.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFading(true);
        setTimeout(() => setVisible(false), 850);
      });
    });
  }, []);

  useEffect(() => {
    if (!sessionStorage.getItem('frh-intro-seen')) {
      setVisible(true);
      const timer = setTimeout(() => dismiss(), 2500);
      return () => clearTimeout(timer);
    }
  }, [dismiss]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] cursor-pointer overflow-hidden ${!frozenFrame ? 'bg-black' : ''} ${!frozenFrame && fading ? 'opacity-0 transition-opacity duration-700' : ''}`}
      onClick={dismiss}
    >
      {/* Live video — hidden once frame is captured */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onEnded={dismiss}
        className={`w-full h-full object-contain transition-opacity duration-75 ${frozenFrame ? 'opacity-0' : 'opacity-100'}`}
      >
        <source src="/video/record-loop.mp4" type="video/mp4" />
      </video>

      {/* Split panels — rendered after frame capture */}
      {frozenFrame && (
        <>
          {/* Top half slides upward */}
          <div
            className={`absolute inset-0 bg-black transition-transform duration-[800ms] ease-in-out ${fading ? '-translate-y-full' : 'translate-y-0'}`}
            style={{ clipPath: 'inset(0 0 50% 0)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frozenFrame} alt="" className="w-full h-full object-contain" />
          </div>
          {/* Bottom half slides downward */}
          <div
            className={`absolute inset-0 bg-black transition-transform duration-[800ms] ease-in-out ${fading ? 'translate-y-full' : 'translate-y-0'}`}
            style={{ clipPath: 'inset(50% 0 0 0)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frozenFrame} alt="" className="w-full h-full object-contain" />
          </div>
        </>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        className="absolute bottom-8 right-8 z-10 font-mono text-[11px] uppercase tracking-widest text-white/50 hover:text-white border border-white/20 hover:border-white/60 px-4 py-2 transition-colors"
      >
        Skip ›
      </button>

      <p className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 font-mono text-[10px] text-white/25 uppercase tracking-widest">
        click anywhere to enter
      </p>
    </div>
  );
}
