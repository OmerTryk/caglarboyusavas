import type { Side } from '../sim/types';

export interface TeamColors {
  main: string;
  dark: string;
  light: string;
  /** Back limbs, one step darker than `dark` so both legs read separately. */
  back: string;
}

export const TEAM: [TeamColors, TeamColors] = [
  { main: '#2f6fdb', dark: '#1c428f', light: '#8ab8ff', back: '#142f66' },
  { main: '#d6403a', dark: '#8a231d', light: '#ff9d92', back: '#661914' },
];

export const SKIN = '#f0c08a';
export const GOLD = '#ffcf3f';

export function team(side: Side): TeamColors {
  return TEAM[side];
}

/** Deterministic hash noise, used so procedural scenery is stable per age. */
export function noise(i: number, seed: number): number {
  const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
