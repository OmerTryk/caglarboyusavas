import { AGES, BASE_X, DOOM_START, POWER_RADIUS, WORLD_W, turretDef, unitDef } from '../sim/data';
import type { GameEvent, Projectile, Side, World } from '../sim/types';
import { stanceLine, turretHeight } from '../sim/world';
import { fmt, toAge } from '../ui/format';
import { ART, GROUND_A, GROUND_Y, LOW_H, LOW_W, VIEW_H, ax } from './art';
import { backgroundFor } from './background';
import { INK } from './pixel/color';
import { GOLD, team } from './palette';
import { FLAG_SPOT, baseSprite, damageLevel, hitTintOf, turretSprite } from './sprites/bases';
import { chuteSprite, cloudSprite, crateSprite, starSprite } from './sprites/misc';
import { flashOf, poseKeyFor, unitSprite } from './sprites/units';

type Ctx = CanvasRenderingContext2D;

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; g: number }
interface FloatText { x: number; y: number; text: string; color: string; life: number; max: number; size: number }
interface Ring { x: number; y: number; r: number; maxR: number; life: number; max: number; color: string }
interface Boom { x: number; y: number; r: number; life: number; max: number }
interface Corpse { img: HTMLCanvasElement; ox: number; oy: number; x: number; y: number; facing: 1 | -1; t: number }

export interface ViewState {
  /** The player picked the power and is choosing where to drop it. */
  targeting: boolean;
  /** Pointer x in world units, or null when off the canvas. */
  pointerX: number | null;
}

const LANE_DEPTH = 7;
const PIXEL_FONT = '"Pixelify Sans", "Courier New", monospace';

/**
 * Draws the battlefield into a small art-resolution canvas, then scales it up with
 * nearest-neighbour sampling so every sprite stays a crisp block of pixels.
 */
