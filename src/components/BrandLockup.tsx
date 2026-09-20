import Image from "next/image";
import { BrandLogo } from "./BrandLogo";

/** Wordmark artwork is 1887×312. */
const WORDMARK_ASPECT = 1887 / 312;

type BrandLockupProps = {
  /** Height of the square mark; the wordmark is sized against it. */
  size?: number;
  className?: string;
  priority?: boolean;
};

/**
 * Mark and wordmark side by side, both from the brand artwork — no typeset
 * stand-in for the name.
 *
 * The wordmark is set to two thirds of the mark's height, which is where the
 * cap height of the type lines up with the aircraft rather than with the glow
 * around it.
 */
export function BrandLockup({ size = 26, className = "", priority = false }: BrandLockupProps) {
  const wordHeight = Math.round(size * 0.66);
  const wordWidth = Math.round(wordHeight * WORDMARK_ASPECT);

  return (
    <span className={`flex shrink-0 items-center gap-2 ${className}`}>
      <BrandLogo size={size} priority={priority} />
      <Image
        src="/riverair-wordmark.png"
        alt="RiverAir"
        width={wordWidth}
        height={wordHeight}
        priority={priority}
        unoptimized
        className="object-contain"
      />
    </span>
  );
}
