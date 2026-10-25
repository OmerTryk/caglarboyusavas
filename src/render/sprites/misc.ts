import { INK } from '../pixel/color';
import { Painter, type Sprite } from '../pixel/painter';
import { GOLD } from '../palette';
import { circle } from './units';

const cache = new Map<string, Sprite>();

function cached(key: string, paint: () => Sprite): Sprite {
  let s = cache.get(key);
  if (!s) {
    s = paint();
    cache.set(key, s);
  }
  return s;
}

/** Supply crate, origin at its bottom centre. */
export function crateSprite(): Sprite {
  return cached('crate', () => {
    const p = new Painter(20, 16);
    p.translate(10, 14);
    p.fillStyle = '#a8743f';
    p.fillRect(-7, -11, 14, 11);
    p.fillStyle = '#7a5226';
    p.fillRect(-7, -6, 14, 1);
    p.fillRect(-1, -11, 2, 11);
    p.fillStyle = GOLD;
    p.fillRect(-2, -8, 4, 3);
    p.autoShade();
    p.outline(INK);
    return p.toSprite(10, 14);
  });
}

/** Parachute canopy, origin where the crate hangs. */
export function chuteSprite(): Sprite {
  return cached('chute', () => {
    const p = new Painter(36, 30);
    p.translate(18, 28);
    p.fillStyle = '#f4f1e8';
    p.beginPath();
    p.arc(0, -16, 14, Math.PI, Math.PI * 2);
    p.fill();
    p.fillStyle = '#d6403a';
    p.beginPath();
    p.arc(0, -16, 14, Math.PI * 1.33, Math.PI * 1.66);
    p.lineTo(0, -16);
    p.fill();
    p.strokeStyle = '#c8c0b0';
    p.lineWidth = 1;
    for (const x of [-13, -5, 5, 13]) {
      p.beginPath();
      p.moveTo(x, -16);
      p.lineTo(0, 0);
      p.stroke();
    }
    p.autoShade();
    p.outline(INK);
    return p.toSprite(18, 28);
  });
}

/** Puffy pixel cloud; `future` gives the violet night-sky version. */
export function cloudSprite(variant: number, future: boolean): Sprite {
  return cached(`cloud|${variant}|${future}`, () => {
    const p = new Painter(64, 28);
    p.translate(32, 24);
    const base = future ? '#4a3d7a' : '#ffffff';
    const under = future ? '#352b5c' : '#d6e2f0';
    const k = 0.8 + (variant % 3) * 0.15;
    p.fillStyle = under;
    p.fillRect(-24 * k, -6, 48 * k, 6);
    p.fillStyle = base;
    circle(p, -14 * k, -8, 8 * k);
    circle(p, 0, -13, 11 * k);
    circle(p, 14 * k, -8, 8 * k);
    p.fillRect(-20 * k, -9, 40 * k, 5);
    p.autoShade(0.05, 0.12);
    return p.toSprite(32, 24);
  });
}

/** Tiny rank star shown above veteran units. */
export function starSprite(): Sprite {
  return cached('star', () => {
    const p = new Painter(7, 7);
    const c = '#ffcf3f';
    for (const [x, y] of [[3, 1], [2, 2], [3, 2], [4, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [2, 4], [3, 4], [4, 4], [2, 5], [4, 5]]) {
      p.dot(x, y, c);
    }
    p.outline(INK);
    return p.toSprite(3, 3);
  });
}
