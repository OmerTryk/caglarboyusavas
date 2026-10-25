import { BEATS, BASE_X, MAX_QUEUE, POWER_RADIUS, turretDef, turretsOfAge, unitDef, unitsOfAge } from './data';
import { rand } from './rng';
import type { Difficulty, Role, Side, Stance, Unit, World } from './types';
import { canAgeUp, issue, nextSlotCost } from './world';

interface AIParams {
  thinkEvery: number;
  incomeMult: number;
  /** Chance to pick the unit that counters the player's strongest role. */
  counterSkill: number;
  /** Chance to use powers when a good moment shows up. */
  powerSkill: number;
  /** Seconds the AI sits on an available age-up before taking it. */
  ageUpDelay: number;
  /** Uses stances (retreat under turrets, hold) instead of always attacking. */
  tactical: boolean;
}

export const AI_PARAMS: Record<Difficulty, AIParams> = {
  kolay:    { thinkEvery: 1.2,  incomeMult: 0.7,  counterSkill: 0.15, powerSkill: 0.25, ageUpDelay: 20, tactical: false },
  normal:   { thinkEvery: 0.7,  incomeMult: 1.0,  counterSkill: 0.45, powerSkill: 0.55, ageUpDelay: 6,  tactical: true },
  zor:      { thinkEvery: 0.45, incomeMult: 1.25, counterSkill: 0.75, powerSkill: 0.85, ageUpDelay: 1,  tactical: true },
  imkansiz: { thinkEvery: 0.3,  incomeMult: 1.6,  counterSkill: 0.95, powerSkill: 1,    ageUpDelay: 0,  tactical: true },
};

export interface AIState {
  side: Side;
  params: AIParams;
  timer: number;
  ageReady: number;
  /** Tactical AIs mass behind the hold line, then push as one wave. */
  pushing: boolean;
}

export function createAI(side: Side, difficulty: Difficulty): AIState {
  return { side, params: AI_PARAMS[difficulty], timer: 1, ageReady: 0, pushing: false };
}

const ROLE_WEIGHTS: [Role, number][] = [['piyade', 0.36], ['destek', 0.3], ['zirhdelici', 0.2], ['agir', 0.14]];

export function aiThink(world: World, ai: AIState, dt: number): void {
  if (world.winner !== null) return;
  ai.timer -= dt;
  if (ai.timer > 0) return;
  const { params, side } = ai;
  ai.timer = params.thinkEvery;

  const me = world.players[side];
  const mine = world.units.filter((u) => u.side === side && u.hp > 0);
  const theirs = world.units.filter((u) => u.side !== side && u.hp > 0);

  if (canAgeUp(me)) {
    ai.ageReady += params.thinkEvery;
    if (ai.ageReady >= params.ageUpDelay) {
      issue(world, side, { type: 'ageUp' });
      ai.ageReady = 0;
    }
  }

  usePowers(world, ai, mine, theirs);
  if (params.tactical) chooseStance(world, ai, mine, theirs);
  manageTurrets(world, ai);
  train(world, ai, theirs);
}

function strength(units: Unit[]): number {
  let s = 0;
  for (const u of units) s += unitDef(u.defId).cost * (u.hp / u.maxHp);
  return s;
}

function usePowers(world: World, ai: AIState, mine: Unit[], theirs: Unit[]): void {
  const me = world.players[ai.side];
  if (me.powerCd <= 0 && theirs.length >= 3) {
    let bestX = 0;
    let bestCount = 0;
    for (const e of theirs) {
      const n = theirs.filter((o) => Math.abs(o.x - e.x) < POWER_RADIUS * 0.8).length;
      if (n > bestCount) {
        bestCount = n;
        bestX = e.x;
      }
    }
    const nearHome = Math.abs(bestX - BASE_X[ai.side]) < 500;
    if ((bestCount >= 4 || (nearHome && bestCount >= 2)) && rand(world) < ai.params.powerSkill) {
      issue(world, ai.side, { type: 'power', x: bestX });
    }
  }
  if (me.rallyCd <= 0 && mine.length >= 5 && theirs.length >= 2 && rand(world) < ai.params.powerSkill * 0.5) {
    issue(world, ai.side, { type: 'rally' });
  }
}

