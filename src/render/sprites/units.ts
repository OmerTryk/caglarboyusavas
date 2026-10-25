import type { HeadKind, MountKind, Side, UnitDef, WeaponKind } from '../../sim/types';
import { INK } from '../pixel/color';
import { Painter, type Sprite } from '../pixel/painter';
import { ART } from '../art';
import { GOLD, SKIN, team, type TeamColors } from '../palette';

/** Canonical drawing height of each body, used to scale it to UnitDef.height. */
const HUMAN_H = 46;
const MOUNT_H: Record<MountKind, number> = { mammoth: 78, chariot: 66, knight: 66, cannon: 66, tank: 60, mech: 96 };

const MELEE: WeaponKind[] = ['club', 'sword', 'saber'];
const SKIN_DARK = '#c98a5a';

export interface Pose {
  /** -1..1 leg swing. */
  leg: number;
  moving: boolean;
  /** Upper-body bob in art pixels (walk passing frames). */
  bob: number;
  /** 0..1 progress of the current attack swing, or -1 when not swinging. */
  swing: number;
  /** Seconds since the last shot, for muzzle flashes and recoil. */
  shotT: number;
  spin: number;
}

export type PoseKey = 'i' | 'w0' | 'w1' | 'w2' | 'w3' | 'a0' | 'a1' | 'a2' | 'a3';

const WALK_LEG = [0.9, 0, -0.9, 0];
const WALK_BOB = [0, -1, 0, -1];
const SHOT_T = [0, 0.05, 0.1, 0.2];

function poseOf(key: PoseKey): Pose {
  const k = Number(key[1] ?? 0);
  if (key[0] === 'w') return { leg: WALK_LEG[k], moving: true, bob: WALK_BOB[k], swing: -1, shotT: 9, spin: k * (Math.PI / 4) };
  if (key[0] === 'a') return { leg: 0, moving: false, bob: 0, swing: k / 3, shotT: SHOT_T[k], spin: 0 };
  return { leg: 0, moving: false, bob: 0, swing: -1, shotT: 9, spin: 0 };
}

const cache = new Map<string, Sprite>();

/** Pixel sprite of a unit in a pose, always facing right; flip it to face left. */
export function unitSprite(def: UnitDef, side: Side, key: PoseKey): Sprite {
  const id = `${def.id}|${side}|${key}`;
  let s = cache.get(id);
  if (!s) {
    s = paintUnit(def, side, poseOf(key));
    cache.set(id, s);
  }
  return s;
}

const flashCache = new Map<Sprite, HTMLCanvasElement>();

