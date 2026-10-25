import { AGES } from '../../sim/data';
import type { BaseStyle, TurretDef } from '../../sim/types';
import { turretHeight } from '../../sim/world';
import { ART } from '../art';
import { INK, shadePacked } from '../pixel/color';
import { Painter, type Sprite } from '../pixel/painter';
import { circle, line, roundRect } from './units';

const W = 210;
const H = 150;
const OX = 105;
const OY = 144;

/** Where each base style plants its flag, in world units relative to the base: [x, roof y]. */
export const FLAG_SPOT: Record<BaseStyle, [number, number]> = {
  cave: [-40, -128],
  temple: [-50, -150],
  castle: [-60, -208],
  fort: [-53, -228],
  bunker: [-60, -102],
  dome: [-58, -82],
};

const baseCache = new Map<string, Sprite>();

/** Damage level from the base's remaining health: 0 intact, 1 cracked, 2 crumbling. */
export function damageLevel(ratio: number): 0 | 1 | 2 {
  return ratio > 0.66 ? 0 : ratio > 0.33 ? 1 : 2;
}

/** A base building, facing right, with its turret mast for `slots` slots. */
export function baseSprite(age: number, slots: number, damage: 0 | 1 | 2): Sprite {
  const key = `${age}|${slots}|${damage}`;
  let s = baseCache.get(key);
  if (!s) {
    s = paintBase(age, slots, damage);
    baseCache.set(key, s);
  }
  return s;
}

const tintCache = new Map<Sprite, HTMLCanvasElement>();

/** Red-tinted copy flashed when the base takes a hit. */
export function hitTintOf(s: Sprite): HTMLCanvasElement {
  let c = tintCache.get(s);
  if (!c) {
    c = document.createElement('canvas');
    c.width = s.canvas.width;
    c.height = s.canvas.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(s.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255,70,50,0.55)';
    ctx.fillRect(0, 0, c.width, c.height);
    tintCache.set(s, c);
  }
  return c;
}

function paintBase(age: number, slots: number, damage: 0 | 1 | 2): Sprite {
  const p = new Painter(W, H);
  p.translate(OX, OY);
  p.scale(ART, ART);
  drawBuilding(p, AGES[age].baseStyle);
  drawMast(p, slots);
  if (damage !== 0) applyDamage(p, damage, age * 7 + slots);
  p.autoShade(0.18, 0.28);
  p.outline(INK);
  return p.toSprite(OX, OY);
}

function drawMast(p: Painter, slots: number): void {
  const top = turretHeight(Math.max(0, slots - 1));
  p.fillStyle = '#5a4a3a';
  p.fillRect(8, -top, 5, top - 30);
  p.fillRect(19, -top, 5, top - 30);
  p.strokeStyle = '#5a4a3a';
  p.lineWidth = 2.5;
  for (let y = -40; y > -top; y -= 24) {
    line(p, 10, y, 21, y - 24);
    line(p, 21, y, 10, y - 24);
  }
  for (let i = 0; i < slots; i++) {
    const h = turretHeight(i);
    p.fillStyle = '#6b5a44';
    p.fillRect(0, -h + 8, 32, 7);
  }
}

