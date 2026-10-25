import { useEffect, useRef } from 'react';
import { startLoop } from '../game/loop';
import { AI_PARAMS, createAI } from '../sim/ai';
import type { Difficulty } from '../sim/types';
import { createWorld } from '../sim/world';

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  kolay: 'Kolay',
  normal: 'Normal',
  zor: 'Zor',
  imkansiz: 'İmkânsız',
};

const DIFFICULTY_HINT: Record<Difficulty, string> = {
  kolay: 'Rakip yavaş düşünür, az kazanır.',
  normal: 'Dengeli bir rakip, karşı-birim seçer.',
  zor: 'Hızlı karar verir, dalga hâlinde saldırır.',
  imkansiz: 'Daha zengin, acımasız ve hatasız.',
};

interface Props {
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  onStart: () => void;
}

export function Menu({ difficulty, onDifficulty, onStart }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // An AI-vs-AI skirmish plays behind the menu.
  useEffect(() => {
    const make = () => ({
      world: createWorld((Math.random() * 2 ** 31) | 0, [AI_PARAMS.normal.incomeMult, AI_PARAMS.normal.incomeMult]),
      ais: [createAI(0, 'normal'), createAI(1, 'normal')],
    });
    let demo = make();
    const loop = startLoop({
      canvas: canvasRef.current!,
      getWorld: () => {
        if (demo.world.winner !== null) demo = make();
        return demo.world;
      },
      ais: () => demo.ais,
      getSpeed: () => 2,
      isPaused: () => false,
      view: { targeting: false, pointerX: null },
    });
    return loop.stop;
  }, []);

  return (
    <div className="menu">
      <canvas ref={canvasRef} className="menu-bg" aria-hidden />
      <div className="menu-card">
        <h1>Çağlar Boyu Savaş</h1>
        <p className="tagline">Taş Çağı'ndan Gelecek Çağ'a, tek şeritte altı çağlık savaş.</p>

        <div className="difficulty" role="radiogroup" aria-label="Zorluk">
          {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
            <button
              key={d}
              role="radio"
              aria-checked={difficulty === d}
              className={difficulty === d ? 'on' : ''}
              onClick={() => onDifficulty(d)}
            >
              <strong>{DIFFICULTY_LABEL[d]}</strong>
              <small>{DIFFICULTY_HINT[d]}</small>
            </button>
          ))}
        </div>

        <button className="primary start" onClick={onStart}>Savaşa Başla</button>

        <details className="howto">
          <summary>Nasıl oynanır?</summary>
          <ul>
            <li><b>Birlik üret</b>, düşman üssünü yık. Öldürdükçe altın ve XP kazanırsın.</li>
            <li><b>Karşı-birim halkası:</b> Piyade › Menzilli › Zırh Delici › Ağır › Piyade. Sarı rakamlar karşı-birim vuruşudur.</li>
            <li><b>Ordu komutları:</b> Saldır, Tut (orta hatta topla), Geri Çekil (kulelere sığın). Topla, sonra dalga hâlinde vur!</li>
            <li><b>Çağ atla:</b> XP dolunca yeni birimler gelir ve üssün şok dalgasıyla yakındaki düşmanları savurur.</li>
            <li><b>Güçler:</b> Çağ gücünü istediğin yere düşür; Savaş Davulu ordunu coşturur.</li>
            <li><b>Terfi:</b> Öldüren birlik yıldız kazanır ve güçlenir. Ortaya düşen <b>erzak sandığını</b> ilk kapan altını alır.</li>
            <li><b>Kıyamet Saati:</b> 25. dakikadan sonra üslere verilen hasar her dakika artar.</li>
          </ul>
          <p className="keys">
            <kbd>1-5</kbd> birlik · <kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd> komut · <kbd>F</kbd> güç · <kbd>R</kbd> davul ·{' '}
            <kbd>U</kbd> çağ atla · <kbd>T</kbd><kbd>Y</kbd> kule · <kbd>X</kbd> hız · <kbd>Boşluk</kbd> duraklat
          </p>
        </details>
      </div>
    </div>
  );
}
