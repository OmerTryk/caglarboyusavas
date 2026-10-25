import type { AgeDef, HeadKind, MountKind, ProjectileKind, Role, TurretDef, UnitDef, WeaponKind } from './types';

// --- Lane geometry (world units) ---
export const WORLD_W = 1800;
export const BASE_X: [number, number] = [90, WORLD_W - 90];
export const BASE_HALF = 62;

// --- Scaling between ages ---
/** Gold costs and income grow by this factor per age. */
export const COST_MULT = 3.2;
/** HP and damage grow by this factor per age. */
export const POWER_MULT = 2.7;

export const MAX_QUEUE = 5;
export const SLOT_COSTS = [0, 250, 1200, 5000];
export const BASE_HP = 1200;
/** Units hit walls harder than flesh, so a wave that breaks through ends the match. */
export const SIEGE_MULT = 2.5;
/** "Kıyamet Saati": after this many seconds siege damage keeps climbing, so long matches still end. */
export const DOOM_START = 25 * 60;
export const DOOM_PER_MIN = 0.25;
export const START_GOLD = 175;
export const PASSIVE_INCOME = 3;

export const POWER_COOLDOWN = 40;
export const POWER_RADIUS = 150;
export const POWER_SHOTS = 12;
export const POWER_DAMAGE = 42;

export const RALLY_COOLDOWN = 35;
export const RALLY_DURATION = 8;
export const RALLY_DAMAGE = 1.35;
export const RALLY_SPEED = 1.3;

/** Kills needed for rank 1 and rank 2, and their stat multipliers. */
export const RANK_KILLS = [0, 2, 5];
export const RANK_MULT = [1, 1.2, 1.45];

export const SHOCK_RANGE = 380;
export const SHOCK_PUSH = 110;

/** Fraction of own-base distance where the "tut" (hold) line sits. */
export const HOLD_LINE = 0.4;
export const RETREAT_LINE = 200;

/** Piyade > Destek > Zırhdelici > Ağır > Piyade */
export const BEATS: Record<Role, Role> = {
  piyade: 'destek',
  destek: 'zirhdelici',
  zirhdelici: 'agir',
  agir: 'piyade',
};
export const COUNTER_BONUS = 1.5;
export const COUNTER_PENALTY = 0.7;

export const ROLE_LABEL: Record<Role, string> = {
  piyade: 'Piyade',
  destek: 'Menzilli',
  zirhdelici: 'Zırh Delici',
  agir: 'Ağır',
};

export const AGES: AgeDef[] = [
  {
    index: 0, name: 'Taş Çağı', xpRequired: 0, baseStyle: 'cave',
    powerName: 'Göktaşı Yağmuru', powerProjectile: 'rock',
    palette: { skyTop: '#f6b26b', skyBottom: '#fde3b0', far: '#b9845a', near: '#8a6a3a', ground: '#7c5a2e', groundDark: '#5a3f1e', accent: '#c96a2b' },
  },
  {
    index: 1, name: 'Antik Çağ', xpRequired: 4000, baseStyle: 'temple',
    powerName: 'Ok Yağmuru', powerProjectile: 'arrow',
    palette: { skyTop: '#5fa8e8', skyBottom: '#d8efff', far: '#9db8a4', near: '#6f9a5e', ground: '#a8884f', groundDark: '#7d6236', accent: '#d4af37' },
  },
  {
    index: 2, name: 'Orta Çağ', xpRequired: 16000, baseStyle: 'castle',
    powerName: 'Ateş Gülleleri', powerProjectile: 'fire',
    palette: { skyTop: '#6b7fa8', skyBottom: '#c9d3e6', far: '#6c7a8a', near: '#4f6b4a', ground: '#5e6b3a', groundDark: '#3f4a25', accent: '#9b2c2c' },
  },
  {
    index: 3, name: 'Barut Çağı', xpRequired: 60000, baseStyle: 'fort',
    powerName: 'Top Bombardımanı', powerProjectile: 'ball',
    palette: { skyTop: '#e08a5f', skyBottom: '#f7d9b9', far: '#a7836a', near: '#7a6a4a', ground: '#8f7650', groundDark: '#665235', accent: '#c0392b' },
  },
  {
    index: 4, name: 'Modern Çağ', xpRequired: 210000, baseStyle: 'bunker',
    powerName: 'Hava Saldırısı', powerProjectile: 'rocket',
    palette: { skyTop: '#7d8a96', skyBottom: '#d5dbe0', far: '#5c6670', near: '#4d5a45', ground: '#5b5c4a', groundDark: '#3d3e31', accent: '#4f7942' },
  },
  {
    index: 5, name: 'Gelecek Çağ', xpRequired: 700000, baseStyle: 'dome',
    powerName: 'Yörünge Lazeri', powerProjectile: 'laser',
    palette: { skyTop: '#0b0f2e', skyBottom: '#3b2a6b', far: '#2a2350', near: '#1b1a3a', ground: '#262445', groundDark: '#17162e', accent: '#22d3ee' },
  },
];