function drawBuilding(p: Painter, style: BaseStyle): void {
  switch (style) {
    case 'cave': {
      p.fillStyle = '#8a7660';
      p.beginPath();
      p.moveTo(-86, 0);
      p.quadraticCurveTo(-82, -152, -10, -142);
      p.quadraticCurveTo(72, -134, 78, 0);
      p.fill();
      p.fillStyle = '#72604c';
      p.beginPath();
      p.ellipse(-32, -92, 28, 20, 0.4, 0, Math.PI * 2);
      p.fill();
      p.beginPath();
      p.ellipse(30, -110, 16, 10, -0.3, 0, Math.PI * 2);
      p.fill();
      p.fillStyle = '#5d7a2e';
      p.beginPath();
      p.ellipse(-20, -138, 30, 8, 0.05, 0, Math.PI * 2);
      p.fill();
      p.fillStyle = '#21180f';
      p.beginPath();
      p.moveTo(16, 0);
      p.quadraticCurveTo(18, -76, 44, -72);
      p.quadraticCurveTo(66, -68, 66, 0);
      p.fill();
      p.fillStyle = '#ff8a2a';
      circle(p, 42, -14, 10);
      p.fillStyle = '#ffd36b';
      circle(p, 42, -12, 5);
      p.fillStyle = '#e8e0cc';
      p.fillRect(-70, -12, 18, 5);
      circle(p, -70, -10, 4);
      circle(p, -52, -10, 4);
      break;
    }
    case 'temple': {
      p.fillStyle = '#d9cfb8';
      p.fillRect(-86, -16, 168, 16);
      p.fillRect(-78, -28, 152, 12);
      p.fillStyle = '#efe7d3';
      for (let i = 0; i < 5; i++) p.fillRect(-70 + i * 30, -128, 16, 100);
      p.fillStyle = '#c9bea4';
      for (let i = 0; i < 5; i++) p.fillRect(-60 + i * 30, -128, 3, 100);
      p.fillStyle = '#d9cfb8';
      p.fillRect(-82, -142, 160, 14);
      p.beginPath();
      p.moveTo(-86, -142);
      p.lineTo(-4, -188);
      p.lineTo(78, -142);
      p.fill();
      p.fillStyle = '#d4af37';
      p.beginPath();
      p.moveTo(-58, -146);
      p.lineTo(-4, -176);
      p.lineTo(50, -146);
      p.fill();
      break;
    }
    case 'castle': {
      p.fillStyle = '#8f9499';
      p.fillRect(-78, -132, 144, 132);
      p.fillRect(-90, -198, 42, 198);
      for (let i = 0; i < 6; i++) p.fillRect(-78 + i * 24, -146, 14, 14);
      for (let i = 0; i < 3; i++) p.fillRect(-90 + i * 16, -210, 10, 12);
      p.fillStyle = '#6f7378';
      for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) p.fillRect(-72 + c * 28 + (r % 2) * 12, -122 + r * 20, 18, 3);
      for (let r = 0; r < 4; r++) p.fillRect(-84 + (r % 2) * 10, -186 + r * 20, 20, 3);
      p.fillStyle = INK;
      p.fillRect(-74, -176, 8, 16);
      p.fillStyle = '#3b2a1a';
      p.beginPath();
      p.moveTo(20, 0);
      p.lineTo(20, -50);
      p.arc(38, -50, 18, Math.PI, 0);
      p.lineTo(56, 0);
      p.fill();
      p.fillStyle = '#5a4a3a';
      for (let i = 0; i < 4; i++) p.fillRect(23 + i * 9, -60, 3, 60);
      break;
    }
    case 'fort': {
      p.fillStyle = '#ae8c60';
      p.beginPath();
      p.moveTo(-92, 0);
      p.lineTo(-82, -112);
      p.lineTo(72, -112);
      p.lineTo(84, 0);
      p.fill();
      p.fillStyle = '#8f704a';
      p.fillRect(-82, -124, 154, 14);
      for (let i = 0; i < 7; i++) p.fillRect(-82 + i * 23, -134, 12, 12);
      p.fillStyle = '#d4b588';
      p.fillRect(-72, -202, 36, 92);
      p.fillStyle = '#c0392b';
      p.beginPath();
      p.moveTo(-78, -202);
      p.lineTo(-54, -236);
      p.lineTo(-30, -202);
      p.fill();
      p.fillStyle = INK;
      p.fillRect(-60, -180, 10, 14);
      p.fillStyle = '#2d2d2d';
      for (const y of [-82, -46]) {
        p.fillRect(40, y, 36, 9);
        circle(p, 40, y + 4.5, 8);
      }
      break;
    }
    case 'bunker': {
      p.fillStyle = '#90938b';
      p.beginPath();
      p.moveTo(-94, 0);
      p.lineTo(-78, -102);
      p.lineTo(68, -102);
      p.lineTo(86, 0);
      p.fill();
      p.fillStyle = '#74776f';
      p.fillRect(-78, -106, 146, 10);
      p.fillRect(-70, -60, 136, 4);
      p.fillStyle = INK;
      p.fillRect(10, -76, 48, 9);
      p.fillRect(-52, -76, 42, 9);
      p.fillStyle = '#c2b080';
      for (let i = 0; i < 6; i++) {
        roundRect(p, 40 + (i % 3) * 17, -13 - Math.floor(i / 3) * 11, 17, 11, 4);
        p.fill();
      }
      p.strokeStyle = '#4a4a4a';
      p.lineWidth = 4;
      line(p, -50, -102, -50, -170);
      p.fillStyle = '#a3a9ae';
      p.beginPath();
      p.ellipse(-50, -172, 18, 6, -0.3, 0, Math.PI * 2);
      p.fill();
      break;
    }
    case 'dome': {
      p.fillStyle = '#2e3460';
      p.fillRect(-92, -26, 174, 26);
      p.fillStyle = '#414a85';
      p.beginPath();
      p.arc(-6, -26, 82, Math.PI, Math.PI * 2);
      p.fill();
      p.strokeStyle = '#5ef0ff';
      p.lineWidth = 4;
      p.beginPath();
      p.arc(-6, -26, 70, Math.PI * 1.06, Math.PI * 1.94);
      p.stroke();
      p.fillStyle = '#5ef0ff';
      circle(p, -6, -62, 12);
      p.fillStyle = '#e0fdff';
      circle(p, -9, -65, 5);
      p.fillStyle = '#414a85';
      p.fillRect(-42, -194, 7, 92);
      p.fillStyle = '#ff4fd8';
      circle(p, -38, -198, 5);
      p.fillStyle = '#5ef0ff';
      for (let i = 0; i < 6; i++) p.fillRect(-80 + i * 28, -16, 12, 5);
      break;
    }
  }
}

