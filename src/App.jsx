import React, { useEffect, useMemo, useState } from "react";
import PrivacySection from "./components/PrivacySection";
import FaqSection from "./components/FaqSection";
import Seo from "./components/Seo";
import StorySection from "./components/StorySection";
import LandingSection from "./components/LandingSection";
import MenuSection from "./components/MenuSection";
import PreorderModal from "./components/PreorderModal";
import ProcessSection from "./components/ProcessSection";
import SiteFooter from "./components/SiteFooter";
import InstagramReelSection from "./components/InstagramReelSection";
import OrderReceipt from "./components/OrderReceipt";
import { watchOrderRequest } from "./lib/orderReceipt";
import CinnamonLoader from "./components/ui/CinnamonLoader";
import StockPage from "./components/StockPage";
import BRAND from "./config/brand";
import { ALLERGEN_DISCLAIMER, FAQ, MENU, QUANTITY_OPTIONS } from "./config/products";
import {
  formatSgDate,
  fromSingaporeDateKey,
  getFollowingSaturday,
  getNearestOpenSaturday,
  isSaturdayOpen,
  toSingaporeDateKey,
} from "./lib/dates";
import useAnalytics from "./hooks/useAnalytics";
import useBodyScrollLock from "./hooks/useBodyScrollLock";
import useMenuSettings from "./hooks/useMenuSettings";
import useOrderSummary from "./hooks/useOrderSummary";
import usePreorderModalOpen from "./hooks/usePreorderModalOpen";
import useScrollReveal from "./hooks/useScrollReveal";
import { buildOrderRecord, submitOrderRequest } from "./lib/orderSubmission";

const SwirlGame = React.lazy(() => import("./components/SwirlGame"));
const miniGameEnabled = window.location.hostname.startsWith("test-") || ["swirlgirl.sg", "www.swirlgirl.sg", "localhost", "127.0.0.1"].includes(window.location.hostname);

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/minigame" && miniGameEnabled) {
    return <React.Suspense fallback={<p className="p-8">Loading Bun Bounce...</p>}><SwirlGame /></React.Suspense>;
  }
  if (path === "/stock") {
    return <StockPage isTestSite={window.location.hostname.startsWith("test-")} />;
  }

  return <BakesLandingPage />;
}

