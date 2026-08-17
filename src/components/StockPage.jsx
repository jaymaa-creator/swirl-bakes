import { useEffect, useRef, useState } from "react";
import CinnamonLoader from "./ui/CinnamonLoader";

const SWIPE_THRESHOLD = 88;
const STOCK_PASSWORD = "chonky";
const STOCK_ACCESS_KEY = "swirl-girl-stock-access";

function formatQuantity(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, "");
}

function stockStorageKey(shopping) {
  return `swirl-girl-stock:${shopping.batchKey || "current"}:${shopping.generatedAt || "latest"}`;
}

function groupByLocation(items) {
  return [...items]
    .sort((a, b) => (a.location || "Other ingredients").localeCompare(b.location || "Other ingredients") || a.name.localeCompare(b.name))
    .reduce((groups, item) => {
      const location = item.location || "Other ingredients";
      const group = groups.find((entry) => entry.location === location);
      if (group) group.items.push(item);
      else groups.push({ location, items: [item] });
      return groups;
    }, []);
}

export default function StockPage({ isTestSite }) {
  const [hasStockAccess, setHasStockAccess] = useState(() => {
    try {
      return window.sessionStorage.getItem(STOCK_ACCESS_KEY) === "granted";
    } catch {
      return false;
    }
  });
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [status, setStatus] = useState("loading");
  const [shopping, setShopping] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [history, setHistory] = useState([]);
  const [showShoppingList, setShowShoppingList] = useState(false);
  const pointerStart = useRef(null);
  const feedbackTimer = useRef(null);

  useEffect(() => {
    if (!isTestSite || !hasStockAccess) return undefined;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);

    fetch(`/api/stock?refresh=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || `Stock request failed (${response.status})`);
        }
        return data;
      })
      .then((data) => {
        const nextShopping = data?.shopping;
        if (!nextShopping || !Array.isArray(nextShopping.items)) {
          throw new Error("Stock data is unavailable");
        }

        setShopping(nextShopping);
        try {
          const stored = window.localStorage.getItem(stockStorageKey(nextShopping));
          setDecisions(stored ? JSON.parse(stored) : {});
        } catch {
          setDecisions({});
        }
        setStatus("ready");
      })
      .catch((error) => {
        setErrorMessage(error.message || "Stock list is temporarily unavailable");
        setStatus("error");
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [hasStockAccess, isTestSite]);

  useEffect(() => {
    if (!shopping || status !== "ready") return;
    window.localStorage.setItem(stockStorageKey(shopping), JSON.stringify(decisions));
  }, [decisions, shopping, status]);

  useEffect(() => () => window.clearTimeout(feedbackTimer.current), []);

  if (!isTestSite) {
    return <AccessMessage title="This stock page is only available on the test site." />;
  }

  const unlockStockPage = (event) => {
    event.preventDefault();
    if (password !== STOCK_PASSWORD) {
      setPasswordError(true);
      return;
    }

    try {
      window.sessionStorage.setItem(STOCK_ACCESS_KEY, "granted");
    } catch {
      // Continue even if the browser blocks session storage.
    }
    setPassword("");
    setPasswordError(false);
    setHasStockAccess(true);
  };

  if (!hasStockAccess) {
    return (
      <main className="stock-page">
        <section className="stock-message stock-access" aria-labelledby="stock-access-title">
          <img src="/logo.webp" alt="Swirl Girl" />
          <span className="stock-eyebrow">Kitchen access</span>
          <h1 id="stock-access-title">Stock check</h1>
          <p>Enter the kitchen password to continue.</p>
          <form onSubmit={unlockStockPage}>
            <label className="sr-only" htmlFor="stock-password">Kitchen password</label>
            <input
              id="stock-password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordError(false);
              }}
              autoComplete="current-password"
              autoFocus
              required
            />
            {passwordError ? <p className="stock-access__error" role="alert">That password is not right.</p> : null}
            <button type="submit">Continue</button>
          </form>
        </section>
      </main>
    );
  }

  if (status === "loading") {
    return (
      <main className="stock-page">
        <div className="stock-loading" role="status">
          <CinnamonLoader size={58} className="text-brandBrown" />
          <p>Preparing this week&apos;s ingredient list...</p>
        </div>
      </main>
    );
  }

  if (status === "error" || !shopping) {
    return <AccessMessage title="We could not load the stock list." detail={errorMessage} retry />;
  }

  const items = shopping.items;
  const hasChecklist = shopping.generatedAt && shopping.batchKey;
  const pendingItems = items.filter((item) => !decisions[item.id]);
  const activeItem = pendingItems[0];
  const buyItems = items.filter((item) => decisions[item.id] === "buy");
  const reviewGroups = groupByLocation(items);
  const shoppingGroups = groupByLocation(buyItems);
  const enoughCount = items.filter((item) => decisions[item.id] === "enough").length;
  const decide = (item, decision) => {
    if (!item || feedback) return;
    setSwipeOffset(0);
    setCopied(false);
    setFeedback({ decision, itemName: item.name });
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => {
      setDecisions((current) => ({ ...current, [item.id]: decision }));
      setHistory((current) => [...current, item.id]);
      setFeedback(null);
    }, 520);
  };
  const reset = () => {
    window.clearTimeout(feedbackTimer.current);
    setFeedback(null);
    setHistory([]);
    setDecisions({});
    setShowShoppingList(false);
    setCopied(false);
  };
  const goBack = () => {
    const previousId = history.at(-1);
    if (!previousId || feedback) return;
    setDecisions((current) => {
      const next = { ...current };
      delete next[previousId];
      return next;
    });
    setHistory((current) => current.slice(0, -1));
    setShowShoppingList(false);
    setCopied(false);
  };
  const changeDecision = (itemId) => {
    if (feedback) return;
    setDecisions((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
    setHistory((current) => current.filter((id) => id !== itemId));
    setShowShoppingList(false);
    setCopied(false);
  };
  const copyList = async () => {
    const lines = [
      `Swirl Girl shopping list (${shopping.batchKey})`,
      "",
      ...(shoppingGroups.length
        ? shoppingGroups.flatMap((group) => [
          `${group.location}:`,
          ...group.items.map((item) => `- ${item.name}: ${formatQuantity(item.quantity)} ${item.unit}`.trim()),
          "",
        ])
        : ["Nothing to buy - the kitchen is stocked."]),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const copyKitchenCheck = async () => {
    const formatDecisionSection = (title, decision) => {
      const groups = groupByLocation(items.filter((item) => decisions[item.id] === decision));

      if (!groups.length) {
        return [title, "- None", ""];
      }

      return [
        title,
        ...groups.flatMap((group) => [
          `${group.location}:`,
          ...group.items.map((item) => `- ${item.name}: ${formatQuantity(item.quantity)} ${item.unit || "units"}`),
          "",
        ]),
      ];
    };

    const lines = [
      `Swirl Girl kitchen check (${shopping.batchKey})`,
      "",
      ...formatDecisionSection("HAVE ENOUGH", "enough"),
      ...formatDecisionSection("NEED TO BUY", "buy"),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const pointerDown = (event) => {
    if (!event.isPrimary) return;
    pointerStart.current = event.clientX;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const pointerMove = (event) => {
    if (!event.isPrimary || pointerStart.current === null) return;
    setSwipeOffset(Math.max(-120, Math.min(120, event.clientX - pointerStart.current)));
  };
  const clearSwipe = () => {
    pointerStart.current = null;
    setSwipeOffset(0);
  };
  const pointerUp = (event) => {
    if (!activeItem || pointerStart.current === null) return;
    const movement = event.clientX - pointerStart.current;
    clearSwipe();
    if (movement >= SWIPE_THRESHOLD) decide(activeItem, "enough");
    if (movement <= -SWIPE_THRESHOLD) decide(activeItem, "buy");
  };
  const handleCardKeyDown = (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowright" || key === "r") {
      event.preventDefault();
      decide(activeItem, "enough");
    }
    if (key === "arrowleft" || key === "l") {
      event.preventDefault();
      decide(activeItem, "buy");
    }
  };

  return (
    <main className="stock-page">
      <div className="stock-shell">
        <header className="stock-header">
          <a href="/" className="stock-brand" aria-label="Back to Swirl Girl">
            <img src="/logo.webp" alt="" />
            <span>
              <strong>Swirl Girl</strong>
              <small>Kitchen stock</small>
            </span>
          </a>
          <span className="stock-batch">Bake {shopping.batchKey}</span>
        </header>

        <section className="stock-intro">
          <span className="stock-eyebrow">Kitchen check</span>
          <h1>Do we have enough?</h1>
          <p>Swipe right if it&apos;s in the kitchen. Swipe left to add it to the shopping list.</p>
        </section>

        {shopping.warnings?.length ? (
          <aside className="stock-warning">
            <strong>One quick setup task</strong>
            {shopping.warnings.map((warning) => <span key={warning}>{warning}</span>)}
          </aside>
        ) : null}

        {!hasChecklist || (!items.length && shopping.warnings?.length) ? (
          <section className="stock-finished">
            <span className="stock-finished__mark">!</span>
            <span className="stock-eyebrow">Checklist needs attention</span>
            <h2>We need the recipe details first.</h2>
            <p>Run the menu snapshot sync after checking the product recipe mapping.</p>
          </section>
        ) : activeItem ? (
          <section className="stock-card-area" aria-live="polite">
            <div className="stock-progress" aria-label={`${items.length - pendingItems.length} of ${items.length} checked`}>
              <span style={{ width: `${((items.length - pendingItems.length) / Math.max(items.length, 1)) * 100}%` }} />
            </div>
            <article
              className={`stock-card${swipeOffset <= -SWIPE_THRESHOLD ? " stock-card--buy" : swipeOffset >= SWIPE_THRESHOLD ? " stock-card--enough" : ""}${feedback ? " stock-card--feedback" : ""}`}
              style={swipeOffset ? { transform: `translateX(${swipeOffset}px) rotate(${swipeOffset / 30}deg)` } : undefined}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={clearSwipe}
              onKeyDown={handleCardKeyDown}
              tabIndex={0}
              aria-label="Swipe right or press Right Arrow or R if you have enough. Swipe left or press Left Arrow or L if you need to buy."
            >
              <span className="stock-card__tag">Needed for {activeItem.forProducts?.join(" + ") || "this bake"}</span>
              <span className="stock-card__location">Check: {activeItem.location || "Other ingredients"}</span>
              <h2>{activeItem.name}</h2>
              <p className="stock-card__quantity">{formatQuantity(activeItem.quantity)} <span>{activeItem.unit || "units"}</span></p>
              <div className="stock-card__gesture" aria-hidden="true">
                <span className={swipeOffset < -24 ? "is-active" : ""}>Left: buy it</span>
                <span className={swipeOffset > 24 ? "is-active" : ""}>Right: we have it</span>
              </div>
              {feedback ? (
                <div className={`stock-card__feedback stock-card__feedback--${feedback.decision}`} role="status">
                  <span aria-hidden="true">{feedback.decision === "enough" ? "✓" : "×"}</span>
                  <strong>{feedback.decision === "enough" ? "We have it" : "Need to buy"}</strong>
                  <small>{feedback.itemName}</small>
                </div>
              ) : null}
            </article>
            <div className="stock-actions">
              <button type="button" className="stock-action stock-action--buy" disabled={Boolean(feedback)} onClick={() => decide(activeItem, "buy")}>Need to buy</button>
              <button type="button" className="stock-action stock-action--enough" disabled={Boolean(feedback)} onClick={() => decide(activeItem, "enough")}>We have enough</button>
            </div>
            {history.length ? <button type="button" className="stock-back" onClick={goBack}>← Go back</button> : null}
          </section>
        ) : !showShoppingList ? (
          <section className="stock-finished stock-review">
            <span className="stock-finished__mark">✓</span>
            <span className="stock-eyebrow">Quick review</span>
            <h2>Check your answers.</h2>
            <p>Make any changes before we build the shopping list.</p>
            <div className="stock-review__list">
              {reviewGroups.map((group) => (
                <section className="stock-location" key={group.location}>
                  <h3>{group.location}</h3>
                  {group.items.map((item) => {
                    const decision = decisions[item.id];
                    const haveEnough = decision === "enough";
                    return (
                      <div className={`stock-review__item stock-review__item--${decision}`} key={item.id}>
                        <span className="stock-review__decision" aria-hidden="true">{haveEnough ? "✓" : "×"}</span>
                        <span><strong>{item.name}</strong><small>{formatQuantity(item.quantity)} {item.unit || "units"} - {haveEnough ? "Have it" : "Buy it"}</small></span>
                        <button type="button" onClick={() => changeDecision(item.id)}>Change</button>
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
    <div className="stock-review__actions">
      <button type="button" className="stock-copy stock-copy--secondary" onClick={copyKitchenCheck}>
        {copied ? "Kitchen check copied" : "Copy kitchen check"}
      </button>
      <button type="button" className="stock-copy" onClick={() => { setCopied(false); setShowShoppingList(true); }}>See shopping list</button>
    </div>
  </section>
        ) : (
          <section className="stock-finished">
            <span className="stock-finished__mark">✓</span>
            <span className="stock-eyebrow">Kitchen check complete</span>
            <h2>{items.length ? (buyItems.length ? "Ready to shop." : "You are all stocked up.") : "No ingredients needed yet."}</h2>
            <p>{items.length ? `${enoughCount} ingredient${enoughCount === 1 ? "" : "s"} already covered.` : "There are no orders to prepare for this bake yet."}</p>
            <div className="stock-list">
              {shoppingGroups.length ? shoppingGroups.map((group) => (
                <section className="stock-location" key={group.location}>
                  <h3>{group.location}</h3>
                  {group.items.map((item) => (
                    <div key={item.id}><strong>{item.name}</strong><span>{formatQuantity(item.quantity)} {item.unit}</span></div>
                  ))}
                </section>
              )) : <span>No shopping needed for this batch.</span>}
            </div>
            {items.length ? <button type="button" className="stock-copy" onClick={copyList}>{copied ? "Copied" : "Copy shopping list"}</button> : null}
            {history.length ? <button type="button" className="stock-back" onClick={goBack}>← Go back</button> : null}
            {items.length ? <button type="button" className="stock-reset" onClick={reset}>Start again</button> : null}
          </section>
        )}
      </div>
    </main>
  );
}

function AccessMessage({ title, detail = "", retry = false }) {
  return (
    <main className="stock-page">
      <div className="stock-message">
        <img src="/logo.webp" alt="Swirl Girl" />
        <h1>{title}</h1>
        {detail ? <p>{detail}</p> : null}
        {retry ? <button type="button" onClick={() => window.location.reload()}>Try again</button> : <a href="/">Back to Swirl Girl</a>}
      </div>
    </main>
  );
}
