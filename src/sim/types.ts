export type Side = 0 | 1;
export type Role = 'piyade' | 'destek' | 'zirhdelici' | 'agir';
export type Stance = 'saldir' | 'tut' | 'geri';
export type Difficulty = 'kolay' | 'normal' | 'zor' | 'imkansiz';

export type ProjectileKind = 'none' | 'rock' | 'arrow' | 'bullet' | 'ball' | 'laser' | 'rocket' | 'fire';
export type WeaponKind = 'club' | 'sword' | 'saber' | 'spear' | 'sling' | 'bow' | 'crossbow' | 'gun' | 'launcher' | 'blaster';
export type MountKind = 'mammoth' | 'chariot' | 'knight' | 'cannon' | 'tank' | 'mech';
export type HeadKind = 'hair' | 'crest' | 'helm' | 'bork' | 'helmet' | 'visor';
export type BaseStyle = 'cave' | 'temple' | 'castle' | 'fort' | 'bunker' | 'dome';

export interface UnitDef {
  id: string;
  name: string;
  age: number;
  role: Role;
  cost: number;
  buildTime: number;
  hp: number;
  damage: number;
  attackInterval: number;
  range: number;
  speed: number;
  width: number;
  height: number;
  splash: number;
  goldBounty: number;
  xpBounty: number;
  projectile: ProjectileKind;
  projectileSpeed: number;
  weapon: WeaponKind;
  head: HeadKind;
  mount?: MountKind;
  legendary: boolean;
}

export interface TurretDef {
  id: string;
  name: string;
  age: number;
  kind: 'hizli' | 'agir';
  cost: number;
  damage: number;
  interval: number;
  range: number;
  splash: number;
  projectile: ProjectileKind;
  projectileSpeed: number;
}

export interface AgePalette {
  skyTop: string;
  skyBottom: string;
  far: string;
  near: string;
  ground: string;
  groundDark: string;
  accent: string;
}

export interface AgeDef {
  index: number;
  name: string;
  xpRequired: number;
  baseStyle: BaseStyle;
  powerName: string;
  powerProjectile: ProjectileKind;
  palette: AgePalette;
}

export interface TurretInstance {
  defId: string;
  cd: number;
  /** Render-only hint: x of the last target, so the barrel can aim. */
  aimX: number;
}

export interface QueueItem {
  unitId: string;
  progress: number;
}

export interface PlayerStats {
  kills: number;
  lost: number;
  trained: number;
  goldEarned: number;
  cratesTaken: number;
}

export interface Player {
  side: Side;
  gold: number;
  xp: number;
  age: number;
  hp: number;
  maxHp: number;
  slots: (TurretInstance | null)[];
  queue: QueueItem[];
  stance: Stance;
  powerCd: number;
  rallyCd: number;
  rallyT: number;
  /** Multiplies passive income and bounties; the AI difficulty lever. */
  incomeMult: number;
  stats: PlayerStats;
}

export interface Unit {
  id: number;
  side: Side;
  defId: string;
  x: number;
  hp: number;
  maxHp: number;
  cd: number;
  kills: number;
  rank: number;
  /** 0..1 visual depth inside the lane, purely cosmetic. */
  lane: number;
  state: 'walk' | 'attack' | 'idle' | 'back';
  /** Seconds since the last attack started; drives the swing animation. */
  atkT: number;
  walkT: number;
}

export interface Projectile {
  id: number;
  side: Side;
  kind: ProjectileKind;
  fromX: number;
  fromY: number;
  toX: number;
  targetId: number | null;
  attackerId: number | null;
  attackerRole: Role | null;
  damage: number;
  splash: number;
  t: number;
  dur: number;
  /** Falls from the sky (special power) instead of flying across. */
  sky: boolean;
}

export interface Crate {
  id: number;
  x: number;
  /** Seconds until it lands; collectable at 0. */
  fall: number;
}

export type GameEvent =
  | { t: 'hit'; x: number; side: Side; amount: number; counter: boolean; unitId: number }
  | { t: 'death'; x: number; side: Side; defId: string; bounty: number; unitId: number }
  | { t: 'boom'; x: number; y: number; r: number }
  | { t: 'baseHit'; side: Side; amount: number }
  | { t: 'ageUp'; side: Side; age: number }
  | { t: 'shock'; side: Side }
  | { t: 'crate'; x: number; side: Side; amount: number }
  | { t: 'rankUp'; x: number; side: Side; rank: number }
  | { t: 'rally'; side: Side }
  | { t: 'power'; side: Side; x: number };

export interface World {
  time: number;
  tick: number;
  players: [Player, Player];
  units: Unit[];
  projectiles: Projectile[];
  crates: Crate[];
  nextCrateIn: number;
  seed: number;
  nextId: number;
  winner: Side | null;
  /** Drained by the renderer each frame. */
  events: GameEvent[];
}

export type Command =
  | { type: 'train'; unitId: string }
  | { type: 'buyTurret'; turretId: string }
  | { type: 'sellTurret'; slot: number }
  | { type: 'buySlot' }
  | { type: 'ageUp' }
  | { type: 'stance'; stance: Stance }
  | { type: 'power'; x: number }
  | { type: 'rally' };
