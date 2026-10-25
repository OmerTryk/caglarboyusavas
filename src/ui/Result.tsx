import { AGES } from '../sim/data';
import type { Difficulty, World } from '../sim/types';
import { DIFFICULTY_LABEL } from './Menu';
import { fmt, fmtTime } from './format';

interface Props {
  world: World;
  difficulty: Difficulty;
  onRestart: () => void;
  onExit: () => void;
}

export function Result({ world, difficulty, onRestart, onExit }: Props) {
  const won = world.winner === 0;
  const [me, foe] = world.players;
  const rows: [string, string, string][] = [
    ['Ulaşılan çağ', AGES[me.age].name, AGES[foe.age].name],
    ['Öldürülen', fmt(me.stats.kills), fmt(foe.stats.kills)],
    ['Kaybedilen', fmt(me.stats.lost), fmt(foe.stats.lost)],
    ['Üretilen birlik', fmt(me.stats.trained), fmt(foe.stats.trained)],
    ['Kazanılan altın', fmt(me.stats.goldEarned), fmt(foe.stats.goldEarned)],
    ['Erzak sandığı', fmt(me.stats.cratesTaken), fmt(foe.stats.cratesTaken)],
  ];
  return (
    <div className="overlay">
      <div className={`result ${won ? 'won' : 'lost'}`}>
        <h2>{won ? 'Zafer!' : 'Yenilgi'}</h2>
        <p className="result-sub">
          {won ? 'Düşman üssü yerle bir oldu.' : 'Üssün düştü. Bir dahaki sefere!'} · {DIFFICULTY_LABEL[difficulty]} · {fmtTime(world.time)}
        </p>
        <table>
          <thead>
            <tr><th /><th>Sen</th><th>Düşman</th></tr>
          </thead>
          <tbody>
            {rows.map(([k, a, b]) => (
              <tr key={k}><td>{k}</td><td>{a}</td><td>{b}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="result-actions">
          <button className="primary" onClick={onRestart}>Tekrar Oyna</button>
          <button onClick={onExit}>Ana Menü</button>
        </div>
      </div>
    </div>
  );
}