export class Renderer {
  private screen: Ctx;
  private low: HTMLCanvasElement;
  private l: Ctx;
  private mid: HTMLCanvasElement;
  private m: Ctx;
  private midK = 0;
  private dpr = 1;
  /** CSS pixels per world unit. */
  private scale = 1;
  private offX = 0;
  private offY = 0;
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private rings: Ring[] = [];
  private booms: Boom[] = [];
  private corpses: Corpse[] = [];
  /** Unit id → seconds left of the white hit flash, and of its cooldown so steady fire doesn't strobe. */
  private hitFlash = new Map<number, number>();
  private flashCool = new Map<number, number>();
  private lastDrawn = new Map<number, { img: HTMLCanvasElement; ox: number; oy: number; x: number; y: number; facing: 1 | -1; top: number }>();
  private shake = 0;
  private bgAge = 0;
  private prevBgAge = 0;
  private bgFade = 1;
  private baseFlash: [number, number] = [0, 0];
  private banner: { text: string; sub: string; t: number } | null = null;
  private clouds = Array.from({ length: 7 }, (_, i) => ({ x: i * 115, y: 34 + (i % 3) * 16, s: 0.7 + (i % 4) * 0.2, v: i % 3 }));
  private time = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.screen = canvas.getContext('2d')!;
    this.low = document.createElement('canvas');
    this.low.width = LOW_W;
    this.low.height = LOW_H;
    this.l = this.low.getContext('2d')!;
    this.mid = document.createElement('canvas');
    this.m = this.mid.getContext('2d')!;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    this.scale = Math.min(rect.width / WORLD_W, rect.height / VIEW_H);
    this.offX = (rect.width - WORLD_W * this.scale) / 2;
    this.offY = rect.height - VIEW_H * this.scale;
  }

  /** Converts a pointer clientX to a world x. */
  toWorldX(clientX: number): number {
    const rect = this.canvas.getBoundingClientRect();
    return (clientX - rect.left - this.offX) / this.scale;
  }

  frame(world: World, dt: number, view: ViewState): void {
    this.time += dt;
    this.consume(world);
    this.tickEffects(dt, world);

    const l = this.l;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.imageSmoothingEnabled = false;
    l.fillStyle = AGES[this.bgAge].palette.skyTop;
    l.fillRect(0, 0, LOW_W, LOW_H);
    const sx = this.shake > 0.5 ? Math.round((Math.random() * 2 - 1) * this.shake) : 0;
    const sy = this.shake > 0.5 ? Math.round((Math.random() * 2 - 1) * this.shake) : 0;
    l.translate(sx, sy);

    this.drawBackground(l);
    this.drawStanceLine(l, world);
    for (const p of world.players) this.drawBase(l, world, p.side);
    this.drawCrates(l, world);
    this.drawCorpses(l);
    this.drawUnits(l, world);
    this.drawProjectiles(l, world);
    this.drawBooms(l);
    this.drawParticles(l);
    this.drawRings(l);
    if (view.targeting && view.pointerX !== null) this.drawTargeting(l, view.pointerX);

    this.composite();

    const s = this.screen;
    s.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawTexts(s);
    const cw = this.canvas.width / this.dpr;
    const ch = this.canvas.height / this.dpr;
    if (world.time > DOOM_START) this.drawDoom(s, cw, ch, world.time);
    this.drawBanner(s, cw, ch);
  }

  // -------------------------------------------------------------------------
  // Compositing: nearest-neighbour up to an integer multiple, then one smooth
  // downscale. Pixels stay sharp without uneven widths at fractional sizes.
  // -------------------------------------------------------------------------

  private composite(): void {
    const s = this.screen;
    s.setTransform(1, 0, 0, 1, 0, 0);
    const px = (this.scale / ART) * this.dpr;
    const dx = Math.round(this.offX * this.dpr);
    const dy = Math.round(this.offY * this.dpr);
    const dw = Math.round(LOW_W * px);
    const dh = Math.round(LOW_H * px);

    // Letterbox: stretch the bare scenery's edge rows/columns outward so the margins match it
    // (the scenery, not the live frame, so clouds and effects never smear into the margins).
    s.imageSmoothingEnabled = false;
    const next = backgroundFor(this.bgAge);
    const prev = backgroundFor(this.prevBgAge);
    if (dy > 0) {
      if (this.bgFade < 1) s.drawImage(prev, 0, 0, LOW_W, 1, dx, 0, dw, dy);
      const cut = Math.max(1, Math.round(LOW_W * this.bgFade));
      s.drawImage(next, 0, 0, cut, 1, dx, 0, Math.round(cut * px), dy);
    }
    if (dx > 0) {
      s.drawImage(next, 0, 0, 1, LOW_H, 0, dy, dx, dh);
      s.drawImage(next, LOW_W - 1, 0, 1, LOW_H, dx + dw, dy, this.canvas.width - dx - dw, dh);
      if (dy > 0) {
        s.fillStyle = AGES[this.bgAge].palette.skyTop;
        s.fillRect(0, 0, dx, dy);
        s.fillRect(dx + dw, 0, this.canvas.width - dx - dw, dy);
      }
    }
    if (Math.abs(px - Math.round(px)) < 0.02 || px < 1) {
      s.imageSmoothingEnabled = false;
      s.drawImage(this.low, dx, dy, dw, dh);
      return;
    }
    const k = Math.ceil(px);
    if (k !== this.midK) {
      this.midK = k;
      this.mid.width = LOW_W * k;
      this.mid.height = LOW_H * k;
    }
    this.m.imageSmoothingEnabled = false;
    this.m.drawImage(this.low, 0, 0, LOW_W * k, LOW_H * k);
    s.imageSmoothingEnabled = true;
    s.imageSmoothingQuality = 'low';
    s.drawImage(this.mid, dx, dy, dw, dh);
  }

  /** Art pixel → CSS pixel. */
  private toScreen(x: number, y: number): [number, number] {
    const k = this.scale / ART;
    return [this.offX + x * k, this.offY + y * k];
  }

  // -------------------------------------------------------------------------
  // Events and effects
  // -------------------------------------------------------------------------

  private consume(world: World): void {
    for (const e of world.events) this.onEvent(e, world);
    world.events.length = 0;
    // The scenery follows the player's age; a restart fades back to the first age.
    const age = world.players[0].age;
    if (age !== this.bgAge) {
      this.prevBgAge = this.bgFade < 1 ? this.prevBgAge : this.bgAge;
      this.bgAge = age;
      this.bgFade = 0;
    }
  }

  private onEvent(e: GameEvent, world: World): void {
    switch (e.t) {
      case 'hit': {
        const at = this.lastDrawn.get(e.unitId);
        const x = ax(e.x);
        const y = at ? Math.round((at.y + at.top) / 2) : GROUND_A - 12;
        if (!this.flashCool.has(e.unitId)) {
          this.hitFlash.set(e.unitId, 0.06);
          this.flashCool.set(e.unitId, 0.35);
        }
        this.burst(x, y, 2, '#fff4e0', 40, 1);
        if (e.counter) this.text(x, (at?.top ?? y) - 4, `${fmt(e.amount)}!`, '#ffd93f', 13);
        break;
      }
      case 'death': {
        const tc = team(e.side);
        const def = unitDef(e.defId);
        const x = ax(e.x);
        const drawn = this.lastDrawn.get(e.unitId);
        if (drawn) this.corpses.push({ img: drawn.img, ox: drawn.ox, oy: drawn.oy, x: drawn.x, y: drawn.y, facing: drawn.facing, t: 0 });
        this.lastDrawn.delete(e.unitId);
        this.burst(x, GROUND_A - Math.round(def.height * ART * 0.45), 8, tc.main, 70, 1);
        this.burst(x, GROUND_A - 2, 5, AGES[def.age].palette.groundDark, 40, 1);
        if (e.side === 1) this.text(x, GROUND_A - Math.round(def.height * ART) - 6, `+${fmt(e.bounty)}`, GOLD, 13);
        if (def.mount) this.shake = Math.max(this.shake, 1.5);
        break;
      }
      case 'boom': {
        const x = ax(e.x);
        const y = GROUND_A - Math.round(e.y * ART) - 3;
        const r = Math.max(5, Math.round(e.r * ART * 0.55));
        this.booms.push({ x, y, r, life: 0, max: 0.5 });
        this.burst(x, y, 6, '#ffb347', 90, 1);
        this.burst(x, y, 4, '#4a4a4a', 60, 2);
        this.shake = Math.max(this.shake, 2);
        break;
      }
      case 'baseHit':
        this.baseFlash[e.side] = 0.08;
        break;
      case 'ageUp': {
        const name = AGES[e.age].name;
        this.banner = e.side === 0
          ? { text: name.toLocaleUpperCase('tr-TR'), sub: 'Yeni birimler, yeni kuleler, yeni güç!', t: 0 }
          : { text: `Düşman ${toAge(name)} geçti`, sub: 'Dikkatli ol!', t: 0 };
        break;
      }
      case 'shock':
        this.rings.push({ x: ax(BASE_X[e.side]), y: GROUND_A - 4, r: 8, maxR: 150, life: 0, max: 0.7, color: '#ffffff' });
        this.shake = Math.max(this.shake, 5);
        break;
      case 'crate':
        this.text(ax(e.x), GROUND_A - 30, `Erzak +${fmt(e.amount)}`, e.side === 0 ? GOLD : '#ff9d92', 15);
        this.burst(ax(e.x), GROUND_A - 6, 12, GOLD, 80, 1);
        break;
      case 'rankUp':
        this.text(ax(e.x), GROUND_A - 46, e.rank === 2 ? '★★ Efsane!' : '★ Terfi!', GOLD, 13);
        break;
      case 'rally':
        for (const u of world.units) if (u.side === e.side) this.burst(ax(u.x), GROUND_A - 10, 3, GOLD, 40, 1);
        break;
      case 'power':
        break;
    }
  }

  private burst(x: number, y: number, n: number, color: string, speed: number, size: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.4, life: 0, max: 0.35 + Math.random() * 0.45, color, size: size + (Math.random() < 0.3 ? 1 : 0), g: 210 });
    }
  }

  private text(x: number, y: number, text: string, color: string, size: number): void {
    this.texts.push({ x, y, text, color, life: 0, max: 1.1, size });
  }

  private tickEffects(dt: number, world: World): void {
    for (const p of this.particles) {
      p.life += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y = Math.min(GROUND_A + 4, p.y + p.vy * dt);
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const t of this.texts) {
      t.life += dt;
      t.y -= 16 * dt;
    }
    this.texts = this.texts.filter((t) => t.life < t.max);
    for (const r of this.rings) r.life += dt;
    this.rings = this.rings.filter((r) => r.life < r.max);
    for (const b of this.booms) b.life += dt;
    this.booms = this.booms.filter((b) => b.life < b.max);
    for (const c of this.corpses) c.t += dt;
    this.corpses = this.corpses.filter((c) => c.t < 1.3);
    for (const timers of [this.hitFlash, this.flashCool]) {
      for (const [id, t] of timers) {
        if (t - dt <= 0) timers.delete(id);
        else timers.set(id, t - dt);
      }
    }
    this.shake = Math.max(0, this.shake - dt * 14);
    this.baseFlash = [Math.max(0, this.baseFlash[0] - dt), Math.max(0, this.baseFlash[1] - dt)];
    this.bgFade = Math.min(1, this.bgFade + dt / 1.2);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > 2.6) this.banner = null;
    }
    for (const c of this.clouds) {
      c.x += dt * 4 * c.s;
      if (c.x > LOW_W + 40) c.x = -60;
    }

    // Damaged bases smoke and burn.
    for (const p of world.players) {
      const ratio = p.hp / p.maxHp;
      if (ratio < 0.5 && Math.random() < dt * (ratio < 0.25 ? 14 : 5)) {
        const x = ax(BASE_X[p.side]) + Math.round((Math.random() * 2 - 1) * 25);
        const fire = ratio < 0.25 && Math.random() < 0.5;
        this.particles.push({ x, y: GROUND_A - 40 - Math.random() * 30, vx: (Math.random() - 0.5) * 8, vy: -18, life: 0, max: 1.6, color: fire ? '#ff8a3d' : '#5a5a5a', size: fire ? 2 : 3, g: -4 });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Scene
  // -------------------------------------------------------------------------

  private drawBackground(l: Ctx): void {
    const next = backgroundFor(this.bgAge);
    if (this.bgFade < 1) {
      // Pixel wipe from the player's side toward the enemy.
      l.drawImage(backgroundFor(this.prevBgAge), 0, 0);
      const cut = Math.round(LOW_W * this.bgFade);
      for (let y = 0; y < LOW_H; y += 4) {
        const jag = (y * 7) % 12;
        l.drawImage(next, 0, y, cut + jag, 4, 0, y, cut + jag, 4);
      }
    } else {
      l.drawImage(next, 0, 0);
    }
    const future = AGES[this.bgAge].baseStyle === 'dome';
    for (const c of this.clouds) {
      const s = cloudSprite(c.v, future);
      l.drawImage(s.canvas, Math.round(c.x) - s.ox, c.y - s.oy);
    }
  }

  private drawStanceLine(l: Ctx, world: World): void {
    const x = stanceLine(0, world.players[0].stance);
    if (x === null) return;
    const px = ax(x);
    l.fillStyle = '#8ab8ff';
    for (let y = GROUND_A - 58; y < GROUND_A + 8; y += 4) l.fillRect(px, y, 1, 2);
    l.fillStyle = INK;
    l.fillRect(px, GROUND_A - 61, 10, 7);
    l.fillStyle = team(0).main;
    l.fillRect(px + 1, GROUND_A - 60, 8, 5);
  }

  private drawBase(l: Ctx, world: World, side: Side): void {
    const p = world.players[side];
    const d = side === 0 ? 1 : -1;
    const bx = BASE_X[side];
    const sprite = baseSprite(p.age, p.slots.length, damageLevel(p.hp / p.maxHp));
    const img = this.baseFlash[side] > 0 ? hitTintOf(sprite) : sprite.canvas;
    drawImg(l, img, sprite.ox, sprite.oy, ax(bx), GROUND_A, d);

    // Waving flag.
    const style = AGES[p.age].baseStyle;
    const [fx, roof] = FLAG_SPOT[style];
    const poleX = ax(bx + d * fx);
    const roofY = GROUND_A + Math.round(roof * ART);
    const top = roofY - 24;
    l.fillStyle = INK;
    l.fillRect(poleX - 1, top - 1, 3, 25);
    l.fillStyle = '#8a6a44';
    l.fillRect(poleX, top, 1, 24);
    const tc = team(side);
    for (let c = 0; c < 11; c++) {
      const col = poleX - d * (c + 1);
      const wave = Math.round(Math.sin(this.time * 6 - c * 0.55) * 1.2);
      l.fillStyle = INK;
      l.fillRect(col, top + wave, 1, 8);
      l.fillStyle = c === 10 ? tc.dark : tc.main;
      l.fillRect(col, top + 1 + wave, 1, 6);
      l.fillStyle = tc.light;
      l.fillRect(col, top + 1 + wave, 1, 1);
    }

    // Flickering fire inside the cave mouth.
    if (style === 'cave' && Math.random() < 0.5) {
      l.fillStyle = Math.random() < 0.5 ? '#ffd36b' : '#ff8a2a';
      l.fillRect(ax(bx + d * 42) + Math.round(Math.random() * 4 - 2), GROUND_A - 9 - Math.round(Math.random() * 3), 1, 2);
    }

    p.slots.forEach((t, i) => {
      if (!t) return;
      const def = turretDef(t.defId);
      const tx = bx + d * 14;
      const h = turretHeight(i);
      const ang = Math.atan2(h - 30, (t.aimX - tx) * d);
      const s = turretSprite(def, ang);
      drawImg(l, s.canvas, s.ox, s.oy, ax(tx), GROUND_A - Math.round(h * ART), d);
    });
  }

  private drawCrates(l: Ctx, world: World): void {
    const crate = crateSprite();
    const chute = chuteSprite();
    for (const c of world.crates) {
      const sway = c.fall > 0 ? Math.round(Math.sin(world.time * 2 + c.id) * 3) : 0;
      const x = ax(c.x) + sway;
      const y = GROUND_A - 1 - Math.round((c.fall / 2.5) * 130);
      if (c.fall > 0) l.drawImage(chute.canvas, x - chute.ox, y - 11 - chute.oy);
      l.drawImage(crate.canvas, x - crate.ox, y - crate.oy);
    }
  }

  private drawCorpses(l: Ctx): void {
    for (const c of this.corpses) {
      if (c.t > 0.8 && Math.floor(c.t * 16) % 2 === 0) continue;
      const k = Math.min(1, c.t / 0.28);
      const ang = -c.facing * k * (Math.PI / 2) * 0.95;
      l.save();
      l.translate(c.x, c.y);
      l.rotate(ang);
      if (c.facing === -1) l.scale(-1, 1);
      l.globalAlpha = 0.85;
      l.drawImage(c.img, -c.ox, -c.oy);
      l.restore();
    }
    l.globalAlpha = 1;
  }

  private drawUnits(l: Ctx, world: World): void {
    const sorted = [...world.units].sort((a, b) => a.lane - b.lane);
    const star = starSprite();
    const seen = new Set<number>();
    for (const u of sorted) {
      seen.add(u.id);
      const def = unitDef(u.defId);
      const d: 1 | -1 = u.side === 0 ? 1 : -1;
      const facing: 1 | -1 = u.state === 'back' ? (-d as 1 | -1) : d;
      const x = ax(u.x);
      const y = Math.round(GROUND_A + u.lane * LANE_DEPTH - LANE_DEPTH / 2);
      const halfW = Math.max(4, Math.round(def.width * ART * 0.55));

      l.fillStyle = 'rgba(20,12,28,0.28)';
      l.fillRect(x - halfW, y, halfW * 2, 1);
      l.fillRect(x - halfW + 2, y + 1, halfW * 2 - 4, 1);
      if (world.players[u.side].rallyT > 0) {
        l.fillStyle = GOLD;
        for (let i = -halfW - 1; i <= halfW + 1; i += 2) {
          l.fillRect(x + i, y - 2, 1, 1);
          l.fillRect(x + i + 1, y + 2, 1, 1);
        }
      }

      const sprite = unitSprite(def, u.side, poseKeyFor(u.state, u.walkT, u.atkT, def));
      const img = this.hitFlash.has(u.id) ? flashOf(sprite) : sprite.canvas;
      drawImg(l, img, sprite.ox, sprite.oy, x, y, facing);
      const top = y - Math.round(def.height * ART) - 3;
      this.lastDrawn.set(u.id, { img: sprite.canvas, ox: sprite.ox, oy: sprite.oy, x, y, facing, top });

      if (u.hp < u.maxHp) {
        const w = Math.max(8, Math.round(def.width * ART * 0.8));
        l.fillStyle = INK;
        l.fillRect(x - Math.floor(w / 2) - 1, top - 1, w + 2, 4);
        l.fillStyle = u.side === 0 ? '#5ee07a' : '#ff6b5e';
        l.fillRect(x - Math.floor(w / 2), top, Math.max(1, Math.round(w * Math.max(0, u.hp / u.maxHp))), 2);
      }
      for (let i = 0; i < u.rank; i++) {
        l.drawImage(star.canvas, x + Math.round((i - (u.rank - 1) / 2) * 7) - star.ox, top - 6 - star.oy);
      }
    }
    for (const id of this.lastDrawn.keys()) if (!seen.has(id)) this.lastDrawn.delete(id);
  }

  private drawProjectiles(l: Ctx, world: World): void {
    for (const pr of world.projectiles) {
      if (pr.t < 0) continue;
      const [wx, wy, ang] = projectilePos(pr);
      const x = Math.round(wx * ART);
      const y = Math.round(wy * ART);
      drawProjectile(l, pr, x, y, ang);
      if ((pr.kind === 'rocket' || pr.kind === 'fire' || pr.sky) && Math.random() < 0.6) {
        const color = pr.kind === 'laser' ? '#5ef0ff' : pr.kind === 'fire' || pr.kind === 'rocket' ? '#ffb347' : '#8a8a8a';
        this.particles.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.3, color, size: 1, g: -12 });
      }
    }
  }

  private drawBooms(l: Ctx): void {
    for (const b of this.booms) {
      const k = b.life / b.max;
      if (k < 0.18) {
        disc(l, b.x, b.y, Math.round(b.r * (0.5 + k)), '#ffffff');
      } else if (k < 0.55) {
        disc(l, b.x, b.y, Math.round(b.r * (0.75 + k * 0.4)), '#ff8a2a');
        disc(l, b.x, b.y, Math.round(b.r * (0.45 + k * 0.3)), '#ffe28a');
      } else {
        disc(l, b.x, b.y - Math.round((k - 0.55) * 10), Math.round(b.r * 0.9), '#5a5a5a', k > 0.75);
      }
    }
  }

  private drawParticles(l: Ctx): void {
    for (const p of this.particles) {
      if (p.life / p.max > 0.7 && Math.floor(p.life * 30) % 2 === 0) continue;
      l.fillStyle = p.color;
      l.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
  }

  private drawRings(l: Ctx): void {
    for (const r of this.rings) {
      const k = r.life / r.max;
      const rx = r.r + (r.maxR - r.r) * k;
      const ry = rx * 0.3;
      l.fillStyle = r.color;
      const n = Math.ceil(rx * 2.4);
      const thick = k < 0.5 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        if (k > 0.6 && i % 2 === 0) continue;
        const a = (i / n) * Math.PI * 2;
        l.fillRect(Math.round(r.x + Math.cos(a) * rx), Math.round(r.y + Math.sin(a) * ry), thick, thick);
      }
    }
  }

  private drawTargeting(l: Ctx, worldX: number): void {
    const x = ax(worldX);
    const rx = Math.round(POWER_RADIUS * ART);
    const n = rx * 3;
    const off = Math.floor(this.time * 12);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      l.fillStyle = (i + off) % 6 < 3 ? '#ff5a3c' : '#ffd36b';
      l.fillRect(Math.round(x + Math.cos(a) * rx), Math.round(GROUND_A + 2 + Math.sin(a) * 10), 1, 1);
    }
    l.fillStyle = '#ff5a3c';
    for (let y = GROUND_A - 120; y < GROUND_A; y += 4) l.fillRect(x, y + (off % 4), 1, 2);
  }

  // -------------------------------------------------------------------------
  // Screen-space overlays
  // -------------------------------------------------------------------------

  private drawTexts(s: Ctx): void {
    s.textAlign = 'center';
    s.textBaseline = 'alphabetic';
    for (const t of this.texts) {
      const k = t.life / t.max;
      if (k > 0.75 && Math.floor(t.life * 20) % 2 === 0) continue;
      const [x, y] = this.toScreen(t.x, t.y);
      const size = Math.round(t.size * Math.max(0.85, Math.min(1.4, this.scale * 1.4)));
      s.font = `700 ${size}px ${PIXEL_FONT}`;
      pixelText(s, t.text, x, y, t.color, 2);
    }
  }

  private drawDoom(s: Ctx, cw: number, ch: number, time: number): void {
    const a = 0.18 + Math.sin(time * 3) * 0.06;
    const g = s.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
    g.addColorStop(0, 'rgba(160,0,0,0)');
    g.addColorStop(1, `rgba(160,0,0,${a})`);
    s.fillStyle = g;
    s.fillRect(0, 0, cw, ch);
  }

  private drawBanner(s: Ctx, cw: number, ch: number): void {
    if (!this.banner) return;
    const { text, sub, t } = this.banner;
    if (t > 2 && Math.floor(t * 12) % 2 === 0) return;
    const appear = Math.min(1, t / 0.2);
    const size = Math.round(Math.min(56, cw / 13) * (0.7 + appear * 0.3));
    const y = Math.round(ch * 0.3);
    s.textAlign = 'center';
    s.textBaseline = 'middle';
    s.font = `700 ${size}px ${PIXEL_FONT}`;
    pixelText(s, text, cw / 2, y, '#ffe08a', Math.max(3, Math.round(size / 12)));
    s.font = `600 ${Math.max(14, Math.round(size * 0.34))}px ${PIXEL_FONT}`;
    pixelText(s, sub, cw / 2, y + size * 0.8, '#ffffff', 2);
  }
}

