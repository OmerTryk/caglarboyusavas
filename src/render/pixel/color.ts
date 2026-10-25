/** Colours are packed as 0xAABBGGRR so they can be written straight into ImageData. */
export type Packed = number;

const cache = new Map<string, Packed>();

export function pack(r: number, g: number, b: number, a = 255): Packed {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function unpack(c: Packed): [number, number, number, number] {
  return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, c >>> 24];
}

export function rgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function packHex(hex: string): Packed {
  let c = cache.get(hex);
  if (c === undefined) {
    const [r, g, b] = rgb(hex);
    c = pack(r, g, b);
    cache.set(hex, c);
  }
  return c;
}

export function toHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Blends two hex colours; t=0 gives a, t=1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** Positive amounts lighten toward white, negative darken toward a cool shadow. */
export function shade(hex: string, amount: number): string {
  return amount >= 0 ? mix(hex, '#fff8e8', amount) : mix(hex, '#140c1c', -amount);
}

export function shadePacked(c: Packed, amount: number): Packed {
  const [r, g, b, a] = unpack(c);
  if (amount >= 0) return pack(r + (255 - r) * amount, g + (248 - g) * amount, b + (232 - b) * amount, a);
  const k = -amount;
  return pack(r + (20 - r) * k, g + (12 - g) * k, b + (28 - b) * k, a);
}

/** The near-black outline every sprite gets. */
export const INK = '#1a1020';

/** 4x4 Bayer matrix, normalised to 0..1, for ordered dithering. */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
