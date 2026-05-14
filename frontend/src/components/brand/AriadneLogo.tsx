/**
 * Ariadne wordmark / mark — theme-aware URLs from `@/constants/brand`.
 */
import { cn } from '@/lib/utils';
import {
  BRAND_LOGO_DARK_SRC,
  BRAND_LOGO_LIGHT_SRC,
  BRAND_MARK_DARK_SRC,
  BRAND_MARK_LIGHT_SRC,
} from '@/constants/brand';

export type AriadneLogoProps = {
  className?: string
  /** Extra classes for the `<img>` elements (e.g. mark size overrides). */
  imageClassName?: string
  /**
   * `full` — login / hero (taller wordmark).
   * `compact` — expanded sidebar (horizontal wordmark).
   * `mark` — square mark only (collapsed sidebar).
   * `icon` — alias for `mark` (legacy).
   */
  variant?: "full" | "compact" | "mark" | "icon"
}

export function AriadneLogo({ className, imageClassName, variant = "full" }: AriadneLogoProps) {
  const isMark = variant === 'mark' || variant === 'icon';
  const isCompact = variant === 'compact';
  const lightSrc = isMark ? BRAND_MARK_LIGHT_SRC : BRAND_LOGO_LIGHT_SRC;
  const darkSrc = isMark ? BRAND_MARK_DARK_SRC : BRAND_LOGO_DARK_SRC;

  const imgClass = cn(
    'block h-auto w-auto object-contain object-left',
    isMark && 'size-[22px] max-h-[22px] max-w-[22px]',
    isCompact &&
      'max-h-[18px] max-w-[min(100%,7.4rem)] sm:max-h-[19px] sm:max-w-[min(100%,8rem)]',
    variant === 'full' &&
      'max-h-12 sm:max-h-14 md:max-h-16',
  );

  return (
    <span
      className={cn(
        'relative inline-flex max-w-full shrink-0 items-center justify-start',
        isMark && 'justify-center',
        className,
      )}
    >
      <img
        src={lightSrc}
        alt="Ariadne"
        className={cn(imgClass, imageClassName, "dark:hidden")}
        draggable={false}
      />
      <img
        src={darkSrc}
        alt=""
        className={cn(imgClass, imageClassName, "hidden dark:block")}
        draggable={false}
        aria-hidden
      />
    </span>
  );
}