// ---------------------------------------------------------------------------

/** Draws a sprite at an art-pixel position, mirrored when facing left. */
function drawImg(l: Ctx, img: HTMLCanvasElement, ox: number, oy: number, x: number, y: number, facing: 1 | -1): void {
  if (facing === 1) {
    l.drawImage(img, x - ox, y - oy);
    return;
  }
  l.save();
  l.translate(x + 1, 0);
  l.scale(-1, 1);
  l.drawImage(img, -ox, y - oy);
  l.restore();
}

/** Hard-edged filled circle; `dither` drops every other pixel for a see-through look. */
function disc(l: Ctx, cx: number, cy: number, r: number, color: string, dither = false): void {
  l.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    if (!dither) {
      l.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
      continue;
    }
    for (let dx = -half; dx <= half; dx++) if (((dx + dy) & 1) === 0) l.fillRect(cx + dx, cy + dy, 1, 1);
  }
}

/** Text with a blocky dark outline instead of a soft stroke. */
function pixelText(s: Ctx, text: string, x: number, y: number, color: string, o: number): void {
  s.fillStyle = INK;
  for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, -o], [-o, o], [o, o]]) s.fillText(text, x + dx, y + dy);
  s.fillText(text, x + o, y + o * 1.5);
  s.fillStyle = color;
  s.fillText(text, x, y);
}

