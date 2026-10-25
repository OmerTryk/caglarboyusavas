import { useState } from 'react';
import type { Difficulty } from './sim/types';
import { Game } from './ui/Game';
import { Menu } from './ui/Menu';

const DIFF_KEY = 'cbs.difficulty';

function loadDifficulty(): Difficulty {
  try {
    const v = localStorage.getItem(DIFF_KEY);
    if (v === 'kolay' || v === 'normal' || v === 'zor' || v === 'imkansiz') return v;
  } catch {
    // Storage may be unavailable (private mode); fall back to the default.
  }
  return 'normal';
}

export function App() {
  const [screen, setScreen] = useState<'menu' | 'game'>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>(loadDifficulty);

  const pick = (d: Difficulty) => {
    setDifficulty(d);
    try {
      localStorage.setItem(DIFF_KEY, d);
    } catch {
      // Not critical.
    }
  };

  return screen === 'menu'
    ? <Menu difficulty={difficulty} onDifficulty={pick} onStart={() => setScreen('game')} />
    : <Game difficulty={difficulty} onExit={() => setScreen('menu')} />;
}
