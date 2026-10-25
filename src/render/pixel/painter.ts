import { packHex, shadePacked, type Packed } from './color';

type Pt = [number, number];
type Mat = [number, number, number, number, number, number];

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Where the drawing origin (feet / base centre) sits inside the canvas. */
  ox: number;
  oy: number;
}

/**
 * A tiny software rasteriser with a subset of the Canvas 2D API. It draws hard-edged,
 * anti-alias-free pixels, so shapes come out as clean pixel art at any scale.
 */
export class Painter {
  readonly buf: Uint32Array;
  lineWidth = 1;
  private m: Mat = [1, 0, 0, 1, 0, 0];
  private stack: Mat[] = [];
  private paths: Pt[][] = [];
  private cur: Pt[] | null = null;
  private last: Pt = [0, 0];
  private fillC: Packed = 0;
  private strokeC: Packed = 0;

  constructor(readonly w: number, readonly h: number) {
    this.buf = new Uint32Array(w * h);
  }

  set fillStyle(hex: string) {
    this.fillC = packHex(hex);
  }

  set strokeStyle(hex: string) {
    this.strokeC = packHex(hex);
  }

  // --- transforms ---------------------------------------------------------

  save(): void {
    this.stack.push([...this.m] as Mat);
  }

  restore(): void {
    const m = this.stack.pop();
    if (m) this.m = m;
  }

  translate(x: number, y: number): void {
    const [a, b, c, d, e, f] = this.m;
    this.m = [a, b, c, d, a * x + c * y + e, b * x + d * y + f];
  }

  scale(sx: number, sy: number): void {
    const [a, b, c, d, e, f] = this.m;
    this.m = [a * sx, b * sx, c * sy, d * sy, e, f];
  }

  rotate(r: number): void {
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const [a, b, c, d, e, f] = this.m;
    this.m = [a * cos + c * sin, b * cos + d * sin, c * cos - a * sin, d * cos - b * sin, e, f];
  }

  private tp(x: number, y: number): Pt {
    const [a, b, c, d, e, f] = this.m;
    return [a * x + c * y + e, b * x + d * y + f];
  }

  private unit(): number {
    const [a, b, c, d] = this.m;
    return Math.sqrt(Math.abs(a * d - b * c));
  }

  // --- paths --------------------------------------------------------------

  beginPath(): void {
    this.paths = [];
    this.cur = null;
  }

  moveTo(x: number, y: number): void {
    this.cur = [this.tp(x, y)];
    this.paths.push(this.cur);
    this.last = [x, y];
  }

  lineTo(x: number, y: number): void {
    if (!this.cur) return this.moveTo(x, y);
    this.cur.push(this.tp(x, y));
    this.last = [x, y];
  }

