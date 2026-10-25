import { describe, expect, it } from 'vitest';
import { AI_PARAMS, aiThink, createAI } from '../src/sim/ai';
import { AGES, BASE_X, counterMult, unitsOfAge } from '../src/sim/data';
import type { Difficulty, World } from '../src/sim/types';
import { createWorld, issue, step } from '../src/sim/world';

const DT = 1 / 60;

function runMatch(seed: number, a: Difficulty, b: Difficulty, maxMinutes = 40): World {
  const world = createWorld(seed, [AI_PARAMS[a].incomeMult, AI_PARAMS[b].incomeMult]);
  const ais = [createAI(0, a), createAI(1, b)];
  const maxTicks = maxMinutes * 60 * 60;
  for (let i = 0; i < maxTicks && world.winner === null; i++) {
    for (const ai of ais) aiThink(world, ai, DT);
    step(world, DT);
    world.events.length = 0;
  }
  return world;
}

describe('karşı-birim halkası', () => {
  it('her rol birini yener, birine yenilir', () => {
    expect(counterMult('piyade', 'destek')).toBe(1.5);
    expect(counterMult('destek', 'piyade')).toBe(0.7);
    expect(counterMult('piyade', 'zirhdelici')).toBe(1);
    expect(counterMult(null, 'agir')).toBe(1);
  });
});

describe('komutlar', () => {
  it('yetersiz altınla birim üretilemez', () => {
    const w = createWorld(1);
    w.players[0].gold = 0;
    expect(issue(w, 0, { type: 'train', unitId: unitsOfAge(0)[0].id })).toBe(false);
  });

  it('üretilen birim üsten çıkar ve ilerler', () => {
    const w = createWorld(1);
    issue(w, 0, { type: 'train', unitId: unitsOfAge(0)[0].id });
    for (let i = 0; i < 180; i++) step(w, DT);
    expect(w.units).toHaveLength(1);
    expect(w.units[0].x).toBeGreaterThan(BASE_X[0] + 60);
  });

  it('yeterli XP ile çağ atlanır ve üs canı büyür', () => {
    const w = createWorld(1);
    w.players[0].xp = AGES[1].xpRequired;
    const before = w.players[0].maxHp;
    expect(issue(w, 0, { type: 'ageUp' })).toBe(true);
    expect(w.players[0].age).toBe(1);
    expect(w.players[0].maxHp).toBeGreaterThan(before);
  });
});

describe('denge (yapay zekâ vs yapay zekâ)', () => {
  it('normal vs normal maçlar makul sürede biter ve çağlar ilerler', () => {
    const results = [11, 22, 33, 44, 55].map((seed) => runMatch(seed, 'normal', 'normal'));
    const summary = results.map((w) => ({
      winner: w.winner,
      minutes: +(w.time / 60).toFixed(1),
      ages: w.players.map((p) => p.age).join('/'),
      kills: w.players.map((p) => p.stats.kills).join('/'),
    }));
    console.table(summary);
    for (const w of results) {
      expect(w.winner).not.toBeNull();
      expect(w.time / 60).toBeGreaterThan(3);
      expect(Math.max(...w.players.map((p) => p.age))).toBeGreaterThanOrEqual(2);
    }
  });

  it('zor yapay zekâ kolayı yener', () => {
    const wins = [1, 2, 3, 4].map((s) => runMatch(s, 'zor', 'kolay').winner).filter((w) => w === 0).length;
    expect(wins).toBeGreaterThanOrEqual(3);
  });
});
