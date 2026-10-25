import { useEffect, useRef } from 'react';
import { unitSprite } from '../render/sprites/units';
import type { Side, UnitDef } from '../sim/types';

const SIZE = 52;

/** A unit portrait: its idle pixel sprite, scaled up by a whole number so the pixels stay square. */
export function UnitIcon({ def, side = 0 }: { def: UnitDef; side?: Side }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(SIZE * dpr);
    c.width = px;
    c.height = px;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, px, px);
    const s = unitSprite(def, side, 'i');
    // Whole-number upscale keeps pixels square; only oversized sprites (the Titan) shrink to fit.
    const fit = Math.min((px - 4) / s.canvas.width, (px - 4) / s.canvas.height);
    const k = fit >= 1 ? Math.floor(fit) : fit;
    const w = s.canvas.width * k;
    const h = s.canvas.height * k;
    ctx.drawImage(s.canvas, Math.round((px - w) / 2), px - h - 2, w, h);
  }, [def, side]);

  return <canvas ref={ref} className="unit-icon" style={{ width: SIZE, height: SIZE }} aria-hidden />;
}