function linePix(l: Ctx, x: number, y: number, ang: number, from: number, to: number, color: string): void {
  l.fillStyle = color;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  for (let i = from; i <= to; i++) l.fillRect(Math.round(x + c * i), Math.round(y + s * i), 1, 1);
}

const ARC: Partial<Record<Projectile['kind'], number>> = { rock: 0.28, ball: 0.22, fire: 0.26, arrow: 0.12, rocket: 0.05 };

/** World-space position and heading of a projectile. */
function projectilePos(pr: Projectile): [number, number, number] {
  const at = (k: number): [number, number] => {
    if (pr.sky) return [pr.fromX + (pr.toX - pr.fromX) * k, GROUND_Y - pr.fromY * (1 - k)];
    const x = pr.fromX + (pr.toX - pr.fromX) * k;
    const h = pr.fromY * (1 - k) + 22 * k;
    const arc = Math.abs(pr.toX - pr.fromX) * (ARC[pr.kind] ?? 0) * 4 * k * (1 - k);
    return [x, GROUND_Y - h - arc];
  };
  const k = Math.min(1, pr.t / pr.dur);
  const [x, y] = at(k);
  const [x2, y2] = at(Math.min(1, k + 0.03));
  return [x, y, Math.atan2(y2 - y, x2 - x || 0.0001)];
}