function chooseStance(world: World, ai: AIState, mine: Unit[], theirs: Unit[]): void {
  const me = world.players[ai.side];
  const foe = world.players[ai.side === 0 ? 1 : 0];
  const ours = strength(mine);
  const foes = strength(theirs);
  const foeDefense = foe.slots.reduce((s, t) => s + (t ? turretDef(t.defId).cost : 0), 0);

  if (ai.pushing && (ours < foes * 0.8 || mine.length < 3)) ai.pushing = false;
  if (!ai.pushing && mine.length >= 7 && ours > foes * 1.25 + foeDefense * 0.6) ai.pushing = true;

  let stance: Stance = ai.pushing ? 'saldir' : 'tut';
  if (!ai.pushing && foes > ours * 1.7 && me.slots.some((s) => s !== null)) stance = 'geri';
  if (stance !== me.stance) issue(world, ai.side, { type: 'stance', stance });
}

function manageTurrets(world: World, ai: AIState): void {
  const me = world.players[ai.side];
  const options = turretsOfAge(me.age);
  const empty = me.slots.indexOf(null);

  if (empty >= 0) {
    const affordable = options.filter((t) => t.cost * 1.4 <= me.gold);
    const pick = affordable[affordable.length - 1];
    if (pick) issue(world, ai.side, { type: 'buyTurret', turretId: pick.id });
    return;
  }

  const outdated = me.slots.findIndex((t) => t !== null && turretDef(t.defId).age < me.age);
  if (outdated >= 0 && me.gold > options[0].cost * 2) {
    issue(world, ai.side, { type: 'sellTurret', slot: outdated });
    return;
  }

  const slotCost = nextSlotCost(me);
  if (slotCost !== null && me.gold > slotCost * 3 + options[0].cost) {
    issue(world, ai.side, { type: 'buySlot' });
  }
}

function train(world: World, ai: AIState, theirs: Unit[]): void {
  const me = world.players[ai.side];
  const roster = unitsOfAge(me.age);
  const want = me.gold > roster[3].cost * 3 ? MAX_QUEUE : 3;

  const titan = roster.find((u) => u.legendary);
  if (titan && me.gold > titan.cost * 1.3 && me.queue.length < MAX_QUEUE && rand(world) < 0.5) {
    issue(world, ai.side, { type: 'train', unitId: titan.id });
  }

  while (me.queue.length < want) {
    let role = weightedRole(world);
    if (theirs.length > 0 && rand(world) < ai.params.counterSkill) {
      role = counterTo(dominantRole(theirs));
    }
    let pick = roster.find((u) => u.role === role)!;
    if (pick.cost > me.gold) {
      // Fall back to the priciest unit we can still afford.
      const cheaper = roster.filter((u) => u.cost <= me.gold);
      if (cheaper.length === 0) return;
      pick = cheaper[cheaper.length - 1];
    }
    if (!issue(world, ai.side, { type: 'train', unitId: pick.id })) return;
  }
}

function weightedRole(world: World): Role {
  let r = rand(world);
  for (const [role, w] of ROLE_WEIGHTS) {
    r -= w;
    if (r <= 0) return role;
  }
  return 'piyade';
}

function dominantRole(units: Unit[]): Role {
  const totals = new Map<Role, number>();
  for (const u of units) {
    const d = unitDef(u.defId);
    totals.set(d.role, (totals.get(d.role) ?? 0) + d.cost);
  }
  let best: Role = 'piyade';
  let bestVal = -1;
  for (const [role, v] of totals) {
    if (v > bestVal) {
      bestVal = v;
      best = role;
    }
  }
  return best;
}

function counterTo(role: Role): Role {
  return (Object.keys(BEATS) as Role[]).find((r) => BEATS[r] === role)!;
}

