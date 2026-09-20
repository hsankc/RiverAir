import Image from "next/image";

type BrandLogoProps = {
  /** Pixel width/height (square). */
  size?: number;
  className?: string;
  /** Load eagerly — set on the first mark above the fold. */
  priority?: boolean;
};

/**
 * The RiverAir mark: the aircraft and its constellation, without the wordmark.
 * Transparent, so it sits on any panel colour.
 *
 * Every call site goes through here — swap the file and the whole app follows.
 */
export function BrandLogo({ size = 32, className = "", priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/riverair-mark.png"
      alt="RiverAir"
      width={size}
      height={size}
      priority={priority}
      // Served straight from /public. The mark is already the right size, so
      // the optimizer adds nothing but a request that can fail — and a brand
      // mark that sometimes does not draw is worse than an unoptimized one.
      unoptimized
      className={`object-contain ${className}`}
    />
  );
}
