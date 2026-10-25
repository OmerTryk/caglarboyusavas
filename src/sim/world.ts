import {
  AGES, BASE_HALF, BASE_HP, BASE_X, DOOM_PER_MIN, DOOM_START, HOLD_LINE, MAX_QUEUE, PASSIVE_INCOME, POWER_COOLDOWN, POWER_DAMAGE,
  POWER_MULT, POWER_RADIUS, POWER_SHOTS, RALLY_COOLDOWN, RALLY_DAMAGE, RALLY_DURATION, RALLY_SPEED,
  RANK_KILLS, RANK_MULT, RETREAT_LINE, SHOCK_PUSH, SIEGE_MULT, SHOCK_RANGE, SLOT_COSTS, START_GOLD, WORLD_W,
  ageScale, counterMult, turretDef, unitDef,
} from './data';
import { rand } from './rng';
import type { Command, Player, Role, Side, Stance, Unit, UnitDef, World } from './types';

/** Projectile.targetId value meaning "the enemy base". */
export const BASE_TARGET = -1;

const SPACING = 0.55;

export function dir(side: Side): 1 | -1 {
  return side === 0 ? 1 : -1;
}

export function foeOf(side: Side): Side {
  return side === 0 ? 1 : 0;
}

/** The x of a base's outer wall, where enemies stop and hit it. */
export function baseFront(side: Side): number {
  return BASE_X[side] + dir(side) * BASE_HALF;
}

function newPlayer(side: Side, incomeMult: number): Player {
  return {
    side,
    gold: START_GOLD,
    xp: 0,
    age: 0,
    hp: BASE_HP,
    maxHp: BASE_HP,
    slots: [null],
    queue: [],
    stance: 'saldir',
    powerCd: 15,
    rallyCd: 8,
    rallyT: 0,
    incomeMult,
    stats: { kills: 0, lost: 0, trained: 0, goldEarned: 0, cratesTaken: 0 },
  };
}

export function createWorld(seed: number, incomeMult: [number, number] = [1, 1]): World {
  return {
    time: 0,
    tick: 0,
    players: [newPlayer(0, incomeMult[0]), newPlayer(1, incomeMult[1])],
    units: [],
    projectiles: [],
    crates: [],
    nextCrateIn: 30,
    seed: seed | 0,
    nextId: 1,
    winner: null,
    events: [],
  };
}

export function canAgeUp(p: Player): boolean {
  const next = AGES[p.age + 1];
  return next !== undefined && p.xp >= next.xpRequired;
}

export function nextSlotCost(p: Player): number | null {
  return p.slots.length < SLOT_COSTS.length ? SLOT_COSTS[p.slots.length] : null;
}