interface RoleBase {
  cost: number; buildTime: number; hp: number; damage: number; attackInterval: number;
  range: number; speed: number; width: number; height: number; splash: number;
  projectile: ProjectileKind; projectileSpeed: number;
}

const ROLE_BASE: Record<Role, RoleBase> = {
  piyade:     { cost: 15,  buildTime: 1.0, hp: 60,  damage: 10, attackInterval: 1.0, range: 24,  speed: 46, width: 22, height: 46, splash: 0,  projectile: 'none', projectileSpeed: 0 },
  destek:     { cost: 25,  buildTime: 1.3, hp: 38,  damage: 7,  attackInterval: 1.4, range: 165, speed: 42, width: 20, height: 44, splash: 0,  projectile: 'rock', projectileSpeed: 420 },
  zirhdelici: { cost: 40,  buildTime: 1.6, hp: 72,  damage: 12, attackInterval: 1.3, range: 34,  speed: 40, width: 22, height: 50, splash: 0,  projectile: 'none', projectileSpeed: 0 },
  agir:       { cost: 110, buildTime: 3.0, hp: 270, damage: 26, attackInterval: 1.7, range: 30,  speed: 32, width: 46, height: 66, splash: 26, projectile: 'none', projectileSpeed: 0 },
};

interface UnitFlavor {
  name: string;
  /** Extra units beyond the four roles (the legendary Titan) set their own role and id. */
  role?: Role;
  key?: string;
  legendary?: boolean;
  weapon: WeaponKind;
  head: HeadKind;
  mount?: MountKind;
  /** Per-unit tweaks on top of the role base, applied before age scaling. */
  over?: Partial<RoleBase>;
}

/** Units are drawn a bit larger than their collision width for readability. */
const VISUAL_SCALE = 1.25;

const ROLES: Role[] = ['piyade', 'destek', 'zirhdelici', 'agir'];

const FLAVORS: UnitFlavor[][] = [
  [
    { name: 'Sopalı', weapon: 'club', head: 'hair' },
    { name: 'Sapancı', weapon: 'sling', head: 'hair', over: { projectile: 'rock' } },
    { name: 'Mızraklı', weapon: 'spear', head: 'hair' },
    { name: 'Mamut Binici', weapon: 'spear', head: 'hair', mount: 'mammoth', over: { width: 58, height: 78 } },
  ],
  [
    { name: 'Gladyatör', weapon: 'sword', head: 'crest' },
    { name: 'Okçu', weapon: 'bow', head: 'crest', over: { projectile: 'arrow', projectileSpeed: 560 } },
    { name: 'Falanks', weapon: 'spear', head: 'crest', over: { range: 40 } },
    { name: 'Savaş Arabası', weapon: 'spear', head: 'crest', mount: 'chariot', over: { speed: 40, width: 56 } },
  ],
  [
    { name: 'Kılıççı', weapon: 'sword', head: 'helm' },
    { name: 'Arbaletçi', weapon: 'crossbow', head: 'helm', over: { projectile: 'arrow', projectileSpeed: 650, range: 180 } },
    { name: 'Teberdar', weapon: 'spear', head: 'helm', over: { range: 42 } },
    { name: 'Şövalye', weapon: 'spear', head: 'helm', mount: 'knight', over: { speed: 42, width: 50 } },
  ],
  [
    { name: 'Akıncı', weapon: 'saber', head: 'bork', over: { speed: 52 } },
    { name: 'Yeniçeri', weapon: 'gun', head: 'bork', over: { projectile: 'bullet', projectileSpeed: 1100, range: 190 } },
    { name: 'Humbaracı', weapon: 'launcher', head: 'bork', over: { range: 110, projectile: 'ball', projectileSpeed: 360, splash: 22 } },
    { name: 'Sahra Topu', weapon: 'gun', head: 'bork', mount: 'cannon', over: { range: 230, projectile: 'ball', projectileSpeed: 420, splash: 40, speed: 26, hp: 210 } },
  ],
  [
    { name: 'Hücum Eri', weapon: 'gun', head: 'helmet', over: { range: 70, projectile: 'bullet', projectileSpeed: 1200 } },
    { name: 'Keskin Nişancı', weapon: 'gun', head: 'helmet', over: { range: 240, projectile: 'bullet', projectileSpeed: 1600, attackInterval: 1.8, damage: 10 } },
    { name: 'Roketatar', weapon: 'launcher', head: 'helmet', over: { range: 130, projectile: 'rocket', projectileSpeed: 500 } },
    { name: 'Tank', weapon: 'gun', head: 'helmet', mount: 'tank', over: { range: 160, projectile: 'ball', projectileSpeed: 700, splash: 34, width: 70, height: 60 } },
  ],
  [
    { name: 'Plazma Kılıççı', weapon: 'saber', head: 'visor', over: { speed: 56 } },
    { name: 'Lazer Tüfekçi', weapon: 'blaster', head: 'visor', over: { projectile: 'laser', projectileSpeed: 1800, range: 200 } },
    { name: 'İyon Topçu', weapon: 'launcher', head: 'visor', over: { range: 140, projectile: 'laser', projectileSpeed: 1400 } },
    { name: 'Savaş Robotu', weapon: 'blaster', head: 'visor', mount: 'mech', over: { range: 150, projectile: 'laser', projectileSpeed: 1600, splash: 30, width: 60, height: 96 } },
    {
      name: 'Titan', role: 'agir', key: 'titan', legendary: true, weapon: 'blaster', head: 'visor', mount: 'mech',
      over: { cost: 200, buildTime: 6, hp: 1100, damage: 70, attackInterval: 1.5, range: 180, speed: 24, width: 84, height: 140, splash: 70, projectile: 'laser', projectileSpeed: 1600 },
    },
  ],
];