function drawProjectile(l: Ctx, pr: Projectile, x: number, y: number, ang: number): void {
  const big = pr.sky ? 2 : 1;
  switch (pr.kind) {
    case 'rock':
      disc(l, x, y, big + (pr.splash > 0 ? 1 : 0), INK);
      disc(l, x, y, big + (pr.splash > 0 ? 1 : 0) - 1, '#9a9a9a');
      l.fillStyle = '#d0d0d0';
      l.fillRect(x - 1, y - 1, 1, 1);
      break;
    case 'arrow':
      linePix(l, x, y, ang, -3 * big, 2 * big, '#6b4a22');
      linePix(l, x, y, ang, 2 * big, 3 * big, '#e0e0e0');
      break;
    case 'bullet':
      linePix(l, x, y, ang, -3, 0, '#ffe28a');
      break;
    case 'ball':
      disc(l, x, y, 1 + big, INK);
      l.fillStyle = '#6b6b6b';
      l.fillRect(x - 1, y - 1, 1, 1);
      break;
    case 'fire':
      disc(l, x, y, 1 + big, '#ff7a1a');
      l.fillStyle = '#ffe28a';
      l.fillRect(x, y, 1, 1);
      break;
    case 'rocket':
      linePix(l, x, y, ang, -3 * big, 1 * big, '#9aa0a6');
      linePix(l, x, y, ang, 2 * big, 2 * big, '#d6403a');
      break;
    case 'laser':
      linePix(l, x, y, ang, -6 * big, 1, '#5ef0ff');
      linePix(l, x, y, ang, -3 * big, 1, '#ffffff');
      break;
    case 'none':
      break;
  }
}
