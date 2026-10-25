import type { World } from './types';

/** Mulberry32 step on the world's seed, so every match replays identically from its seed. */
export function rand(world: World): number {
  world.seed = (world.seed + 0x6d2b79f5) | 0;
  let t = world.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
