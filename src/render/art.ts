import { WORLD_W } from '../sim/data';

/** Art pixels per world unit: the battlefield is painted small (720x224), then scaled up crisply. */
export const ART = 0.4;

/** World-space height of the visible scene and the ground line inside it. */
export const VIEW_H = 560;
export const GROUND_Y = 462;

export const LOW_W = Math.round(WORLD_W * ART);
export const LOW_H = Math.round(VIEW_H * ART);
export const GROUND_A = Math.round(GROUND_Y * ART);

/** World x → art pixel column. */
export function ax(x: number): number {
  return Math.round(x * ART);
}
