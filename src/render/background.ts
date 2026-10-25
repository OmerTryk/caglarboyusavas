import { AGES } from '../sim/data';
import type { AgeDef } from '../sim/types';
import { GROUND_A, LOW_H, LOW_W } from './art';
import { BAYER4, INK, mix, packHex, shade } from './pixel/color';
import { Painter } from './pixel/painter';
import { noise } from './palette';
import { circle } from './sprites/units';

const cache = new Map<number, HTMLCanvasElement>();
const SUN_X = Math.round(LOW_W * 0.77);

/** Pixel-art scenery for an age at art resolution (LOW_W x LOW_H), cached. */
export function backgroundFor(age: number): HTMLCanvasElement {
  let c = cache.get(age);
  if (!c) {
    const p = new Painter(LOW_W, LOW_H);
    paint(p, AGES[age]);
    c = p.toCanvas();
    cache.set(age, c);
  }
  return c;
}

/** Smooth 1D value noise, 0..1. */
function vnoise(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const t = f * f * (3 - 2 * f);
  return noise(i, seed) * (1 - t) + noise(i + 1, seed) * t;
}

function dithered(p: Painter, x: number, y: number, a: string, b: string, t: number): void {
  p.set(x, y, t > BAYER4[(x & 3) + ((y & 3) << 2)] ? packHex(b) : packHex(a));
}

function paint(p: Painter, age: AgeDef): void {
  const pal = age.palette;
  const future = age.baseStyle === 'dome';
  const G = GROUND_A;

  // Sky: banded gradient with ordered dithering between the bands.
  const bands = 6;
  const colors = Array.from({ length: bands + 1 }, (_, i) => mix(pal.skyTop, pal.skyBottom, i / bands));
  for (let y = 0; y < G; y++) {
    const t = (y / G) * bands;
    const i = Math.min(bands - 1, Math.floor(t));
    for (let x = 0; x < LOW_W; x++) dithered(p, x, y, colors[i], colors[i + 1], t - i);
  }

  if (future) {
    for (let i = 0; i < 160; i++) {
      const x = Math.floor(noise(i, 1) * LOW_W);
      // Kept off the top rows: those get stretched into the letterbox margin.
      const y = 4 + Math.floor(noise(i, 2) * G * 0.72);
      const bright = noise(i, 9) > 0.85;
      p.dot(x, y, bright ? '#ffffff' : '#a99be0');
      if (bright) {
        p.dot(x - 1, y, '#6f5fb0');
        p.dot(x + 1, y, '#6f5fb0');
        p.dot(x, y - 1, '#6f5fb0');
        p.dot(x, y + 1, '#6f5fb0');
      }
    }
    p.fillStyle = '#d8cbff';
    circle(p, SUN_X, 48, 18);
    p.fillStyle = colors[1];
    circle(p, SUN_X + 7, 43, 15);
  } else {
    // Sun with a dithered halo.
    for (let y = 14; y < 82; y++) {
      for (let x = SUN_X - 34; x < SUN_X + 34; x++) {
        const d = Math.hypot(x - SUN_X, y - 48);
        if (d < 30 && d > 15) dithered(p, x, y, colors[Math.min(bands, Math.floor((y / G) * bands))], '#fff6d8', (30 - d) / 26);
      }
    }
    p.fillStyle = '#fff6d8';
    circle(p, SUN_X, 48, 15);
  }

  // Far range.
  const jag = age.baseStyle === 'cave' ? 1.5 : future || age.baseStyle === 'bunker' ? 0.35 : 1;
  const far: number[] = [];
  for (let x = 0; x < LOW_W; x++) {
    const h = 24 + (vnoise(x / 30, age.index + 3) * 58 + vnoise(x / 8, age.index + 13) * 11) * jag;
    far.push(Math.round(G - 28 - h));
  }
  const farLit = shade(pal.far, 0.14);
  for (let x = 0; x < LOW_W; x++) {
    const top = far[x];
    const lit = x + 1 < LOW_W && far[x + 1] > top;
    for (let y = top; y < G; y++) p.set(x, y, packHex(y - top < 2 && lit ? farLit : pal.far));
    if (age.baseStyle === 'cave' && top < G - 105) for (let y = top; y < top + 3; y++) p.set(x, y, packHex('#f4efe6'));
  }

  if (future || age.baseStyle === 'bunker') paintSkyline(p, future);
  if (age.baseStyle === 'castle') paintFarCastles(p, pal.far);
  if (age.baseStyle === 'temple') paintFarColumns(p, mix(pal.far, '#ffffff', 0.35));

  // Haze band between far and near layers.
  for (let y = G - 40; y < G - 14; y++) {
    for (let x = 0; x < LOW_W; x++) if (((x + y) & 3) === 0) p.set(x, y, packHex(mix(pal.far, pal.skyBottom, 0.4)));
  }

  // Near hills.
  const nearLit = shade(pal.near, 0.16);
  const nearDark = shade(pal.near, -0.2);
  for (let x = 0; x < LOW_W; x++) {
    const h = 14 + Math.sin(x / 90 + age.index) * 10 + vnoise(x / 12, age.index + 7) * 6;
    const top = Math.round(G - h);
    for (let y = top; y < G; y++) p.set(x, y, packHex(y === top ? nearLit : y > G - 4 ? nearDark : pal.near));
  }

  if (age.baseStyle === 'cave' || age.baseStyle === 'temple' || age.baseStyle === 'castle') paintTrees(p, age);

  // Ground: grass lip, dirt with specks and pebbles, darker toward the bottom.
  const lip = age.baseStyle === 'cave' || age.baseStyle === 'temple' || age.baseStyle === 'castle' ? '#5d8a32' : shade(pal.ground, 0.15);
  for (let y = G - 3; y < LOW_H; y++) {
    const t = (y - G) / (LOW_H - G);
    for (let x = 0; x < LOW_W; x++) {
      if (y < G) {
        p.set(x, y, packHex(lip));
        continue;
      }
      dithered(p, x, y, pal.ground, pal.groundDark, t * 0.8);
    }
  }
  for (let x = 0; x < LOW_W; x++) {
    if (noise(x, 31) > 0.7) p.dot(x, G - 4, lip);
    if (noise(x, 32) > 0.92) p.dot(x, G - 5, shade(lip, 0.2));
    p.dot(x, G, shade(lip, -0.35));
  }
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(noise(i, 6) * LOW_W);
    const y = G + 3 + Math.floor(noise(i, 7) * (LOW_H - G - 5));
    const c = noise(i, 4) > 0.5 ? shade(pal.ground, -0.25) : shade(pal.ground, 0.18);
    p.dot(x, y, c);
    if (noise(i, 5) > 0.75) p.dot(x + 1, y, c);
  }
}