/** White silhouette of a sprite, flashed for a moment when the unit is hit. */
export function flashOf(s: Sprite): HTMLCanvasElement {
  let c = flashCache.get(s);
  if (!c) {
    c = document.createElement('canvas');
    c.width = s.canvas.width;
    c.height = s.canvas.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(s.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    flashCache.set(s, c);
  }
  return c;
}

/** Picks the animation frame for a unit's current state. */
export function poseKeyFor(state: string, walkT: number, atkT: number, def: UnitDef): PoseKey {
  const swingDur = Math.min(0.35, def.attackInterval * 0.5);
  if (atkT < swingDur && state === 'attack') return `a${Math.min(3, Math.floor((atkT / swingDur) * 4))}` as PoseKey;
  if (state === 'walk' || state === 'back') {
    const phase = walkT * (def.speed / 46) * 9;
    return `w${Math.floor(phase / (Math.PI / 2)) % 4}` as PoseKey;
  }
  return 'i';
}

function paintUnit(def: UnitDef, side: Side, pose: Pose): Sprite {
  const H = def.height * ART;
  const w = Math.ceil(Math.max(def.width * ART * 3, H * 2.4)) + 24;
  const h = Math.ceil(H * 1.5) + 14;
  const ox = Math.floor(w / 2);
  const oy = h - 3;
  const p = new Painter(w, h);
  const tc = team(side);
  p.translate(ox, oy);
  if (def.mount) {
    const s = H / MOUNT_H[def.mount];
    p.scale(s, s);
    drawMount(p, def, tc, pose, s);
  } else {
    const s = H / HUMAN_H;
    p.scale(s, s);
    drawHuman(p, tc, def.head, def.weapon, pose, true, s);
  }
  p.autoShade();
  p.outline(INK);
  return p.toSprite(ox, oy);
}

// ---------------------------------------------------------------------------
// Humans (drawn facing +x, feet at origin, 46 units tall)
// ---------------------------------------------------------------------------

function drawHuman(p: Painter, tc: TeamColors, head: HeadKind, weapon: WeaponKind, pose: Pose, legs: boolean, s: number): void {
  if (legs) {
    const a = pose.leg * 0.55;
    for (const [sgn, color] of [[-1, tc.back], [1, tc.dark]] as const) {
      p.strokeStyle = color;
      p.lineWidth = 5;
      const fx = Math.sin(a * sgn) * 18;
      const fy = -20 + Math.cos(a * sgn) * 18;
      p.beginPath();
      p.moveTo(0, -20);
      p.lineTo(fx, fy);
      p.stroke();
      p.fillStyle = '#3b2616';
      p.fillRect(fx - 2.5, fy - 2, 7, 3.5);
    }
  }

  p.save();
  p.translate(0, pose.bob / s);

  // Back arm.
  p.strokeStyle = SKIN_DARK;
  p.lineWidth = 4;
  p.beginPath();
  p.moveTo(-2, -32);
  p.lineTo(-5, -22);
  p.stroke();

  // Torso with a belt.
  p.fillStyle = tc.main;
  roundRect(p, -7, -36, 14, 18, 3);
  p.fill();
  p.fillStyle = tc.light;
  p.fillRect(2, -34, 3, 8);
  p.fillStyle = '#3b2616';
  p.fillRect(-7, -23, 14, 3);
  p.fillStyle = GOLD;
  p.fillRect(-1, -23, 3, 3);

  // Head: a little oversized, which reads better at pixel scale.
  p.fillStyle = SKIN;
  p.beginPath();
  p.arc(1, -41, 7, 0, Math.PI * 2);
  p.fill();
  p.dot(4.5, -42, INK);
  drawHead(p, head, tc);

  drawArmAndWeapon(p, weapon, head === 'visor', pose);
  p.restore();
}

function drawHead(p: Painter, head: HeadKind, tc: TeamColors): void {
  switch (head) {
    case 'hair':
      p.fillStyle = '#4a2c14';
      p.beginPath();
      p.arc(0, -43, 7.4, Math.PI * 0.95, Math.PI * 2.08);
      p.lineTo(-6, -36);
      p.fill();
      break;
    case 'crest':
      p.fillStyle = '#d9a83f';
      p.beginPath();
      p.arc(1, -42, 7.6, Math.PI, Math.PI * 2);
      p.fill();
      p.fillStyle = '#c0392b';
      p.beginPath();
      p.ellipse(-1, -51, 9, 3.6, -0.15, 0, Math.PI * 2);
      p.fill();
      break;
    case 'helm':
      p.fillStyle = '#a7b0ba';
      roundRect(p, -6.5, -50, 15, 11, 3);
      p.fill();
      p.fillStyle = INK;
      p.fillRect(2, -44.5, 7, 2);
      p.fillStyle = tc.main;
      p.fillRect(-1, -53, 3, 4);
      break;
    case 'bork':
      // Janissary börk: tall white felt hat folding back.
      p.fillStyle = '#f4f1e8';
      p.beginPath();
      p.moveTo(-5, -45);
      p.lineTo(7, -46);
      p.lineTo(1, -63);
      p.quadraticCurveTo(-7, -65, -13, -53);
      p.closePath();
      p.fill();
      p.fillStyle = '#d4a63a';
      p.fillRect(-6, -48, 13, 3);
      break;
    case 'helmet':
      p.fillStyle = '#5c6a40';
      p.beginPath();
      p.arc(1, -43, 8, Math.PI, Math.PI * 2);
      p.lineTo(10, -42);
      p.lineTo(-8, -42);
      p.fill();
      break;
    case 'visor':
      p.fillStyle = '#262c45';
      p.beginPath();
      p.arc(1, -42, 8, 0, Math.PI * 2);
      p.fill();
      p.fillStyle = '#5ef0ff';
      p.fillRect(1, -45, 8, 3);
      break;
  }
}

function drawArmAndWeapon(p: Painter, weapon: WeaponKind, future: boolean, pose: Pose): void {
  const sx = 2;
  const sy = -32;
  const melee = MELEE.includes(weapon);
  let angle: number;
  let reach = 11;
  if (melee) {
    angle = pose.swing >= 0 ? -1.7 + pose.swing * 2.4 : -0.5;
  } else if (weapon === 'spear') {
    angle = 0.05;
    if (pose.swing >= 0) reach += Math.sin(pose.swing * Math.PI) * 7;
  } else if (weapon === 'sling') {
    angle = pose.swing >= 0 ? -2.2 + pose.swing * 2.6 : -1.4;
  } else {
    angle = 0;
    if (pose.shotT < 0.12) reach -= (1 - pose.shotT / 0.12) * 3;
  }
  const hx = sx + Math.cos(angle) * reach;
  const hy = sy + Math.sin(angle) * reach;

  p.save();
  p.translate(hx, hy);
  p.rotate(angle);
  drawWeapon(p, weapon, future, pose);
  p.restore();

  p.strokeStyle = SKIN;
  p.lineWidth = 4;
  p.beginPath();
  p.moveTo(sx, sy);
  p.lineTo(hx, hy);
  p.stroke();
}

/** Weapons are drawn along +x from the hand. */
function drawWeapon(p: Painter, weapon: WeaponKind, future: boolean, pose: Pose): void {
  const flash = pose.shotT < 0.07;
  switch (weapon) {
    case 'club':
      p.strokeStyle = '#8a5528';
      p.lineWidth = 4.5;
      line(p, -2, 0, 12, 0);
      p.fillStyle = '#8a5528';
      circle(p, 14, 0, 4.5);
      break;
    case 'sword':
      p.strokeStyle = '#dfe5ea';
      p.lineWidth = 3;
      line(p, 2, 0, 20, 0);
      p.strokeStyle = '#7a5226';
      p.lineWidth = 3;
      line(p, 2, -5, 2, 5);
      break;
    case 'saber':
      p.strokeStyle = future ? '#8ff5ff' : '#e3e7ea';
      p.lineWidth = 3;
      p.beginPath();
      p.moveTo(1, 0);
      p.quadraticCurveTo(12, -1, 21, -6);
      p.stroke();
      break;
    case 'spear':
      p.strokeStyle = '#9a6430';
      p.lineWidth = 2.6;
      line(p, -14, 0, 22, 0);
      p.fillStyle = '#d0d6dc';
      p.beginPath();
      p.moveTo(21, -3.5);
      p.lineTo(30, 0);
      p.lineTo(21, 3.5);
      p.fill();
      break;
    case 'sling':
      p.strokeStyle = '#b08a5a';
      p.lineWidth = 1.5;
      line(p, 0, 0, 9, 3);
      p.fillStyle = '#9a9a9a';
      circle(p, 9, 3, 3);
      break;
    case 'bow':
      p.strokeStyle = '#8a5528';
      p.lineWidth = 2.6;
      p.beginPath();
      p.arc(-4, 0, 12, -1.1, 1.1);
      p.stroke();
      p.strokeStyle = '#e8e8e8';
      p.lineWidth = 1;
      line(p, Math.cos(-1.1) * 12 - 4, Math.sin(-1.1) * 12, Math.cos(1.1) * 12 - 4, Math.sin(1.1) * 12);
      break;
    case 'crossbow':
      p.strokeStyle = '#7a5226';
      p.lineWidth = 3.5;
      line(p, -4, 0, 12, 0);
      p.strokeStyle = '#555';
      p.lineWidth = 2.4;
      p.beginPath();
      p.arc(6, 0, 7, -1.3, 1.3);
      p.stroke();
      break;
    case 'gun':
      p.fillStyle = '#2e2e2e';
      p.fillRect(-4, -2, 21, 4);
      p.fillStyle = '#7a5226';
      p.fillRect(-9, -1.5, 7, 5);
      if (flash) {
        p.fillStyle = '#ffe28a';
        circle(p, 20, 0, 4);
        p.fillStyle = '#ffffff';
        circle(p, 20, 0, 1.8);
      }
      break;
    case 'blaster':
      p.fillStyle = '#3d4466';
      roundRect(p, -4, -3.5, 18, 7, 2);
      p.fill();
      p.fillStyle = flash ? '#ffffff' : '#5ef0ff';
      circle(p, 15, 0, flash ? 4 : 2.4);
      break;
    case 'launcher':
      p.fillStyle = future ? '#5a46a0' : '#56653f';
      p.fillRect(-11, -7, 26, 7);
      p.fillStyle = INK;
      p.fillRect(14, -7.5, 3, 8);
      if (flash) {
        p.fillStyle = future ? '#d8cbff' : '#ffb347';
        circle(p, 20, -3.5, 4.5);
      }
      break;
  }
}

// ---------------------------------------------------------------------------
// Mounts and vehicles (drawn facing +x, ground at origin)
// ---------------------------------------------------------------------------

function rider(p: Painter, def: UnitDef, tc: TeamColors, pose: Pose, x: number, y: number, k: number, s: number): void {
  p.save();
  p.translate(x, y);
  p.scale(k, k);
  drawHuman(p, tc, def.head, def.weapon, { ...pose, bob: 0 }, false, s * k);
  p.restore();
}

function drawMount(p: Painter, def: UnitDef, tc: TeamColors, pose: Pose, s: number): void {
  const leg = pose.leg;
  const recoil = pose.shotT < 0.15 ? (1 - pose.shotT / 0.15) * 4 : 0;
  switch (def.mount!) {
    case 'mammoth': {
      p.fillStyle = '#5c3d22';
      for (const [lx, ph] of [[-16, 1], [-6, -1], [8, 1], [18, -1]] as const) {
        p.fillRect(lx - 4.5 + leg * ph * 2, -18, 9, 18);
      }
      p.fillStyle = '#7a5230';
      p.beginPath();
      p.ellipse(0, -30, 31, 21, 0, 0, Math.PI * 2);
      p.fill();
      p.beginPath();
      p.arc(27, -34, 14, 0, Math.PI * 2);
      p.fill();
      p.fillStyle = '#93673e';
      p.beginPath();
      p.ellipse(-4, -40, 20, 8, 0, 0, Math.PI * 2);
      p.fill();
      p.strokeStyle = '#7a5230';
      p.lineWidth = 7;
      p.beginPath();
      p.moveTo(35, -30);
      p.quadraticCurveTo(45 + (pose.swing >= 0 ? 6 : 0), -14, 39, -3);
      p.stroke();
      p.strokeStyle = '#f4ecd8';
      p.lineWidth = 3.5;
      p.beginPath();
      p.moveTo(31, -26);
      p.quadraticCurveTo(45, -22, 47, -33);
      p.stroke();
      p.dot(31, -38, INK);
      p.fillStyle = tc.main;
      p.fillRect(-15, -52, 24, 7);
      p.fillStyle = GOLD;
      p.fillRect(-15, -46, 24, 2);
      rider(p, def, tc, pose, -2, -33, 0.8, s);
      break;
    }
    case 'chariot': {
      drawHorse(p, 26, tc, leg, '#9a6430');
      p.strokeStyle = '#5a3a1a';
      p.lineWidth = 2.5;
      line(p, 4, -20, 16, -22);
      p.fillStyle = '#a8743f';
      p.fillRect(-25, -31, 30, 17);
      p.fillStyle = tc.main;
      p.fillRect(-25, -31, 30, 5);
      drawWheel(p, -10, -12, 12, pose.spin);
      rider(p, def, tc, pose, -10, -18, 0.85, s);
      break;
    }
    case 'knight': {
      drawHorse(p, 0, tc, leg, '#ece6d8');
      rider(p, def, tc, pose, -2, -24, 0.85, s);
      break;
    }
    case 'cannon': {
      p.save();
      p.translate(-recoil, 0);
      p.save();
      p.translate(4, -20);
      p.rotate(-0.18);
      p.fillStyle = '#333333';
      roundRect(p, -12, -6.5, 41, 13, 5);
      p.fill();
      p.fillStyle = '#d4a63a';
      p.fillRect(-4, -7.5, 4, 15);
      p.fillRect(24, -7, 3, 14);
      p.restore();
      p.fillStyle = '#7a5226';
      p.fillRect(-19, -18, 28, 7);
      drawWheel(p, -2, -12, 12, 0);
      p.restore();
      if (pose.shotT < 0.08) {
        p.fillStyle = '#ffe28a';
        circle(p, 41, -27, 8);
        p.fillStyle = '#ffffff';
        circle(p, 41, -27, 3.5);
      }
      p.save();
      p.translate(-27, 0);
      p.scale(0.9, 0.9);
      drawHuman(p, tc, def.head, 'club', { ...pose, swing: -1 }, true, s * 0.9);
      p.restore();
      break;
    }
    case 'tank': {
      p.save();
      p.translate(-recoil * 0.5, 0);
      p.fillStyle = '#2f3328';
      roundRect(p, -37, -17, 74, 17, 8);
      p.fill();
      p.fillStyle = '#5a5f4c';
      for (let i = 0; i < 6; i++) circle(p, -28 + i * 11.2, -8.5, 4.5);
      p.fillStyle = '#66704f';
      p.beginPath();
      p.moveTo(-33, -17);
      p.lineTo(35, -17);
      p.lineTo(29, -31);
      p.lineTo(-29, -31);
      p.fill();
      p.fillStyle = tc.main;
      p.fillRect(-28, -27, 13, 6);
      p.fillStyle = '#58623f';
      roundRect(p, -15, -45, 32, 16, 5);
      p.fill();
      p.fillStyle = '#414833';
      p.fillRect(15 - recoil, -41, 31, 6);
      p.restore();
      if (pose.shotT < 0.08) {
        p.fillStyle = '#ffe28a';
        circle(p, 50, -38, 8);
        p.fillStyle = '#ffffff';
        circle(p, 50, -38, 3.5);
      }
      break;
    }
    case 'mech': {
      const glow = def.legendary ? GOLD : '#5ef0ff';
      p.strokeStyle = '#454d75';
      p.lineWidth = 10;
      for (const sgn of [1, -1]) {
        const a = leg * 0.45 * sgn;
        p.beginPath();
        p.moveTo(0, -50);
        p.lineTo(Math.sin(a) * 18 + 4, -26);
        p.lineTo(Math.sin(a) * 22, 0);
        p.stroke();
      }
      p.fillStyle = def.legendary ? '#5a4a1e' : '#2e3558';
      roundRect(p, -23, -88, 46, 42, 8);
      p.fill();
      p.fillStyle = tc.main;
      p.fillRect(-23, -61, 46, 7);
      p.fillStyle = glow;
      roundRect(p, 2, -82, 17, 9, 3);
      p.fill();
      p.fillStyle = '#454d75';
      p.fillRect(10 - recoil, -67, 35, 10);
      p.fillStyle = pose.shotT < 0.08 ? '#ffffff' : glow;
      circle(p, 46 - recoil, -62, pose.shotT < 0.08 ? 8 : 4);
      if (def.legendary) {
        p.fillStyle = GOLD;
        p.beginPath();
        p.moveTo(-15, -88);
        p.lineTo(-9, -101);
        p.lineTo(0, -90);
        p.lineTo(9, -101);
        p.lineTo(15, -88);
        p.fill();
      }
      break;
    }
  }
}

function drawHorse(p: Painter, x: number, tc: TeamColors, leg: number, cloth: string): void {
  p.fillStyle = '#6b4423';
  for (const [lx, ph] of [[-12, 1], [-6, -1], [10, 1], [15, -1]] as const) {
    p.save();
    p.translate(x + lx, -20);
    p.rotate(leg * ph * 0.4);
    p.fillRect(-2.5, 0, 5, 20);
    p.restore();
  }
  p.fillStyle = '#7a4f2a';
  p.beginPath();
  p.ellipse(x, -26, 21, 10, 0, 0, Math.PI * 2);
  p.fill();
  p.beginPath();
  p.moveTo(x + 14, -31);
  p.lineTo(x + 24, -46);
  p.lineTo(x + 33, -41);
  p.lineTo(x + 21, -24);
  p.fill();
  p.fillStyle = '#3b2616';
  p.fillRect(x + 20, -48, 5, 8);
  p.dot(x + 28, -43, INK);
  p.fillStyle = cloth;
  p.fillRect(x - 17, -33, 24, 11);
  p.fillStyle = tc.main;
  p.fillRect(x - 17, -25, 24, 4);
}

function drawWheel(p: Painter, x: number, y: number, r: number, spin: number): void {
  p.strokeStyle = '#4a3420';
  p.lineWidth = 3;
  p.beginPath();
  p.arc(x, y, r, 0, Math.PI * 2);
  p.stroke();
  p.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) {
    const a = spin * 0.5 + (i * Math.PI) / 4;
    line(p, x - Math.cos(a) * r, y - Math.sin(a) * r, x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  p.fillStyle = '#8a6a44';
  circle(p, x, y, 2.5);
}

// ---------------------------------------------------------------------------

export function roundRect(p: Painter, x: number, y: number, w: number, h: number, r: number): void {
  p.beginPath();
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
}

export function line(p: Painter, x1: number, y1: number, x2: number, y2: number): void {
  p.beginPath();
  p.moveTo(x1, y1);
  p.lineTo(x2, y2);
  p.stroke();
}

export function circle(p: Painter, x: number, y: number, r: number): void {
  p.beginPath();
  p.arc(x, y, r, 0, Math.PI * 2);
  p.fill();
}