export function stanceLine(side: Side, stance: Stance): number | null {
  if (stance === 'saldir') return null;
  const span = BASE_X[1] - BASE_X[0];
  const dist = stance === 'tut' ? span * HOLD_LINE : RETREAT_LINE;
  return BASE_X[side] + dir(side) * dist;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export function issue(world: World, side: Side, cmd: Command): boolean {
  if (world.winner !== null) return false;
  const p = world.players[side];
  switch (cmd.type) {
    case 'train': {
      const def = unitDef(cmd.unitId);
      if (def.age !== p.age || p.queue.length >= MAX_QUEUE || p.gold < def.cost) return false;
      p.gold -= def.cost;
      p.queue.push({ unitId: def.id, progress: 0 });
      return true;
    }
    case 'buyTurret': {
      const def = turretDef(cmd.turretId);
      const slot = p.slots.indexOf(null);
      if (def.age > p.age || slot < 0 || p.gold < def.cost) return false;
      p.gold -= def.cost;
      p.slots[slot] = { defId: def.id, cd: 0.5, aimX: BASE_X[foeOf(side)] };
      return true;
    }
    case 'sellTurret': {
      const t = p.slots[cmd.slot];
      if (!t) return false;
      p.gold += Math.round(turretDef(t.defId).cost * 0.5);
      p.slots[cmd.slot] = null;
      return true;
    }
    case 'buySlot': {
      const cost = nextSlotCost(p);
      if (cost === null || p.gold < cost) return false;
      p.gold -= cost;
      p.slots.push(null);
      return true;
    }
    case 'ageUp': {
      if (!canAgeUp(p)) return false;
      ageUp(world, p);
      return true;
    }
    case 'stance': {
      p.stance = cmd.stance;
      return true;
    }
    case 'power': {
      if (p.powerCd > 0) return false;
      const x = clamp(cmd.x, BASE_X[0] + 40, BASE_X[1] - 40);
      const dmg = POWER_DAMAGE * ageScale(p.age).power;
      const kind = AGES[p.age].powerProjectile;
      for (let i = 0; i < POWER_SHOTS; i++) {
        const tx = clamp(x + (rand(world) * 2 - 1) * POWER_RADIUS, 0, WORLD_W);
        world.projectiles.push({
          id: world.nextId++, side, kind, fromX: tx - dir(side) * 120, fromY: 700, toX: tx,
          targetId: null, attackerId: null, attackerRole: null, damage: dmg, splash: 48,
          t: -i * 0.11 - rand(world) * 0.08, dur: 0.75, sky: true,
        });
      }
      p.powerCd = POWER_COOLDOWN;
      world.events.push({ t: 'power', side, x });
      return true;
    }
    case 'rally': {
      if (p.rallyCd > 0) return false;
      p.rallyT = RALLY_DURATION;
      p.rallyCd = RALLY_COOLDOWN;
      world.events.push({ t: 'rally', side });
      return true;
    }
  }
}

function ageUp(world: World, p: Player): void {
  p.age += 1;
  const ratio = p.hp / p.maxHp;
  p.maxHp = Math.round(BASE_HP * Math.pow(POWER_MULT, p.age));
  p.hp = Math.min(p.maxHp, ratio * p.maxHp + p.maxHp * 0.1);
  world.events.push({ t: 'ageUp', side: p.side, age: p.age });

  // Shockwave: the new age arrives with a bang that shoves nearby enemies back.
  const d = dir(p.side);
  for (const e of world.units) {
    if (e.side === p.side || e.hp <= 0) continue;
    if (Math.abs(e.x - BASE_X[p.side]) > SHOCK_RANGE) continue;
    e.x = clamp(e.x + d * SHOCK_PUSH, BASE_X[0], BASE_X[1]);
    damageUnit(world, e, e.maxHp * 0.1, null, null);
  }
  world.events.push({ t: 'shock', side: p.side });
}

// ---------------------------------------------------------------------------
// Simulation step
// ---------------------------------------------------------------------------

export function step(world: World, dt: number): void {
  if (world.winner !== null) return;
  world.time += dt;
  world.tick += 1;

  for (const p of world.players) {
    p.powerCd = Math.max(0, p.powerCd - dt);
    p.rallyCd = Math.max(0, p.rallyCd - dt);
    p.rallyT = Math.max(0, p.rallyT - dt);
    const income = PASSIVE_INCOME * ageScale(p.age).cost * p.incomeMult * dt;
    p.gold += income;
    p.stats.goldEarned += income;
    produce(world, p, dt);
  }

  updateUnits(world, dt);
  updateTurrets(world, dt);
  updateProjectiles(world, dt);
  updateCrates(world, dt);

  world.units = world.units.filter((u) => u.hp > 0);
}

function produce(world: World, p: Player, dt: number): void {
  const item = p.queue[0];
  if (!item) return;
  const def = unitDef(item.unitId);
  item.progress = Math.min(def.buildTime, item.progress + dt);
  if (item.progress < def.buildTime) return;

  const x = BASE_X[p.side] + dir(p.side) * (BASE_HALF - 10);
  for (const a of world.units) {
    if (a.side !== p.side || a.hp <= 0) continue;
    if (Math.abs(a.x - x) < ((unitDef(a.defId).width + def.width) / 2) * SPACING) return;
  }
  p.queue.shift();
  p.stats.trained += 1;
  world.units.push({
    id: world.nextId++, side: p.side, defId: def.id, x, hp: def.hp, maxHp: def.hp,
    cd: 0.3, kills: 0, rank: 0, lane: rand(world), state: 'walk', atkT: 9, walkT: 0,
  });
}

type Target = { kind: 'unit'; unit: Unit } | { kind: 'base' };

function findTarget(world: World, u: Unit, def: UnitDef): Target | null {
  const d = dir(u.side);
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const e of world.units) {
    if (e.side === u.side || e.hp <= 0) continue;
    const ew = unitDef(e.defId).width / 2;
    const dist = (e.x - u.x) * d;
    if (dist < -ew - 6) continue;
    if (dist - ew > def.range) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = e;
    }
  }
  if (best) return { kind: 'unit', unit: best };
  const toBase = (baseFront(foeOf(u.side)) - u.x) * d;
  if (toBase <= def.range) return { kind: 'base' };
  return null;
}

function isBlocked(world: World, u: Unit, def: UnitDef): boolean {
  const d = dir(u.side);
  for (const o of world.units) {
    if (o === u || o.hp <= 0) continue;
    const gap = (o.x - u.x) * d;
    const ow = unitDef(o.defId).width;
    if (o.side === u.side) {
      if (o.state === 'back') continue;
      const ahead = gap > 0 || (gap === 0 && o.id < u.id);
      if (ahead && gap < ((ow + def.width) / 2) * SPACING) return true;
    } else if (gap > -6 && gap < ((ow + def.width) / 2) * 0.6) {
      return true;
    }
  }
  return (baseFront(foeOf(u.side)) - u.x) * d <= def.width / 2;
}

