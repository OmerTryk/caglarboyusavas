import {
  AGES, BEATS, DOOM_START, POWER_COOLDOWN, RALLY_COOLDOWN, ROLE_LABEL, turretDef, turretsOfAge, unitDef, unitsOfAge,
} from '../sim/data';
import type { Command, Player, Stance, World } from '../sim/types';
import { canAgeUp, nextSlotCost } from '../sim/world';
import { fmt, fmtTime } from './format';
import { UnitIcon } from './UnitIcon';

interface TopProps {
  world: World;
  speed: number;
  paused: boolean;
  onSpeed: (s: number) => void;
  onPause: () => void;
  onExit: () => void;
}

export function TopBar({ world, speed, paused, onSpeed, onPause, onExit }: TopProps) {
  const [me, foe] = world.players;
  const doom = world.time > DOOM_START;
  return (
    <div className="topbar">
      <SideCard p={me} label="Sen" />
      <div className="center-controls">
        <div className={`clock ${doom ? 'doom' : ''}`} title={doom ? 'Kıyamet Saati: üslere verilen hasar her dakika artıyor' : undefined}>
          {doom ? '☠ ' : ''}{fmtTime(world.time)}
        </div>
        <div className="speed">
          {[1, 2, 3].map((s) => (
            <button key={s} className={speed === s ? 'on' : ''} onClick={() => onSpeed(s)} title="Oyun hızı (X)">×{s}</button>
          ))}
          <button className={paused ? 'on' : ''} onClick={onPause} title="Duraklat (Boşluk)">{paused ? '▶' : '❚❚'}</button>
          <button onClick={onExit} title="Ana menü">✕</button>
        </div>
      </div>
      <SideCard p={foe} label="Düşman" />
    </div>
  );
}

function SideCard({ p, label }: { p: Player; label: string }) {
  const hpRatio = Math.max(0, p.hp / p.maxHp);
  return (
    <div className={`side-card side-${p.side}`}>
      <div className="side-head">
        <span className="side-name">{label}</span>
        <span className="side-age">{AGES[p.age].name}</span>
      </div>
      <div className="bar hp" aria-label={`Üs canı ${Math.round(hpRatio * 100)}%`}>
        <div style={{ width: `${hpRatio * 100}%` }} />
        <span>{fmt(p.hp)} / {fmt(p.maxHp)}</span>
      </div>
    </div>
  );
}

interface BottomProps {
  world: World;
  targeting: boolean;
  send: (cmd: Command) => void;
  onTarget: () => void;
}

const STANCES: { id: Stance; label: string; key: string; hint: string }[] = [
  { id: 'saldir', label: '⚔ Saldır', key: 'Q', hint: 'Ordu düşman üssüne yürür' },
  { id: 'tut', label: '🛡 Tut', key: 'W', hint: 'Ordu orta hatta toplanıp bekler' },
  { id: 'geri', label: '↩ Geri Çekil', key: 'E', hint: 'Ordu kulelerin korumasına döner' },
];

