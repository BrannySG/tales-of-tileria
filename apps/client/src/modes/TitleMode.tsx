import { useEffect, useRef, useState } from 'react';
import { Application, Container } from 'pixi.js';
import { WispSystem } from '../render/WispSystem';
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../render/constants';
import { SoundSystem } from '../audio/SoundSystem';
import { loadGameFonts } from '../assets/fonts';
import { hasOnboarded } from '../onboarding';

const isTouchDevice = () =>
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

/**
 * The ethereal Title Screen (see CONTEXT.md): a dark field of drifting Wisps
 * under the game title, with a softly-pulsing "Click/Touch to Start" prompt. The
 * start gesture unlocks audio and routes new players into onboarding, returning
 * players into the game.
 */
export function TitleMode() {
  const hostRef = useRef<HTMLDivElement>(null);
  const soundRef = useRef<SoundSystem | null>(null);
  const startedRef = useRef(false);
  const [touch] = useState(isTouchDevice);

  useEffect(() => {
    void loadGameFonts();
    let app: Application | undefined;
    let wisps: WispSystem | undefined;
    let cancelled = false;
    soundRef.current = new SoundSystem();

    const fit = () => {
      const host = hostRef.current;
      if (!app || !host) return;
      const scale = Math.min(host.clientWidth / VIRTUAL_WIDTH, host.clientHeight / VIRTUAL_HEIGHT);
      app.canvas.style.width = `${Math.round(VIRTUAL_WIDTH * scale)}px`;
      app.canvas.style.height = `${Math.round(VIRTUAL_HEIGHT * scale)}px`;
    };

    void (async () => {
      const a = new Application();
      await a.init({
        width: VIRTUAL_WIDTH,
        height: VIRTUAL_HEIGHT,
        backgroundAlpha: 0,
        antialias: true,
        resolution: 1,
        autoDensity: false,
      });
      if (cancelled || !hostRef.current) {
        a.destroy(true, { children: true });
        return;
      }
      app = a;
      hostRef.current.appendChild(a.canvas);
      a.canvas.style.display = 'block';
      const stage = new Container();
      a.stage.addChild(stage);
      wisps = new WispSystem(stage, { count: 46 });
      a.ticker.add((ticker) => wisps?.update(Math.min(0.05, ticker.deltaMS / 1000)));
      fit();
    })();

    const ro = new ResizeObserver(fit);
    if (hostRef.current) ro.observe(hostRef.current);

    return () => {
      cancelled = true;
      ro.disconnect();
      app?.destroy(true, { children: true });
    };
  }, []);

  const start = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    soundRef.current?.unlock();
    window.location.hash = hasOnboarded() ? '/game' : '/onboarding';
  };

  return (
    <div
      className="title-screen"
      onPointerDown={start}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') start();
      }}
    >
      <div className="title-wisps" ref={hostRef} />
      <div className="title-content">
        <h1 className="title-name">
          Tales of <span>Tileria</span>
        </h1>
        <p className="title-prompt">{touch ? 'Touch to Start' : 'Click to Start'}</p>
      </div>
    </div>
  );
}