function buildUnits(): UnitDef[] {
  const out: UnitDef[] = [];
  FLAVORS.forEach((ageFlavors, age) => {
    ageFlavors.forEach((f, i) => {
      const role = f.role ?? ROLES[i];
      const b = { ...ROLE_BASE[role], ...f.over };
      const cm = Math.pow(COST_MULT, age);
      const pm = Math.pow(POWER_MULT, age);
      const cost = Math.round(b.cost * cm);
      out.push({
        id: `a${age}_${f.key ?? role}`,
        name: f.name,
        age,
        role,
        cost,
        buildTime: b.buildTime,
        hp: Math.round(b.hp * pm),
        damage: Math.round(b.damage * pm),
        attackInterval: b.attackInterval,
        range: b.range,
        speed: b.speed,
        width: b.width,
        height: Math.round(b.height * VISUAL_SCALE),
        splash: b.splash,
        goldBounty: Math.round(cost * 0.7),
        xpBounty: Math.round(cost * 2),
        projectile: b.projectile,
        projectileSpeed: b.projectileSpeed,
        weapon: f.weapon,
        head: f.head,
        mount: f.mount,
        legendary: f.legendary ?? false,
      });
    });
  });
  return out;
}

const TURRET_NAMES: [string, ProjectileKind, string, ProjectileKind][] = [
  ['Taş Sapanı', 'rock', 'Kaya Mancınığı', 'rock'],
  ['Balista', 'arrow', 'Ateş Mancınığı', 'fire'],
  ['Arbalet Kulesi', 'arrow', 'Trebuşe', 'rock'],
  ['Şahi Topu', 'ball', 'Havan', 'ball'],
  ['Makineli Tüfek', 'bullet', 'Roket Bataryası', 'rocket'],
  ['Lazer Kulesi', 'laser', 'İyon Topu', 'laser'],
];

function buildTurrets(): TurretDef[] {
  const out: TurretDef[] = [];
  TURRET_NAMES.forEach(([fastName, fastProj, heavyName, heavyProj], age) => {
    const cm = Math.pow(COST_MULT, age);
    const pm = Math.pow(POWER_MULT, age);
    out.push({
      id: `t${age}_hizli`, name: fastName, age, kind: 'hizli',
      cost: Math.round(120 * cm), damage: Math.round(6 * pm), interval: 0.9,
      range: 310, splash: 0, projectile: fastProj, projectileSpeed: 700,
    });
    out.push({
      id: `t${age}_agir`, name: heavyName, age, kind: 'agir',
      cost: Math.round(280 * cm), damage: Math.round(16 * pm), interval: 2.4,
      range: 360, splash: 55, projectile: heavyProj, projectileSpeed: 420,
    });
  });
  return out;
}

export const UNITS: UnitDef[] = buildUnits();
export const TURRETS: TurretDef[] = buildTurrets();

const unitById = new Map(UNITS.map((u) => [u.id, u]));
const turretById = new Map(TURRETS.map((t) => [t.id, t]));

export function unitDef(id: string): UnitDef {
  const d = unitById.get(id);
  if (!d) throw new Error(`Bilinmeyen birim: ${id}`);
  return d;
}

export function turretDef(id: string): TurretDef {
  const d = turretById.get(id);
  if (!d) throw new Error(`Bilinmeyen kule: ${id}`);
  return d;
}

export function unitsOfAge(age: number): UnitDef[] {
  return UNITS.filter((u) => u.age === age);
}

export function turretsOfAge(age: number): TurretDef[] {
  return TURRETS.filter((t) => t.age === age);
}

export function ageScale(age: number): { cost: number; power: number } {
  return { cost: Math.pow(COST_MULT, age), power: Math.pow(POWER_MULT, age) };
}

export function counterMult(attacker: Role | null, target: Role | null): number {
  if (!attacker || !target) return 1;
  if (BEATS[attacker] === target) return COUNTER_BONUS;
  if (BEATS[target] === attacker) return COUNTER_PENALTY;
  return 1;
}