function paintSkyline(p: Painter, future: boolean): void {
  const G = GROUND_A;
  const body = future ? '#2a2358' : '#545d66';
  const lit = future ? '#5ef0ff' : '#ffe9a0';
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(i * 20 + noise(i, 11) * 10);
    const w = 11 + Math.floor(noise(i, 12) * 13);
    const h = 30 + Math.floor(noise(i, 13) * (future ? 110 : 70));
    const y = G - 14 - h;
    p.fillStyle = body;
    if (future && noise(i, 14) > 0.6) {
      p.beginPath();
      p.moveTo(x, G - 14);
      p.lineTo(x + w / 2, y - 10);
      p.lineTo(x + w, G - 14);
      p.fill();
    } else {
      p.fillRect(x, y, w, h);
      if (!future && noise(i, 16) > 0.6) {
        // War-torn rooftops.
        for (let k = 0; k < w; k += 2) p.set(x + k, y, 0);
      }
    }
    for (let j = 0; j < 10; j++) {
      if (noise(i * 10 + j, 15) > 0.55) {
        const wx = x + 2 + (j % 2) * Math.max(2, Math.floor(w / 2) - 1);
        const wy = y + 4 + Math.floor(j / 2) * 7;
        if (wy < G - 16) {
          p.dot(wx, wy, lit);
          p.dot(wx + 1, wy, lit);
        }
      }
    }
  }
}

function paintFarCastles(p: Painter, color: string): void {
  const G = GROUND_A;
  p.fillStyle = shade(color, -0.08);
  for (const cx of [Math.round(LOW_W * 0.24), Math.round(LOW_W * 0.62)]) {
    const y = G - 76;
    p.fillRect(cx - 20, y, 40, 36);
    p.fillRect(cx - 28, y - 20, 11, 56);
    p.fillRect(cx + 17, y - 20, 11, 56);
    for (let i = 0; i < 5; i++) p.fillRect(cx - 20 + i * 9, y - 5, 5, 5);
    p.fillRect(cx - 28, y - 24, 3, 4);
    p.fillRect(cx - 20, y - 24, 3, 4);
    p.fillRect(cx + 17, y - 24, 3, 4);
    p.fillRect(cx + 25, y - 24, 3, 4);
  }
}

function paintFarColumns(p: Painter, color: string): void {
  const G = GROUND_A;
  p.fillStyle = color;
  for (const cx of [Math.round(LOW_W * 0.29), Math.round(LOW_W * 0.66)]) {
    const y = G - 76;
    p.fillRect(cx - 30, y, 60, 5);
    p.beginPath();
    p.moveTo(cx - 32, y);
    p.lineTo(cx, y - 12);
    p.lineTo(cx + 32, y);
    p.fill();
    for (let i = 0; i < 5; i++) p.fillRect(cx - 27 + i * 13, y + 5, 5, 36);
  }
}

function paintTrees(p: Painter, age: AgeDef): void {
  const G = GROUND_A;
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(noise(i, 21) * LOW_W);
    if (x < 90 || x > LOW_W - 90) continue;
    const h = 20 + Math.floor(noise(i, 22) * 20);
    const t = new Painter(40, 50);
    t.translate(20, 48);
    t.fillStyle = '#5a3d22';
    t.fillRect(-1.5, -h * 0.55, 3, h * 0.55);
    if (age.baseStyle === 'castle') {
      t.fillStyle = '#2f5a35';
      t.beginPath();
      t.moveTo(-9, -h * 0.35);
      t.lineTo(0, -h - 6);
      t.lineTo(9, -h * 0.35);
      t.fill();
    } else {
      t.fillStyle = age.baseStyle === 'cave' ? '#6a8a32' : '#4c7a3c';
      circle(t, 0, -h * 0.72, 8 + noise(i, 23) * 4);
      circle(t, -5, -h * 0.6, 6);
      circle(t, 5, -h * 0.62, 6);
    }
    t.autoShade(0.2, 0.25);
    t.outline(INK);
    p.blit(t, x - 20, G - 6 - 48);
  }
}