export function BottomPanel({ world, targeting, send, onTarget }: BottomProps) {
  const me = world.players[0];
  const roster = unitsOfAge(me.age);
  const next = AGES[me.age + 1];
  const prevXp = AGES[me.age].xpRequired;
  const xpRatio = next ? Math.min(1, (me.xp - prevXp) / (next.xpRequired - prevXp)) : 1;
  const ready = canAgeUp(me);
  const slotCost = nextSlotCost(me);
  const powerReady = me.powerCd <= 0;
  const rallyReady = me.rallyCd <= 0;

  return (
    <div className="bottom">
      <div className="economy">
        <div className="gold" title="Altın">🪙 {fmt(me.gold)}</div>
        <div className="xp-wrap">
          <div className="bar xp" title="Deneyim: düşman öldürdükçe dolar">
            <div style={{ width: `${xpRatio * 100}%` }} />
            <span>{next ? `XP ${fmt(me.xp)} / ${fmt(next.xpRequired)}` : `XP ${fmt(me.xp)} · Son çağ`}</span>
          </div>
          <button
            className={`age-up ${ready ? 'ready' : ''}`}
            disabled={!ready}
            onClick={() => send({ type: 'ageUp' })}
            title="Çağ atla (U)"
          >
            {next ? `⬆ ${next.name}` : '★ Zirvedesin'}
          </button>
        </div>
      </div>

      <div className="group units">
        <div className="group-title">Birlikler</div>
        <div className="unit-row">
          {roster.map((def, i) => {
            const afford = me.gold >= def.cost;
            const strong = ROLE_LABEL[BEATS[def.role]];
            return (
              <button
                key={def.id}
                className={`unit-btn ${def.legendary ? 'legend' : ''}`}
                disabled={!afford || me.queue.length >= 5}
                onClick={() => send({ type: 'train', unitId: def.id })}
                title={`${def.name} (${ROLE_LABEL[def.role]}) — Güçlü olduğu: ${strong}. Can ${fmt(def.hp)}, hasar ${fmt(def.damage)}, menzil ${def.range}. Kısayol: ${i + 1}`}
              >
                <span className="hotkey">{i + 1}</span>
                <UnitIcon def={def} />
                <span className="unit-name">{def.name}</span>
                <span className="unit-role">{ROLE_LABEL[def.role]} › {strong}</span>
                <span className={`cost ${afford ? '' : 'short'}`}>🪙 {fmt(def.cost)}</span>
              </button>
            );
          })}
        </div>
        <div className="queue" aria-label="Üretim sırası">
          {Array.from({ length: 5 }, (_, i) => {
            const q = me.queue[i];
            if (!q) return <div key={i} className="q-slot empty" />;
            const def = unitDef(q.unitId);
            return (
              <div key={i} className="q-slot" title={def.name}>
                <span>{def.name.slice(0, 2)}</span>
                {i === 0 && <div className="q-progress" style={{ width: `${(q.progress / def.buildTime) * 100}%` }} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="group">
        <div className="group-title">Komut</div>
        <div className="stack">
          {STANCES.map((s) => (
            <button
              key={s.id}
              className={`stance ${me.stance === s.id ? 'on' : ''}`}
              onClick={() => send({ type: 'stance', stance: s.id })}
              title={`${s.hint} (${s.key})`}
            >
              {s.label} <kbd>{s.key}</kbd>
            </button>
          ))}
        </div>
      </div>

      <div className="group">
        <div className="group-title">Güçler</div>
        <div className="stack">
          <CooldownButton
            label={`☄ ${AGES[me.age].powerName}`}
            hotkey="F"
            ready={powerReady}
            active={targeting}
            remaining={me.powerCd}
            total={POWER_COOLDOWN}
            onClick={onTarget}
            hint="Seç, sonra savaş alanında hedefe tıkla"
          />
          <CooldownButton
            label="🥁 Savaş Davulu"
            hotkey="R"
            ready={rallyReady}
            active={me.rallyT > 0}
            remaining={me.rallyCd}
            total={RALLY_COOLDOWN}
            onClick={() => send({ type: 'rally' })}
            hint="8 saniye boyunca ordun %35 daha sert, %30 daha hızlı"
          />
        </div>
      </div>

      <div className="group">
        <div className="group-title">Savunma</div>
        <div className="stack">
          {turretsOfAge(me.age).map((t, i) => (
            <button
              key={t.id}
              className="turret-btn"
              disabled={me.gold < t.cost || !me.slots.includes(null)}
              onClick={() => send({ type: 'buyTurret', turretId: t.id })}
              title={`${t.kind === 'agir' ? 'Alan hasarı, yavaş' : 'Hızlı, tek hedef'} · menzil ${t.range} (${i === 0 ? 'T' : 'Y'})`}
            >
              🏰 {t.name} <span className="cost">🪙 {fmt(t.cost)}</span>
            </button>
          ))}
          <div className="slots">
            {me.slots.map((s, i) => (
              <button
                key={i}
                className={`slot ${s ? 'full' : ''}`}
                disabled={!s}
                onClick={() => send({ type: 'sellTurret', slot: i })}
                title={s ? `${turretDef(s.defId).name} — sat (%50 iade)` : 'Boş kule yuvası'}
              >
                {s ? `${turretDef(s.defId).name.slice(0, 3)} ✕` : '—'}
              </button>
            ))}
            {slotCost !== null && (
              <button className="slot add" disabled={me.gold < slotCost} onClick={() => send({ type: 'buySlot' })} title="Yeni kule yuvası">
                +{fmt(slotCost)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface CdProps {
  label: string;
  hotkey: string;
  ready: boolean;
  active: boolean;
  remaining: number;
  total: number;
  hint: string;
  onClick: () => void;
}

function CooldownButton({ label, hotkey, ready, active, remaining, total, hint, onClick }: CdProps) {
  return (
    <button className={`power ${active ? 'on' : ''} ${ready ? 'ready' : ''}`} disabled={!ready && !active} onClick={onClick} title={`${hint} (${hotkey})`}>
      {!ready && <div className="cd-fill" style={{ width: `${(remaining / total) * 100}%` }} />}
      <span>{label}</span>
      <kbd>{ready ? hotkey : Math.ceil(remaining)}</kbd>
    </button>
  );
}
