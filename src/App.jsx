import React, { useMemo, useState } from "react";
import ConfirmationSection from "./components/ConfirmationSection";
import BananaBreadGallery from "./components/BananaBreadGallery";
import PrivacySection from "./components/PrivacySection";
import FaqSection from "./components/FaqSection";
import Seo from "./components/Seo";
import StorySection from "./components/StorySection";
import LandingSection from "./components/LandingSection";
import MenuSection from "./components/MenuSection";
import PreorderModal from "./components/PreorderModal";
import ProcessSection from "./components/ProcessSection";
import ReserveCtaSection from "./components/ReserveCtaSection";
import SiteFooter from "./components/SiteFooter";
import InstagramReelSection from "./components/InstagramReelSection";
import WhatsAppHandoffNotice from "./components/WhatsAppHandoffNotice";
import CinnamonLoader from "./components/ui/CinnamonLoader";
import BRAND from "./config/brand";
import { ALLERGEN_DISCLAIMER, FAQ, MENU, QUANTITY_OPTIONS } from "./config/products";
import {
  formatSgDate,
  fromSingaporeDateKey,
  getNearestOpenSaturday,
  getOpenSaturdays,
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

export default function BakesLandingPage() {
  const ribbonItems = [
    "Fresh cinnamon rolls every Saturday",
    "Pre-orders close Thursday 10pm",
    "Small-batch bakes in Singapore",
    "Reserve early - limited batch",
  ];
  const saturdayOptions = useMemo(
    () =>
      getOpenSaturdays(2, new Date()).map((date) => ({
        value: toSingaporeDateKey(date),
        label: formatSgDate(date),
        isOpen: isSaturdayOpen(date, new Date()),
      })),
    []
  );
  const defaultBakeDate = toSingaporeDateKey(getNearestOpenSaturday(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [hasStartedOrder, setHasStartedOrder] = useState(false);
  const [whatsappHandoffLink, setWhatsappHandoffLink] = useState("");
  const [whatsappOrderNumber, setWhatsappOrderNumber] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    bakeWindow: defaultBakeDate,
    delivery: BRAND.deliveryOptions[0],
    area: BRAND.pickupAreas[0],
    address: "",
    pickupTime: "Morning",
    notes: "",
    items: Object.fromEntries(MENU.map((item) => [item.id, 0])),
  });

  const { isOpeningModal, openingTriggerId, handleOpenPreorder } =
    usePreorderModalOpen(setForm, setModalOpen);
  const { menu, status: menuStatus } = useMenuSettings(MENU);
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

  const fallbackBakeWindow = saturdayOptions[0]?.value || defaultBakeDate;
  const normalizedBakeWindow = saturdayOptions.some((option) => option.value === form.bakeWindow)
    ? form.bakeWindow
    : fallbackBakeWindow;
  const selectedBakeDate = fromSingaporeDateKey(normalizedBakeWindow);
  const isSelectedBakeOpen = selectedBakeDate
    ? isSaturdayOpen(selectedBakeDate, new Date())
    : false;
  const selectedBakeOption = saturdayOptions.find((option) => option.value === normalizedBakeWindow);
  const displayBakeWindow = selectedBakeOption?.label || "";

  const { estimatedTotal, hasSelectedItems, waMessage, money } = useOrderSummary({
    form: { ...orderForm, bakeWindow: displayBakeWindow },
    menu: orderableMenu,
    brandName: BRAND.name,
    waNumberE164: BRAND.waNumberE164,
  });
  const hasRequiredContactDetails = Boolean(form.name.trim() && form.phone.trim());

  useBodyScrollLock(modalOpen);
  useScrollReveal();
  useAnalytics();

  const isHeaderLoading = isOpeningModal && openingTriggerId === "header-primary";

  const openHeaderPreorder = () => handleOpenPreorder(undefined, "header-primary");

  const closePreorderModal = () => setModalOpen(false);

  const handleOrderIntent = (whatsappLink, orderNumber) => {
    setHasStartedOrder(true);
    setModalOpen(false);
    setWhatsappHandoffLink(whatsappLink || "");
    setWhatsappOrderNumber(orderNumber || "");
    window.history.replaceState(null, "", "#confirmation");
  };

  const handleOrderRequest = (turnstileToken) => {
    const order = buildOrderRecord({
      form: { ...orderForm, bakeWindow: displayBakeWindow },
      menu: orderableMenu,
      estimatedTotal,
      moneyFormatter: money,
    });

    return submitOrderRequest(order, turnstileToken);
  };

  return (
    <div className="min-h-screen bg-cream text-ink">
      <Seo brand={BRAND} menu={menu} faq={FAQ} />
      <div className="sticky top-0 z-40">
        <div className="ribbon border-b border-line bg-[#F7EBDD]">
          <div className="ribbon-track py-2 text-xs font-medium text-inkMuted sm:text-sm">
            {[0, 1, 2, 3].map((dupIdx) => (
              <div className="ribbon-group" aria-hidden={dupIdx > 0} key={dupIdx}>
                {ribbonItems.map((item) => (
                  <span className="ribbon-item" key={`${dupIdx}-${item}`}>
                    <span>{item}</span>
                    <span
                      className="inline-flex flex-none items-center justify-center text-brandBrown"
                      aria-hidden="true"
                    >
                      <span className="inline-flex h-5 w-5 flex-none items-center justify-center sm:hidden">
                        <CinnamonLoader size={20} />
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

        <header className="border-b border-line bg-surface/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <span className="sticker-perk__mark inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full sm:h-10 sm:w-10">
                <img
                  src="/logo.webp"
                  alt="Swirl Girl logo"
                  className="sticker-perk__logo h-full w-full object-cover"
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
            <div className="sticker-perk mx-5 hidden max-w-[25rem] flex-1 items-center gap-2 rounded-button px-3 py-2 shadow-soft xl:flex">
              <span className="sticker-perk__mark inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                <img src="/logo.webp" alt="" className="sticker-perk__logo h-full w-full object-cover" aria-hidden="true" decoding="async" />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#38241A]">A little extra for you</span>
                <span className="block truncate text-xs font-semibold text-[#38241A]">Free holographic sticker with every purchase</span>
              </span>
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
              <button
                onClick={openHeaderPreorder}
                disabled={isHeaderLoading}
                className="relative inline-flex touch-manipulation items-center whitespace-nowrap rounded-button bg-brandBrown px-3 py-2 text-xs font-medium text-white shadow-soft transition-all duration-200 hover:-translate-y-[1px] hover:shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCinnamon/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:translate-y-0 disabled:shadow-soft sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <span className={isHeaderLoading ? "opacity-0" : "opacity-100"}>
                  {BRAND.primaryCTA}
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

      <main className="space-y-6 pb-6 sm:space-y-10 sm:pb-8">
        <LandingSection brand={BRAND} />

        <InstagramReelSection />

        <MenuSection
          menu={menu}
          quantityOptions={QUANTITY_OPTIONS}
          form={orderForm}
          setForm={setForm}
          menuStatus={menuStatus}
          allergenDisclaimer={ALLERGEN_DISCLAIMER}
        />

        <BananaBreadGallery />

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

        <ReserveCtaSection
          brand={BRAND}
          handleOpenPreorder={handleOpenPreorder}
          isOpeningModal={isOpeningModal}
          openingTriggerId={openingTriggerId}
        />

        <ConfirmationSection brand={BRAND} isOrderStarted={hasStartedOrder} />
      </main>

      <SiteFooter brand={BRAND} />

      <WhatsAppHandoffNotice
        whatsappLink={whatsappHandoffLink}
        orderNumber={whatsappOrderNumber}
        onDismiss={() => {
          setWhatsappHandoffLink("");
          setWhatsappOrderNumber("");
        }}
      />

      <PreorderModal
        open={modalOpen}
        onClose={closePreorderModal}
        form={{ ...orderForm, bakeWindow: normalizedBakeWindow }}
        setForm={setForm}
        estimatedTotal={estimatedTotal}
        waMessage={waMessage}
        saturdayDates={saturdayOptions}
        hasSelectedItems={hasSelectedItems}
        canSubmitOrder={
          hasSelectedItems &&
          isSelectedBakeOpen &&
          hasRequiredContactDetails &&
          menuStatus === "ready" &&
          hasCurrentPrices
        }
        hasRequiredContactDetails={hasRequiredContactDetails}
        isBakeWindowOpen={isSelectedBakeOpen}
        menuStatus={menuStatus}
        menu={menu}
        quantityOptions={QUANTITY_OPTIONS}
        allergenDisclaimer={ALLERGEN_DISCLAIMER}
        money={money}
        brand={BRAND}
        onOrderIntent={handleOrderIntent}
        onOrderRequest={handleOrderRequest}
      />
    </div>
  );
}
