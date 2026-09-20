"use client";

import { useEffect, useRef } from "react";

/**
 * The brand animation, played once on load and then held on its final frame —
 * so it reads as a title card that settles into a logo rather than a loop
 * competing with the page.
 *
 * Reduced motion skips straight to the end frame. The video is decorative, so
 * it is hidden from assistive technology; the wordmark is in the header.
 */
export function LogoReveal({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;

    const settle = () => {
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      // Jump to the logo and stay there.
      v.pause();
      v.currentTime = Math.max(0, v.duration - 0.05);
    };

    if (v.readyState >= 1) settle();
    else v.addEventListener("loadedmetadata", settle, { once: true });
  }, []);

  return (
    <div className={`panel overflow-hidden ${className}`}>
      <video
        ref={ref}
        src="/riverair-logo.mp4"
        autoPlay
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
        className="block w-full"
      />
    </div>
  );
}