/** Cracks, soot and missing chunks, seeded so each base looks the same every frame. */
function applyDamage(p: Painter, level: 1 | 2, seed: number): void {
  let st = seed * 9301 + 49297;
  const rnd = () => {
    st = (st * 9301 + 49297) % 233280;
    return st / 233280;
  };
  const opaque = (x: number, y: number) => p.get(x, y) !== 0;
  const pick = (): [number, number] | null => {
    for (let tries = 0; tries < 200; tries++) {
      const x = Math.floor(rnd() * p.w);
      const y = Math.floor(rnd() * p.h * 0.85);
      if (opaque(x, y)) return [x, y];
    }
    return null;
  };

  const cracks = level === 1 ? 6 : 12;
  for (let i = 0; i < cracks; i++) {
    const start = pick();
    if (!start) continue;
    let [x, y] = start;
    const len = 6 + Math.floor(rnd() * 10);
    for (let k = 0; k < len && opaque(x, y); k++) {
      p.set(x, y, shadePacked(p.get(x, y), -0.6));
      x += rnd() < 0.5 ? -1 : 1;
      if (rnd() < 0.7) y += 1;
    }
  }

  if (level === 2) {
    for (let i = 0; i < 5; i++) {
      const at = pick();
      if (!at) continue;
      const r = 3 + Math.floor(rnd() * 4);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) p.set(at[0] + dx, at[1] + dy, 0);
      }
    }
    for (let i = 0; i < p.buf.length; i++) {
      if (p.buf[i] !== 0 && rnd() < 0.18) p.buf[i] = shadePacked(p.buf[i], -0.3);
    }
  }
}

// ---------------------------------------------------------------------------
// Turrets
// ---------------------------------------------------------------------------

const TURRET_STEPS = 24;
const turretCache = new Map<string, Sprite>();

/** Turret sprite with its barrel aimed at `angle` (radians, facing right), quantised. */
export function turretSprite(def: TurretDef, angle: number): Sprite {
  const step = ((Math.round((angle / (Math.PI * 2)) * TURRET_STEPS) % TURRET_STEPS) + TURRET_STEPS) % TURRET_STEPS;
  const key = `${def.id}|${step}`;
  let s = turretCache.get(key);
  if (!s) {
    s = paintTurret(def, (step / TURRET_STEPS) * Math.PI * 2);
    turretCache.set(key, s);
  }
  return s;
}

function paintTurret(def: TurretDef, angle: number): Sprite {
  const p = new Painter(48, 48);
  p.translate(24, 24);
  p.scale(ART * 1.5, ART * 1.5);
  const accent = AGES[def.age].palette.accent;
  const heavy = def.kind === 'agir';
  p.fillStyle = '#4a4a4a';
  roundRect(p, -12, -2, 24, 13, 3);
  p.fill();
  p.save();
  p.rotate(angle);
  p.fillStyle = heavy ? '#2e2e2e' : '#5a5a5a';
  p.fillRect(0, heavy ? -5.5 : -3.5, heavy ? 23 : 27, heavy ? 11 : 7);
  p.fillStyle = accent;
  circle(p, 0, 0, heavy ? 9.5 : 7.5);
  if (def.age === 5) {
    p.fillStyle = '#5ef0ff';
    circle(p, heavy ? 23 : 27, 0, 3.5);
  }
  p.restore();
  p.autoShade(0.2, 0.3);
  p.outline(INK);
  return p.toSprite(24, 24);
}
