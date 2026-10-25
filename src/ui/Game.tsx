import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { startLoop, type LoopHandle } from '../game/loop';
import type { ViewState } from '../render/renderer';
import { AI_PARAMS, createAI } from '../sim/ai';
import { turretsOfAge, unitsOfAge } from '../sim/data';
import type { Command, Difficulty, Stance, World } from '../sim/types';
import { createWorld, issue } from '../sim/world';
import { BottomPanel, TopBar } from './Hud';
import { Result } from './Result';

interface Props {
  difficulty: Difficulty;
  onExit: () => void;
}

function newMatch(difficulty: Difficulty) {
  const seed = (Math.random() * 2 ** 31) | 0;
  return {
    world: createWorld(seed, [1, AI_PARAMS[difficulty].incomeMult]),
    ai: createAI(1, difficulty),
  };
}

const STANCE_KEYS: Record<string, Stance> = { q: 'saldir', w: 'tut', e: 'geri' };

export function Game({ difficulty, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const match = useRef(newMatch(difficulty));
  const loop = useRef<LoopHandle | null>(null);
  const view = useRef<ViewState>({ targeting: false, pointerX: null });
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [targeting, setTargeting] = useState(false);
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const speedRef = useRef(speed);
  const pausedRef = useRef(paused);
  speedRef.current = speed;
  pausedRef.current = paused;
  view.current.targeting = targeting;

  useEffect(() => {
    const canvas = canvasRef.current!;
    loop.current = startLoop({
      canvas,
      getWorld: () => match.current.world,
      ais: () => [match.current.ai],
      getSpeed: () => speedRef.current,
      isPaused: () => pausedRef.current,
      view: view.current,
    });
    const hud = window.setInterval(rerender, 100);
    return () => {
      loop.current?.stop();
      window.clearInterval(hud);
    };
  }, []);

  const world: World = match.current.world;
  if (import.meta.env.DEV) (window as unknown as { __cbs: unknown }).__cbs = match.current;

  const send = useCallback((cmd: Command) => {
    issue(match.current.world, 0, cmd);
    rerender();
  }, []);

  const toggleTargeting = useCallback(() => {
    if (match.current.world.players[0].powerCd > 0) return;
    setTargeting((t) => !t);
  }, []);

  const restart = useCallback(() => {
    match.current = newMatch(difficulty);
    setTargeting(false);
    setPaused(false);
    rerender();
  }, [difficulty]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const w = match.current.world;
      const me = w.players[0];
      const k = e.key.toLowerCase();
      if (k >= '1' && k <= '9') {
        const def = unitsOfAge(me.age)[Number(k) - 1];
        if (def) send({ type: 'train', unitId: def.id });
      } else if (STANCE_KEYS[k]) {
        send({ type: 'stance', stance: STANCE_KEYS[k] });
      } else if (k === 'f') {
        toggleTargeting();
      } else if (k === 'r') {
        send({ type: 'rally' });
      } else if (k === 'u') {
        send({ type: 'ageUp' });
      } else if (k === 't' || k === 'y') {
        const t = turretsOfAge(me.age)[k === 't' ? 0 : 1];
        send({ type: 'buyTurret', turretId: t.id });
      } else if (k === 'x') {
        setSpeed((s) => (s % 3) + 1);
      } else if (k === ' ' || k === 'p') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (k === 'escape') {
        setTargeting(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [send, toggleTargeting]);

  const onPointerMove = (e: React.PointerEvent) => {
    if (loop.current) view.current.pointerX = loop.current.renderer.toWorldX(e.clientX);
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    if (!targeting || !loop.current) return;
    const x = loop.current.renderer.toWorldX(e.clientX);
    send({ type: 'power', x });
    setTargeting(false);
  };

  return (
    <div className="game">
      <div className="field">
        <canvas
          ref={canvasRef}
          className={targeting ? 'targeting' : ''}
          onPointerMove={onPointerMove}
          onPointerLeave={() => (view.current.pointerX = null)}
          onClick={onCanvasClick}
        />
        <TopBar
          world={world}
          speed={speed}
          paused={paused}
          onSpeed={setSpeed}
          onPause={() => setPaused((p) => !p)}
          onExit={onExit}
        />
        {targeting && <div className="hint">Hedefe tıkla · iptal için Esc</div>}
        <div className="rotate-hint">↻ Daha geniş bir savaş alanı için telefonunu yatay çevir</div>
        {paused && world.winner === null && (
          <div className="overlay soft" onClick={() => setPaused(false)}>
            <div className="paused">Duraklatıldı<small>devam etmek için tıkla veya Boşluk</small></div>
          </div>
        )}
        {world.winner !== null && <Result world={world} difficulty={difficulty} onRestart={restart} onExit={onExit} />}
      </div>
      <BottomPanel world={world} targeting={targeting} send={send} onTarget={toggleTargeting} />
    </div>
  );
}
