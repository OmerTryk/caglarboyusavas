import { Renderer, type ViewState } from '../render/renderer';
import { aiThink, type AIState } from '../sim/ai';
import type { World } from '../sim/types';
import { step } from '../sim/world';

export const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 30;

export interface LoopOptions {
  canvas: HTMLCanvasElement;
  getWorld: () => World;
  ais: () => AIState[];
  getSpeed: () => number;
  isPaused: () => boolean;
  view: ViewState;
}

export interface LoopHandle {
  renderer: Renderer;
  stop: () => void;
}

/** Fixed-step simulation with a free-running renderer on top. */
export function startLoop(opts: LoopOptions): LoopHandle {
  const renderer = new Renderer(opts.canvas);
  renderer.resize();
  const ro = new ResizeObserver(() => renderer.resize());
  ro.observe(opts.canvas);

  let last = performance.now();
  let acc = 0;
  let raf = 0;

  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const world = opts.getWorld();
    const paused = opts.isPaused();
    const speed = opts.getSpeed();
    if (!paused) {
      acc += dt * speed;
      let steps = 0;
      while (acc >= STEP && steps < MAX_STEPS_PER_FRAME) {
        for (const ai of opts.ais()) aiThink(world, ai, STEP);
        step(world, STEP);
        acc -= STEP;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) acc = 0;
    }
    renderer.frame(world, paused ? 0 : dt * Math.min(speed, 2), opts.view);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    renderer,
    stop: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
}
