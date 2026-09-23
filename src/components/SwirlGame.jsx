import { useEffect, useRef, useState } from "react";
import CinnamonLoader from "./ui/CinnamonLoader";
import BunStreet, { StreetBuilding } from "./BunStreet";
import { COLLECTIBLES, COLLECTION_KEY, itemById, mergeCollection, readCollection, scoreMessage } from "../lib/bunCollection";
import { BIRD_X, HEIGHT, WIDTH, GAP, newGame, flap, stepGame, backgroundHouses } from "../lib/swirlGame";
import "./SwirlGame.css";

export default function SwirlGame() {
  const [game, setGame] = useState(newGame);
  const state = useRef(game);
  const [collection, setCollection] = useState(() => {
    try { return readCollection(localStorage); } catch { return []; }
  });
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [best, setBest] = useState(() => {
    try { return Math.max(0, Number(localStorage.getItem("swirl-flight-best")) || 0); }
    catch { return 0; }
  });
  const play = () => {
    const current = state.current;
    if (current.status === "over") return;
    setBest((previous) => Math.max(previous, current.score));
    state.current = flap(current);
    setGame(state.current);
  };
  useEffect(() => {
    let frame;
    let previous;
    const tick = (now) => {
      const dt = previous === undefined ? 0 : Math.min((now - previous) / 1000, 0.032);
      previous = now;
      if (state.current.status === "playing") {
        const previousDiscoveries = state.current.discoveries;
        state.current = stepGame(state.current, dt);
        if (state.current.discoveries !== previousDiscoveries) {
          const found = state.current.discoveries;
          setCollection((owned) => mergeCollection(owned, found));
        }
        setGame(state.current);
      }
      frame = requestAnimationFrame(tick);
    };
    const hide = () => {
      previous = undefined;
      if (document.hidden && state.current.status === "playing") {
        state.current = { ...state.current, status: "paused" };
        setGame(state.current);
      }
    };
    const key = (event) => {
      if (!["Space", "ArrowUp"].includes(event.code)) return;
      if (state.current.status === "over") {
        event.preventDefault();
        return;
      }
      if (event.repeat || event.target.closest("button, a, input, summary, textarea, select")) return;
      event.preventDefault();
      play();
    };
    frame = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("keydown", key);
    };
  }, []);
  useEffect(() => {
    try { localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection)); }
    catch { /* Gameplay and in-memory collection still work without storage. */ }
  }, [collection]);
  useEffect(() => {
    if (game.score > best) {
      try { localStorage.setItem("swirl-flight-best", String(game.score)); } catch { /* Storage is optional. */ }
    }
  }, [game.score, best]);
  const record = Math.max(best, game.score);
  function activate() {
    setBest(record);
    if (state.current.status === "over") state.current = newGame();
    play();
  }
  function openAlbum(event) {
    if (!event.currentTarget.open) return;
    if (state.current.status === "playing") {
      state.current = { ...state.current, status: "paused" };
      setGame(state.current);
    }
    try { localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection)); }
    catch { setStorageUnavailable(true); }
  }
  return (
    <main className="swirl-flight">
      <header className="flight-header"><a href="/">Back to the bakes</a><span>SWIRL GIRL ARCADE / 01</span></header>
      <div className="flight-title"><p>A LITTLE BREAK BETWEEN BAKES</p><h1>Bun Bounce</h1><p>A little bun's big adventure down Joo Chiat Road.</p></div>
      <div className="flight-scores"><span>SCORE <strong>{game.score}</strong></span><span>PERSONAL BEST <strong>{record}</strong></span></div>
      <div className="flight-board" role="group" aria-label="Bun Bounce game. Tap or press Space to flap." onPointerDown={(event) => {
        if (event.target.closest("button")) return;
        event.preventDefault(); play();
      }}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" className="flight-scene">
          <defs><pattern id="flight-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#fff" opacity=".2" /></pattern></defs>
          <rect width={WIDTH} height={HEIGHT} fill="#bfdcd5" /><rect width={WIDTH} height={HEIGHT} fill="url(#flight-grid)" />
          <g fill="#fff8e9" opacity=".75"><ellipse cx="60" cy="120" rx="70" ry="18" /><ellipse cx="340" cy="320" rx="85" ry="23" /></g>
          <BunStreet houses={backgroundHouses(game.elapsed, game.shops)} />
          {game.pipes.map((pipe) => <g key={pipe.id} fill="#a86139" stroke="#633e29" strokeWidth="3">
            <rect x={pipe.x} y="-10" width="60" height={pipe.top + 10} rx="5" />
            <rect x={pipe.x - 4} y={pipe.top - 22} width="68" height="22" rx="4" fill="#e4ad6d" />
            <rect x={pipe.x} y={pipe.top + GAP} width="60" height={HEIGHT} rx="5" />
            <rect x={pipe.x - 4} y={pipe.top + GAP} width="68" height="22" rx="4" fill="#e4ad6d" />
          </g>)}
          <path d="M0 551H400" stroke="#633e29" strokeWidth="18" />
          <g aria-label="Joo Chiat Road street sign">
            <path d="M325 500V545" stroke="#72847b" strokeWidth="3" />
            <rect x="271" y="481" width="108" height="23" rx="3" fill="#315c50" stroke="#fff8e9" strokeWidth="1.5" />
            <text x="325" y="496" textAnchor="middle" fill="#fff8e9" fontFamily="sans-serif" fontWeight="bold" fontSize="9">JOO CHIAT ROAD</text>
          </g>
        </svg>
        <div className="flight-bun" style={{ left: `${BIRD_X / WIDTH * 100}%`, top: `${game.y / HEIGHT * 100}%` }}><CinnamonLoader size="100%" /></div>
        {game.status !== "playing" && <div className="flight-overlay"><div>
          <p className="flight-kicker">{game.status === "over" ? "FRESHLY GROUNDED" : game.status === "paused" ? "TAKE A BREATHER" : "READY, STEADY, BAKE"}</p>
          <h2>{game.status === "over" ? scoreMessage(game.score) : game.status === "paused" ? "Flight paused" : "Down Joo Chiat Road."}</h2>
          {game.status === "over" ? <p><strong>{game.score} points</strong><br />Click Try again for another go.</p> : <p>Tap, click or press Space to flap.<br />Bounce past the shophouses. Avoid the boxes.</p>}
          <button onClick={activate}>{game.status === "over" ? "Try again" : game.status === "paused" ? "Resume flight" : "Start flying"}</button>
        </div></div>}
      </div>
      <p role="status" className="sr-only">{game.status === "over" ? `Game over. Score ${game.score}.` : game.status === "paused" ? "Game paused." : ""}</p>
      <p className="flight-hint">TAP / SPACE / UP ARROW <span>Best score stays on this device. No orders, no stakes.</span></p>
      <details className="bun-album" onToggle={openAlbum}>
        <summary><span>Joo Chiat collection</span><strong>{collection.length} / {COLLECTIBLES.length}</strong></summary>
        <p>Collect a special building as soon as it is fully on screen. First stop at 30 points, then every 10. Higher scores unlock rarer stops.</p>
        <p className="bun-save-note">{storageUnavailable ? "Storage is unavailable. This collection lasts for this visit only." : "Saved on this browser only, not a global account."}</p>
        <div className="bun-album-grid">{COLLECTIBLES.map((item) => {
          const owned = collection.includes(item.id);
          return <article key={item.id} className={`bun-collectible ${owned ? "is-collected" : "is-locked"} ${item.span > 1 ? "is-wide" : ""}`} data-collectible={item.id}>
            <svg viewBox={item.kind === "coffee" ? "-232 -8 324 232" : `-3 -8 ${(item.span || 1) * 86 + 6} 232`} aria-hidden="true"><StreetBuilding item={item} /></svg>
            <h3>{item.name}</h3><p>{owned ? "Collected" : `Find from ${item.threshold} points`}</p>
          </article>;
        })}</div>
      </details>
      <p className="bun-found" role="status">{game.discoveries.length ? `Spotted: ${itemById(game.discoveries.at(-1))?.name}` : "Collect the neighbourhood, one flight at a time."}</p>
    </main>
  );
}
