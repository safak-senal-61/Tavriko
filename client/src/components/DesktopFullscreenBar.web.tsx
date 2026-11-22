import React, { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react-native';

const DESKTOP = '(min-width: 760px) and (any-pointer: fine)';
const FULLSCREEN_ERROR = 'Tam ekran açılamadı. Tarayıcının tam ekran seçeneğini kullanabilirsin.';

const styles = `
  .tavriko-fullscreen-bar {
    box-sizing: border-box;
    display: flex;
    flex: 0 0 auto;
    width: 100%;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    padding: 2px clamp(16px, 3vw, 48px);
    background: #160c29;
    border-bottom: 1px solid #3b2b55;
    color: #f5efff;
    font-family: Nunito_700Bold, system-ui, sans-serif;
  }

  .tavriko-fullscreen-button {
    box-sizing: border-box;
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid transparent;
    border-radius: 8px;
    color: inherit;
    background: transparent;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
  }

  .tavriko-fullscreen-button:hover {
    background: #2d1c46;
    border-color: #4a3567;
  }

  .tavriko-fullscreen-button:focus-visible {
    outline: 2px solid #ffc43d;
    outline-offset: -2px;
  }

  .tavriko-fullscreen-status {
    font-size: 13px;
    color: #ffe3a1;
  }
`;

export function DesktopFullscreenBar({ onFullscreenChange }: {
  onFullscreenChange: (active: boolean) => void;
}) {
  const [available, setAvailable] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP);
    const sync = () => {
      setAvailable(desktop.matches && document.fullscreenEnabled &&
        typeof document.documentElement.requestFullscreen === 'function' &&
        typeof document.exitFullscreen === 'function');
      const active = document.fullscreenElement === document.documentElement;
      setFullscreen(active);
      onFullscreenChange(active);
    };
    const handleFullscreenChange = () => {
      setError(false);
      sync();
    };
    sync();
    desktop.addEventListener('change', sync);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      desktop.removeEventListener('change', sync);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [onFullscreenChange]);

  if (!fullscreen && !available) return null;

  const toggle = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(false);
    try {
      // Fullscreen the document so navigation and body-level modal portals stay visible.
      if (document.fullscreenElement === document.documentElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
    }
  };

  const label = fullscreen ? 'Tam ekrandan çık' : 'Tam ekran';
  const Icon = fullscreen ? Minimize : Maximize;

  return (
    <div className="tavriko-fullscreen-bar">
      <style>{styles}</style>
      {error && <span className="tavriko-fullscreen-status" role="status">{FULLSCREEN_ERROR}</span>}
      <button
        type="button"
        className="tavriko-fullscreen-button"
        title={fullscreen ? 'Tam ekrandan çık (Esc)' : 'Tam ekrana geç'}
        onClick={toggle}
      >
        <span aria-hidden="true"><Icon size={17} color="#ffc43d" /></span>
        {label}
      </button>
    </div>
  );
}