function updateUnits(world: World, dt: number): void {
  for (const u of world.units) {
    if (u.hp <= 0) continue;
    const def = unitDef(u.defId);
    const p = world.players[u.side];
    const d = dir(u.side);
    const rally = p.rallyT > 0;
    const speed = def.speed * (rally ? RALLY_SPEED : 1);
    u.cd -= dt;
    u.atkT += dt;

    const line = stanceLine(u.side, p.stance);
    const pastLine = line === null ? -Infinity : (u.x - line) * d;
    if (pastLine > 4) {
      u.state = 'back';
      u.x -= d * speed * 0.9 * dt;
      u.walkT += dt;
      continue;
    }

    const target = findTarget(world, u, def);
    if (target) {
      u.state = 'attack';
      if (u.cd <= 0) {
        attack(world, u, def, target, RANK_MULT[u.rank] * (rally ? RALLY_DAMAGE : 1));
        u.cd = def.attackInterval;
        u.atkT = 0;
      }
      continue;
    }

    if (pastLine > -4 || isBlocked(world, u, def)) {
      u.state = 'idle';
      continue;
    }
    u.state = 'walk';
    u.x += d * speed * dt;
    u.walkT += dt;
  }
}

function attack(world: World, u: Unit, def: UnitDef, target: Target, mult: number): void {
  const dmg = def.damage * mult;
  const d = dir(u.side);
  const tx = target.kind === 'unit' ? target.unit.x : baseFront(foeOf(u.side));
  if (def.projectile === 'none') {
    if (target.kind === 'base') {
      damageBase(world, foeOf(u.side), dmg);
      return;
    }
    damageUnit(world, target.unit, dmg, def.role, u.id);
    if (def.splash > 0) splashAround(world, u.side, tx, def.splash, dmg * 0.5, def.role, u.id, target.unit.id);
    return;
  }
  const fromX = u.x + (d * def.width) / 2;
  world.projectiles.push({
    id: world.nextId++, side: u.side, kind: def.projectile, fromX, fromY: def.height * 0.72, toX: tx,
    targetId: target.kind === 'unit' ? target.unit.id : BASE_TARGET, attackerId: u.id, attackerRole: def.role,
    damage: dmg, splash: def.splash, t: 0, dur: Math.max(0.06, Math.abs(tx - fromX) / def.projectileSpeed), sky: false,
  });
}

function updateTurrets(world: World, dt: number): void {
  for (const p of world.players) {
    const bx = BASE_X[p.side];
    p.slots.forEach((t, i) => {
      if (!t) return;
      const def = turretDef(t.defId);
      t.cd -= dt;
      let best: Unit | null = null;
      let bestDist = Infinity;
      for (const e of world.units) {
        if (e.side === p.side || e.hp <= 0) continue;
        const dist = Math.abs(e.x - bx);
        if (dist <= def.range && dist < bestDist) {
          bestDist = dist;
          best = e;
        }
      }
      if (!best) return;
      t.aimX = best.x;
      if (t.cd > 0) return;
      t.cd = def.interval;
      const fromX = bx + dir(p.side) * 14;
      world.projectiles.push({
        id: world.nextId++, side: p.side, kind: def.projectile, fromX, fromY: turretHeight(i), toX: best.x,
        targetId: best.id, attackerId: null, attackerRole: null, damage: def.damage, splash: def.splash,
        t: 0, dur: Math.max(0.1, Math.hypot(best.x - fromX, turretHeight(i)) / def.projectileSpeed), sky: false,
      });
    });
  }
}

/** Height above ground of turret slot i; shared with the renderer. */
export function turretHeight(slot: number): number {
  return 150 + slot * 34;
}

function updateProjectiles(world: World, dt: number): void {
  const live = [];
  for (const pr of world.projectiles) {
    pr.t += dt;
    const target = pr.targetId !== null && pr.targetId !== BASE_TARGET ? findUnit(world, pr.targetId) : null;
    if (target) pr.toX = target.x;
    if (pr.t < pr.dur) {
      live.push(pr);
      continue;
    }
    if (pr.sky) {
      splashAround(world, pr.side, pr.toX, pr.splash, pr.damage, null, null, null);
      world.events.push({ t: 'boom', x: pr.toX, y: 0, r: pr.splash });
      continue;
    }
    if (pr.targetId === BASE_TARGET) {
      damageBase(world, foeOf(pr.side), pr.damage);
      if (pr.splash > 0) world.events.push({ t: 'boom', x: pr.toX, y: 30, r: pr.splash });
      continue;
    }
    if (target) damageUnit(world, target, pr.damage, pr.attackerRole, pr.attackerId);
    if (pr.splash > 0) {
      splashAround(world, pr.side, pr.toX, pr.splash, pr.damage * 0.6, pr.attackerRole, pr.attackerId, target?.id ?? null);
      world.events.push({ t: 'boom', x: pr.toX, y: 10, r: pr.splash });
    }
  }
  world.projectiles = live;
}

