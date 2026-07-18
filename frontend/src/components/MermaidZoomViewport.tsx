/**
 * Pan/zoom aislado para SVG Mermaid (pinch, Ctrl+rueda, arrastre). No afecta al resto de la app.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MIN_SCALE = 0.35;
const MAX_SCALE = 4;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function touchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

export function MermaidZoomViewport(props: {
  svg: string;
  className?: string;
  showZoomHint?: boolean;
  showReset?: boolean;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const [, bump] = useState(0);
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number; pointerId?: number } | null>(
    null,
  );

  const applyTransform = useCallback(() => {
    const el = surfaceRef.current?.querySelector('[data-mermaid-transform]') as HTMLElement | null;
    if (!el) return;
    const { scale, x, y } = transformRef.current;
    el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }, []);

  const setTransform = useCallback(
    (next: { scale?: number; x?: number; y?: number }) => {
      transformRef.current = {
        scale: next.scale ?? transformRef.current.scale,
        x: next.x ?? transformRef.current.x,
        y: next.y ?? transformRef.current.y,
      };
      applyTransform();
      bump((n) => n + 1);
    },
    [applyTransform],
  );

  const resetTransform = useCallback(() => {
    transformRef.current = { scale: 1, x: 0, y: 0 };
    applyTransform();
    bump((n) => n + 1);
  }, [applyTransform]);

  useEffect(() => {
    applyTransform();
  }, [props.svg, applyTransform]);

  useEffect(() => {
    const root = surfaceRef.current;
    if (!root) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      const factor = Math.exp(-e.deltaY * 0.002);
      setTransform({ scale: clamp(transformRef.current.scale * factor, MIN_SCALE, MAX_SCALE) });
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchStart.current = {
          distance: touchDistance(e.touches),
          scale: transformRef.current.scale,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStart.current) {
        e.preventDefault();
        const dist = touchDistance(e.touches);
        if (pinchStart.current.distance <= 0) return;
        const ratio = dist / pinchStart.current.distance;
        setTransform({
          scale: clamp(pinchStart.current.scale * ratio, MIN_SCALE, MAX_SCALE),
        });
      }
    };

    const onTouchEnd = () => {
      pinchStart.current = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || e.isPrimary === false) return;
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        tx: transformRef.current.x,
        ty: transformRef.current.y,
        pointerId: e.pointerId,
      };
      root.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!panStart.current || panStart.current.pointerId !== e.pointerId) return;
      if (pinchStart.current) return;
      setTransform({
        x: panStart.current.tx + (e.clientX - panStart.current.x),
        y: panStart.current.ty + (e.clientY - panStart.current.y),
      });
    };

    const onPointerUp = (e: PointerEvent) => {
      if (panStart.current?.pointerId === e.pointerId) {
        panStart.current = null;
        try {
          root.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    };

    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('touchstart', onTouchStart, { passive: false });
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    root.addEventListener('touchend', onTouchEnd);
    root.addEventListener('touchcancel', onTouchEnd);
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', onPointerUp);

    return () => {
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchmove', onTouchMove);
      root.removeEventListener('touchend', onTouchEnd);
      root.removeEventListener('touchcancel', onTouchEnd);
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerup', onPointerUp);
      root.removeEventListener('pointercancel', onPointerUp);
    };
  }, [props.svg, setTransform]);

  return (
    <div
      ref={surfaceRef}
      data-mermaid-zoom
      className={cn(
        'relative min-h-[8rem] touch-none select-none overflow-hidden',
        props.className,
      )}
      style={{ touchAction: 'none' }}
    >
      {props.showReset ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute bottom-2 right-2 z-10 size-8 rounded-lg bg-[var(--background)]/90 shadow-sm backdrop-blur-sm"
          onClick={resetTransform}
          title="Restablecer zoom"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          <span className="sr-only">Restablecer zoom</span>
        </Button>
      ) : null}
      {props.showZoomHint ? (
        <p className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-md bg-[var(--background)]/85 px-2 py-1 text-[10px] text-[var(--foreground-muted)] backdrop-blur-sm">
          Pinch · Ctrl+rueda · arrastrar
        </p>
      ) : null}
      <div className="size-full cursor-grab overflow-hidden active:cursor-grabbing">
        <div
          data-mermaid-transform
          className="origin-top-left p-1 [&_svg]:block [&_svg]:max-w-none"
          dangerouslySetInnerHTML={{ __html: props.svg }}
        />
      </div>
    </div>
  );
}