function BakesLandingPage() {
  const ribbonItems = [
    "Small-batch Saturday baking",
    "Pre-orders close Thursday 10pm",
    "Small-batch bakes in Singapore",
    "Reserve early - limited batch",
  ];
  const nextSaturday = getNearestOpenSaturday(new Date());
  const nextSaturdayKey = toSingaporeDateKey(nextSaturday);
  // The Worker chooses the current open batch. Do not briefly show a locally
  // guessed Saturday while the authoritative calendar snapshot is loading.
  const [activeBatchKey, setActiveBatchKey] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [receipt, setReceipt] = useState(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem("swirl-order-receipt") || "null");
      if (!stored?.id || !stored?.message) return null;
      return { ...stored, status: stored.status === "pending" ? "delayed" : stored.status };
    } catch { return null; }
  });
  const [showReceipt, setShowReceipt] = useState(window.location.hash === "#receipt");
  useEffect(() => {
    if (receipt) {
      try { sessionStorage.setItem("swirl-order-receipt", JSON.stringify(receipt)); } catch { /* Receipt remains available in memory. */ }
    }
  }, [receipt]);
  useEffect(() => {
    const onHashChange = () => setShowReceipt(window.location.hash === "#receipt");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const [showRibbon, setShowRibbon] = useState(true);

  useEffect(() => {
    const updateRibbonVisibility = () => {
      const menu = document.getElementById("menu");
      setShowRibbon(!menu || menu.getBoundingClientRect().top > 120);
    };

    updateRibbonVisibility();
    window.addEventListener("scroll", updateRibbonVisibility, { passive: true });
    window.addEventListener("resize", updateRibbonVisibility);

    return () => {
      window.removeEventListener("scroll", updateRibbonVisibility);
      window.removeEventListener("resize", updateRibbonVisibility);
    };
  }, []);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    bakeWindow: nextSaturdayKey,
    delivery: BRAND.deliveryOptions[1],
    area: BRAND.pickupAreas[0],
    address: "",
    pickupTime: BRAND.pickupWindows[0],
    bananaChocolateChips: false,
    notes: "",
    items: Object.fromEntries(MENU.map((item) => [item.id, 0])),
  });

  const { isOpeningModal, openingTriggerId, handleOpenPreorder } =
    usePreorderModalOpen(setForm, setModalOpen);
  const {
    menu,
    status: menuStatus,
    retry: retryMenu,
    batchKey: resolvedBatchKey,
    calendar,
  } = useMenuSettings(MENU, activeBatchKey);
  const orderableMenu = useMemo(() => menu.filter((item) => item.available !== false), [menu]);
  const hasCurrentPrices = orderableMenu.every(
    (item) => typeof item.priceSgd === "number" && Number.isFinite(item.priceSgd) && item.priceSgd > 0
  );
  const orderForm = useMemo(() => {
    const items = { ...form.items };

    menu.forEach((item) => {
      const currentQuantity = Number(items[item.id] || 0);
      const maxQuantity = item.quantityOptions?.at(-1) || QUANTITY_OPTIONS.at(-1) || 0;

      if (item.available === false) {
        items[item.id] = 0;
      } else if (currentQuantity > maxQuantity) {
        items[item.id] = maxQuantity;
      }
    });

    return { ...form, items };
  }, [form, menu]);

  const selectedBatchKey = menuStatus === "ready" && resolvedBatchKey ? resolvedBatchKey : "";
  const selectedBakeDate = selectedBatchKey ? fromSingaporeDateKey(selectedBatchKey) : null;
  const isCurrentBatchSoldOut =
    menuStatus === "ready" && menu.length > 0 && menu.every((item) => item.available === false);
  const hasCalendar = calendar.length > 0;
  const followingBatchKey = selectedBatchKey
    ? calendar.find((entry) => entry.open && entry.date > selectedBatchKey)?.date ||
      (hasCalendar ? "" : toSingaporeDateKey(getFollowingSaturday(selectedBakeDate || nextSaturday)))
    : "";
  const isSelectedBakeOpen = selectedBakeDate ? isSaturdayOpen(selectedBakeDate, new Date()) : false;
  const displayBakeWindow = selectedBakeDate ? formatSgDate(selectedBakeDate) : "";

  const {
    itemsTotal,
    addOnTotal,
    deliveryFee,
    estimatedTotal,
    isDeliveryEligible,
    hasSelectedItems,
    waMessage,
    money,
  } = useOrderSummary({
    form: { ...orderForm, bakeWindow: displayBakeWindow },
    menu: orderableMenu,
    brandName: BRAND.name,
    waNumberE164: BRAND.waNumberE164,
    deliveryMinimumSgd: BRAND.deliveryMinimumSgd,
    deliveryFeeSgd: BRAND.deliveryFeeSgd,
  });
  const hasRequiredContactDetails = Boolean(form.name.trim() && form.phone.trim());
  const isDeliverySelection = form.delivery.toLowerCase().includes("delivery");
  const hasRequiredFulfilmentDetails = isDeliverySelection
    ? Boolean(form.address.trim())
    : Boolean(form.pickupTime.trim());

  useBodyScrollLock(modalOpen);
  useScrollReveal();
  useAnalytics();

  const isHeaderLoading = isOpeningModal && openingTriggerId === "header-primary";

  const basketQuantity = orderableMenu.reduce((total, item) => total + Number(orderForm.items[item.id] || 0), 0);
  const openHeaderPreorder = () => {
    if (!hasSelectedItems) {
      document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    handleOpenPreorder(selectedBatchKey, "header-primary");
  };
  const showFollowingBatch = () => {
    if (!followingBatchKey) return;

    setForm((current) => ({
      ...current,
      bakeWindow: followingBatchKey,
      items: Object.fromEntries(MENU.map((item) => [item.id, 0])),
    }));
    setActiveBatchKey(followingBatchKey);
  };

  const closePreorderModal = () => setModalOpen(false);

  const handleOrderIntent = (message, turnstileToken) => {
    const order = buildOrderRecord({
      form: { ...orderForm, bakeWindow: selectedBatchKey },
      menu: orderableMenu,
      estimatedTotal,
      moneyFormatter: money,
    });
    const id = crypto.randomUUID();
    setReceipt({
      ...order, id, message, status: "pending", orderNumber: "",
      bakeLabel: displayBakeWindow, itemsTotal: money(itemsTotal),
      deliveryFee: money(deliveryFee), whatsappOpened: false,
    });
    setModalOpen(false);
    setShowReceipt(true);
    window.history.pushState(null, "", "#receipt");
    window.scrollTo(0, 0);
    setForm((current) => ({
      ...current, items: {}, bananaChocolateChips: false,
      notes: "", address: "", delivery: BRAND.deliveryOptions[1],
    }));
    // The request runs once. Timeouts never retry a possibly saved order.
    watchOrderRequest(submitOrderRequest(id, order, turnstileToken), (update) => {
      setReceipt((current) => current?.id === id ? { ...current, ...update } : current);
    });
  };

  if (showReceipt && receipt) {
    return <OrderReceipt receipt={receipt} brand={BRAND}
      onOpenWhatsApp={() => setReceipt((current) => ({ ...current, whatsappOpened: true }))}
      onBrowse={() => {
        setShowReceipt(false);
        window.history.pushState(null, "", "#menu");
        requestAnimationFrame(() => document.getElementById("menu")?.scrollIntoView());
      }}
    />;
  }

  return (
    <div className="min-h-screen bg-cream text-ink">
      <Seo brand={BRAND} menu={menu} faq={FAQ} />
      <div className="sticky top-0 z-40">
        <div className={`overflow-hidden transition-[max-height,opacity] duration-300 ${showRibbon ? "max-h-24 opacity-100" : "pointer-events-none max-h-0 opacity-0"}`}>
          <div className="ribbon flex min-h-[60px] items-center border-b border-line bg-[#F7EBDD] sm:min-h-[88px]">
            <div className="ribbon-track py-2 text-xl font-medium text-inkMuted sm:text-3xl">
              {[0, 1, 2, 3].map((dupIdx) => (
                <div className="ribbon-group" aria-hidden={dupIdx > 0} key={dupIdx}>
                  {ribbonItems.map((item) => (
                    <span className="ribbon-item" key={`${dupIdx}-${item}`}>
                      <span>{item}</span>
                      <span
                        className="inline-flex flex-none items-center justify-center text-brandBrown"
                        aria-hidden="true"
                      >
                        <span className="inline-flex h-8 w-8 flex-none items-center justify-center sm:hidden">
                          <CinnamonLoader size={32} />
                        </span>
                        <span className="hidden h-12 w-12 flex-none items-center justify-center sm:inline-flex">
                          <CinnamonLoader size={48} />
                        </span>
                      </span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <header className="border-b border-line bg-surface/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full sm:h-10 sm:w-10">
                <img
                  src="/logo.webp"
                  alt="Swirl Girl logo"
                  className="h-full w-full object-cover"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold leading-none">{BRAND.name}</div>
                <div className="truncate text-xs text-inkMuted">{BRAND.originLabel}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="#menu"
                className="hidden sm:inline-flex rounded-xl px-3 py-2 text-sm text-inkMuted hover:bg-[#F1E8DF]"
              >
                Menu
              </a>
              <a
                href="#how"
                className="hidden sm:inline-flex rounded-xl px-3 py-2 text-sm text-inkMuted hover:bg-[#F1E8DF]"
              >
                Batch process
              </a>
              <a
                href="#story"
                className="hidden sm:inline-flex rounded-xl px-3 py-2 text-sm text-inkMuted hover:bg-[#F1E8DF]"
              >
                About
              </a>
              {receipt ? <button type="button" className="rounded-xl px-2 py-2 text-xs text-brandBrown" onClick={() => {
                setShowReceipt(true);
                window.history.pushState(null, "", "#receipt");
                window.scrollTo(0, 0);
              }}>View receipt</button> : null}
              <button
                onClick={openHeaderPreorder}
                disabled={isHeaderLoading}
                className="relative inline-flex touch-manipulation items-center whitespace-nowrap rounded-button bg-brandBrown px-3 py-2 text-xs font-medium text-white shadow-soft transition-all duration-200 hover:-translate-y-[1px] hover:shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCinnamon/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:translate-y-0 disabled:shadow-soft sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <span className={isHeaderLoading ? "opacity-0" : "opacity-100"}>
                  {hasSelectedItems ? "View order" : "Choose your bakes"}
                </span>
                {isHeaderLoading ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <CinnamonLoader size={18} className="text-white" />
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </header>
      </div>

      {isOpeningModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-cream/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <CinnamonLoader size={80} className="text-brandBrown" />
            <div className="text-sm font-medium text-inkMuted">Preparing your preorder...</div>
          </div>
        </div>
      ) : null}

      <main className="space-y-6 pb-24 sm:space-y-10 sm:pb-24">
        <LandingSection brand={BRAND} batchDate={selectedBakeDate} batchLabel={displayBakeWindow} />

        <MenuSection
          menu={menu}
          quantityOptions={QUANTITY_OPTIONS}
          form={orderForm}
          setForm={setForm}
          menuStatus={menuStatus}
          allergenDisclaimer={ALLERGEN_DISCLAIMER}
          onRetry={retryMenu}
          batchLabel={displayBakeWindow}
          showFollowingBatch={Boolean(followingBatchKey) && isCurrentBatchSoldOut}
          followingBatchLabel={followingBatchKey ? formatSgDate(fromSingaporeDateKey(followingBatchKey)) : ""}
          onShowFollowingBatch={showFollowingBatch}
          canOrderFollowingBatch={Boolean(followingBatchKey)}
        />

        <InstagramReelSection brand={BRAND} />

        <ProcessSection
          brand={BRAND}
          brandColors={BRAND.colors}
          deliveryOptions={BRAND.deliveryOptions}
        />

        <div id="story">
          <StorySection brand={BRAND} />
        </div>

        <FaqSection faq={FAQ} />

        <PrivacySection brand={BRAND} />

        {miniGameEnabled && <section className="rounded-3xl border border-line bg-surface p-6 sm:p-8" aria-label="Mini-game">
          <p className="text-xs uppercase tracking-[0.2em] text-inkMuted">Mini-game</p>
          <a href="/minigame" target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-between gap-4 text-2xl text-brandBrown">
            <span>Play Bun Bounce <span className="mt-1 block text-sm text-inkMuted">A flying cinnamon swirl. Opens in a new tab.</span></span>
            <CinnamonLoader size={56} />
          </a>
        </section>}

      </main>

      <SiteFooter brand={BRAND} />
      {hasSelectedItems && !modalOpen && !showReceipt ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <button type="button" onClick={openHeaderPreorder} className="mx-auto flex w-full max-w-2xl items-center justify-between rounded-button bg-brandBrown px-5 py-3 font-semibold text-white">
            <span>View order · {basketQuantity} {basketQuantity === 1 ? "item" : "items"}</span>
            <span>{money(itemsTotal)}</span>
          </button>
        </div>
      ) : null}

      <PreorderModal
        open={modalOpen}
        onClose={closePreorderModal}
        form={{ ...orderForm, bakeWindow: selectedBatchKey }}
        setForm={setForm}
        estimatedTotal={estimatedTotal}
        itemsTotal={itemsTotal}
        addOnTotal={addOnTotal}
        deliveryFee={deliveryFee}
        isDeliveryEligible={isDeliveryEligible}
        waMessage={waMessage}
        bakeWindowLabel={displayBakeWindow}
        hasSelectedItems={hasSelectedItems}
        canSubmitOrder={
          hasSelectedItems &&
          isSelectedBakeOpen &&
          hasRequiredContactDetails &&
          hasRequiredFulfilmentDetails &&
          menuStatus === "ready" &&
          hasCurrentPrices &&
          (!form.delivery.toLowerCase().includes("delivery") || isDeliveryEligible)
        }
        hasRequiredContactDetails={hasRequiredContactDetails}
        hasRequiredFulfilmentDetails={hasRequiredFulfilmentDetails}
        isBakeWindowOpen={isSelectedBakeOpen}
        menuStatus={menuStatus}
        menu={menu}
        quantityOptions={QUANTITY_OPTIONS}
        allergenDisclaimer={ALLERGEN_DISCLAIMER}
        money={money}
        brand={BRAND}
        onOrderIntent={handleOrderIntent}
      />
    </div>
  );
}