function updateCrates(world: World, dt: number): void {
  world.nextCrateIn -= dt;
  if (world.nextCrateIn <= 0 && world.crates.length < 2) {
    world.crates.push({ id: world.nextId++, x: WORLD_W * (0.35 + rand(world) * 0.3), fall: 2.5 });
    world.nextCrateIn = 35 + rand(world) * 20;
  }
  world.crates = world.crates.filter((c) => {
    c.fall = Math.max(0, c.fall - dt);
    if (c.fall > 0) return true;
    let taker: Unit | null = null;
    for (const u of world.units) {
      if (u.hp <= 0 || Math.abs(u.x - c.x) > 18) continue;
      if (!taker || Math.abs(u.x - c.x) < Math.abs(taker.x - c.x)) taker = u;
    }
    if (!taker) return true;
    const p = world.players[taker.side];
    const amount = Math.round(80 * ageScale(p.age).cost * p.incomeMult);
    p.gold += amount;
    p.stats.goldEarned += amount;
    p.stats.cratesTaken += 1;
    world.events.push({ t: 'crate', x: c.x, side: taker.side, amount });
    return false;
  });
}

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------

function findUnit(world: World, id: number): Unit | null {
  for (const u of world.units) if (u.id === id && u.hp > 0) return u;
  return null;
}

function splashAround(
  world: World, side: Side, x: number, radius: number, dmg: number,
  role: Role | null, attackerId: number | null, skipId: number | null,
): void {
  for (const e of world.units) {
    if (e.side === side || e.hp <= 0 || e.id === skipId) continue;
    if (Math.abs(e.x - x) <= radius) damageUnit(world, e, dmg, role, attackerId);
  }
}

function damageUnit(world: World, target: Unit, dmg: number, role: Role | null, attackerId: number | null): void {
  if (target.hp <= 0) return;
  const tdef = unitDef(target.defId);
  const m = counterMult(role, tdef.role);
  const amount = dmg * m;
  target.hp -= amount;
  world.events.push({ t: 'hit', x: target.x, side: target.side, amount, counter: m > 1, unitId: target.id });
  if (target.hp <= 0) onKill(world, target, tdef, attackerId);
}

function onKill(world: World, victim: Unit, vdef: UnitDef, attackerId: number | null): void {
  const killer = world.players[foeOf(victim.side)];
  const owner = world.players[victim.side];
  const bounty = Math.round(vdef.goldBounty * killer.incomeMult);
  killer.gold += bounty;
  killer.stats.goldEarned += bounty;
  killer.xp += vdef.xpBounty;
  killer.stats.kills += 1;
  owner.xp += Math.round(vdef.xpBounty * 0.35);
  owner.stats.lost += 1;
  world.events.push({ t: 'death', x: victim.x, side: victim.side, defId: vdef.id, bounty, unitId: victim.id });

  const hero = attackerId !== null ? findUnit(world, attackerId) : null;
  if (!hero) return;
  hero.kills += 1;
  const nextRank = hero.rank + 1;
  if (nextRank < RANK_KILLS.length && hero.kills >= RANK_KILLS[nextRank]) {
    const hdef = unitDef(hero.defId);
    hero.rank = nextRank;
    const oldMax = hero.maxHp;
    hero.maxHp = hdef.hp * RANK_MULT[nextRank];
    hero.hp = Math.min(hero.maxHp, hero.hp + (hero.maxHp - oldMax) + hero.maxHp * 0.3);
    world.events.push({ t: 'rankUp', x: hero.x, side: hero.side, rank: nextRank });
  }
}

export function siegeMult(world: World): number {
  const overtime = Math.max(0, world.time - DOOM_START) / 60;
  return SIEGE_MULT * (1 + overtime * DOOM_PER_MIN);
}

function damageBase(world: World, side: Side, dmg: number): void {
  const p = world.players[side];
  if (p.hp <= 0) return;
  const amount = dmg * siegeMult(world);
  p.hp -= amount;
  world.events.push({ t: 'baseHit', side, amount });
  if (p.hp <= 0) {
    p.hp = 0;
    world.winner = foeOf(side);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