  closePath(): void {
    if (this.cur && this.cur.length > 1) this.cur.push(this.cur[0]);
  }

  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void {
    const [x0, y0] = this.last;
    const n = Math.max(4, Math.ceil((Math.hypot(cx - x0, cy - y0) + Math.hypot(x - cx, y - cy)) * this.unit() / 2));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      this.lineTo(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y);
    }
  }

  arc(cx: number, cy: number, r: number, a0: number, a1: number, ccw = false): void {
    this.ellipse(cx, cy, r, r, 0, a0, a1, ccw);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw = false): void {
    let span = a1 - a0;
    if (!ccw && span < 0) span = (span % (Math.PI * 2)) + Math.PI * 2;
    if (ccw && span > 0) span = (span % (Math.PI * 2)) - Math.PI * 2;
    if (Math.abs(a1 - a0) >= Math.PI * 2) span = ccw ? -Math.PI * 2 : Math.PI * 2;
    const n = Math.max(8, Math.ceil(Math.abs(span) * Math.max(rx, ry) * this.unit() / 1.2));
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    for (let i = 0; i <= n; i++) {
      const a = a0 + (span * i) / n;
      const ex = Math.cos(a) * rx;
      const ey = Math.sin(a) * ry;
      const x = cx + ex * cos - ey * sin;
      const y = cy + ex * sin + ey * cos;
      if (i === 0 && !this.cur) this.moveTo(x, y);
      else this.lineTo(x, y);
    }
  }

  /** Rounded corner approximated by a quadratic curve; plenty for pixel-sized radii. */
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void {
    const [x0, y0] = this.last;
    const v1 = norm(x0 - x1, y0 - y1);
    const v2 = norm(x2 - x1, y2 - y1);
    const d = Math.min(r, Math.hypot(x0 - x1, y0 - y1) / 2, Math.hypot(x2 - x1, y2 - y1) / 2);
    this.lineTo(x1 + v1[0] * d, y1 + v1[1] * d);
    this.quadraticCurveTo(x1, y1, x1 + v2[0] * d, y1 + v2[1] * d);
  }

  fill(): void {
    this.fillPolys(this.paths.filter((p) => p.length >= 3), this.fillC);
  }

  stroke(): void {
    const w = this.lineWidth * this.unit();
    for (const p of this.paths) {
      for (let i = 0; i + 1 < p.length; i++) this.segment(p[i], p[i + 1], w, this.strokeC, i === 0, true);
      if (p.length === 1) this.segment(p[0], p[0], w, this.strokeC, true, true);
    }
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.fillPolys([[this.tp(x, y), this.tp(x + w, y), this.tp(x + w, y + h), this.tp(x, y + h)]], this.fillC);
  }

  /** Sets exactly one pixel at a transformed point (eyes, rivets, sparkles). */
  dot(x: number, y: number, hex: string): void {
    const [dx, dy] = this.tp(x, y);
    this.set(Math.floor(dx), Math.floor(dy), packHex(hex));
  }

  // --- raster -------------------------------------------------------------

  set(x: number, y: number, c: Packed): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.buf[y * this.w + x] = c;
  }

  get(x: number, y: number): Packed {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.buf[y * this.w + x];
  }

  private fillPolys(polys: Pt[][], c: Packed): void {
    if (polys.length === 0) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of polys) for (const [, y] of p) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.h - 1, Math.ceil(maxY));
    const xs: number[] = [];
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (const p of polys) {
        for (let i = 0; i < p.length; i++) {
          const [ax, ay] = p[i];
          const [bx, by] = p[(i + 1) % p.length];
          if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k] - 0.5));
        const xb = Math.min(this.w - 1, Math.floor(xs[k + 1] - 0.5));
        for (let x = xa; x <= xb; x++) this.buf[y * this.w + x] = c;
      }
    }
  }

  private segment(a: Pt, b: Pt, width: number, c: Packed, capStart: boolean, capEnd: boolean): void {
    if (width <= 1.4) {
      this.bresenham(a, b, c);
      return;
    }
    const r = width / 2;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 0.01) {
      const nx = (-(b[1] - a[1]) / len) * r;
      const ny = ((b[0] - a[0]) / len) * r;
      this.fillPolys([[[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]], c);
    }
    if (capStart) this.disc(a, r, c);
    if (capEnd) this.disc(b, r, c);
  }

  private disc([cx, cy]: Pt, r: number, c: Packed): void {
    const pts: Pt[] = [];
    const n = Math.max(8, Math.ceil(r * 6));
    for (let i = 0; i < n; i++) pts.push([cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r]);
    this.fillPolys([pts], c);
  }

  private bresenham([ax, ay]: Pt, [bx, by]: Pt, c: Packed): void {
    let x0 = Math.floor(ax);
    let y0 = Math.floor(ay);
    const x1 = Math.floor(bx);
    const y1 = Math.floor(by);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  // --- post effects -------------------------------------------------------

  /** Lit top edges and shaded bottom edges on the silhouette: an instant 3-tone look. */
  autoShade(light = 0.22, dark = 0.3): void {
    const src = this.buf.slice();
    const { w, h } = this;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = src[y * w + x];
        if (c === 0) continue;
        const up = y > 0 ? src[(y - 1) * w + x] : 0;
        const down = y < h - 1 ? src[(y + 1) * w + x] : 0;
        if (up === 0) this.buf[y * w + x] = shadePacked(c, light);
        else if (down === 0) this.buf[y * w + x] = shadePacked(c, -dark);
      }
    }
  }

  /** A one-pixel outline around everything drawn so far. */
  outline(hex: string): void {
    const c = packHex(hex);
    const src = this.buf.slice();
    const { w, h } = this;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (src[y * w + x] !== 0) continue;
        if (
          (x > 0 && src[y * w + x - 1] !== 0) ||
          (x < w - 1 && src[y * w + x + 1] !== 0) ||
          (y > 0 && src[(y - 1) * w + x] !== 0) ||
          (y < h - 1 && src[(y + 1) * w + x] !== 0)
        ) {
          this.buf[y * w + x] = c;
        }
      }
    }
  }

  /** Copies another painter's opaque pixels onto this one. */
  blit(src: Painter, dx: number, dy: number): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.buf[y * src.w + x];
        if (c !== 0) this.set(x + dx, y + dy, c);
      }
    }
  }

  toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const img = new ImageData(new Uint8ClampedArray(this.buf.buffer.slice(0)), this.w, this.h);
    c.getContext('2d')!.putImageData(img, 0, 0);
    return c;
  }

  /** Crops to the drawn pixels and returns a sprite anchored at (originX, originY). */
  toSprite(originX: number, originY: number): Sprite {
    let minX = this.w;
    let minY = this.h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.buf[y * this.w + x] === 0) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) {
      minX = minY = 0;
      maxX = maxY = 0;
    }
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const out = new Uint32Array(cw * ch);
    for (let y = 0; y < ch; y++) out.set(this.buf.subarray((y + minY) * this.w + minX, (y + minY) * this.w + minX + cw), y * cw);
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(out.buffer), cw, ch), 0, 0);
    return { canvas, ox: originX - minX, oy: originY - minY };
  }
}

function norm(x: number, y: number): Pt {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}
