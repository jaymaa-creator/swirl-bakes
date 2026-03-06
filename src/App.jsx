import React, { useEffect, useMemo, useState } from "react";
import FaqSection from "./components/FaqSection";
import LandingSection from "./components/LandingSection";
import MenuSection from "./components/MenuSection";
import PreorderModal from "./components/PreorderModal";
import ProcessSection from "./components/ProcessSection";
import ReserveCtaSection from "./components/ReserveCtaSection";
import SiteFooter from "./components/SiteFooter";
import InstagramReelSection from "./components/InstagramReelSection";
import CinnamonLoader from "./components/ui/CinnamonLoader";
import BRAND from "./config/brand";
import { FAQ, MENU, QUANTITY_OPTIONS } from "./config/products";
import {
  formatSgDate,
  fromSingaporeDateKey,
  getNearestOpenSaturday,
  getOpenSaturdays,
  isSaturdayOpen,
  toSingaporeDateKey,
} from "./lib/dates";
import useBodyScrollLock from "./hooks/useBodyScrollLock";
import useOrderSummary from "./hooks/useOrderSummary";
import usePreorderModalOpen from "./hooks/usePreorderModalOpen";

export default function BakesLandingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const saturdayOptions = useMemo(
    () =>
      getOpenSaturdays(2, new Date()).map((date) => ({
        value: toSingaporeDateKey(date),
        label: formatSgDate(date),
        isOpen: isSaturdayOpen(date, new Date()),
      })),
    []
  );
  const defaultBakeDate = saturdayOptions[0]?.value || "";

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    bakeWindow: defaultBakeDate,
    delivery: BRAND.deliveryOptions[0],
    area: BRAND.pickupAreas[0],
    address: "",
    notes: "",
    items: Object.fromEntries(MENU.map((item) => [item.id, 0])),
  });

  const { isOpeningModal, openingTriggerId, handleOpenPreorder } =
    usePreorderModalOpen(setForm, setModalOpen);

  const selectedBakeDate = fromSingaporeDateKey(form.bakeWindow);
  const isSelectedBakeOpen = selectedBakeDate
    ? isSaturdayOpen(selectedBakeDate, new Date())
    : false;
  const selectedBakeOption = saturdayOptions.find((option) => option.value === form.bakeWindow);
  const displayBakeWindow = selectedBakeOption?.label || "";

  const { estimatedTotal, hasSelectedItems, waMessage, waLink, money } = useOrderSummary({
    form: { ...form, bakeWindow: displayBakeWindow },
    menu: MENU,
    brandName: BRAND.name,
    waNumberE164: BRAND.waNumberE164,
  });

  useBodyScrollLock(modalOpen);

  useEffect(() => {
    const selectedOption = saturdayOptions.find((option) => option.value === form.bakeWindow);
    const selectedIsOpen = selectedOption
      ? isSaturdayOpen(fromSingaporeDateKey(selectedOption.value), new Date())
      : false;

    if (selectedOption && selectedIsOpen) return;

    const nearestOpen = toSingaporeDateKey(getNearestOpenSaturday(new Date()));
    if (nearestOpen === form.bakeWindow) return;

    setForm((f) => ({ ...f, bakeWindow: nearestOpen }));
  }, [form.bakeWindow, saturdayOptions]);

  const isHeaderLoading =
    isOpeningModal && openingTriggerId === "header-primary";

  const openHeaderPreorder = () => handleOpenPreorder(undefined, "header-primary");

  const closePreorderModal = () => setModalOpen(false);

  return (
    <div className="min-h-screen bg-cream text-ink">
      {isOpeningModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-cream/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <CinnamonLoader size={80} className="text-brandBrown" />
            <div className="text-sm font-medium text-inkMuted">Preparing your preorder...</div>
          </div>
        </div>
      ) : null}

      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png" 
              alt="Swirl Girl Bakes logo"
              className="h-10 w-10 rounded-xl object-contain"
            />
            <div>
              <div className="text-sm font-semibold leading-none">{BRAND.name}</div>
              <div className="text-xs text-inkMuted">Baked in Singapore</div>
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
            <button
              onClick={openHeaderPreorder}
              disabled={isHeaderLoading}
              className="relative inline-flex items-center rounded-button bg-brandBrown px-4 py-2.5 text-sm font-medium text-white shadow-soft transition-all duration-200 hover:-translate-y-[1px] hover:shadow-float disabled:translate-y-0 disabled:shadow-soft"
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

      <main className="space-y-10 sm:space-y-14">
        <LandingSection
          brand={BRAND}
          bakeWindows={saturdayOptions}
          handleOpenPreorder={handleOpenPreorder}
          isOpeningModal={isOpeningModal}
          openingTriggerId={openingTriggerId}
        />

        <InstagramReelSection />

        <MenuSection
          menu={MENU}
          quantityOptions={QUANTITY_OPTIONS}
          form={form}
          setForm={setForm}
        />

        <ProcessSection
          brandColors={BRAND.colors}
          deliveryOptions={BRAND.deliveryOptions}
        />

        <FaqSection faq={FAQ} />

        <ReserveCtaSection
          brand={BRAND}
          handleOpenPreorder={handleOpenPreorder}
          isOpeningModal={isOpeningModal}
          openingTriggerId={openingTriggerId}
        />
      </main>

      <SiteFooter brand={BRAND} />

      <PreorderModal
        open={modalOpen}
        onClose={closePreorderModal}
        form={form}
        setForm={setForm}
        estimatedTotal={estimatedTotal}
        waLink={waLink}
        waMessage={waMessage}
        saturdayDates={saturdayOptions}
        hasSelectedItems={hasSelectedItems}
        canSubmitOrder={hasSelectedItems && isSelectedBakeOpen}
        isBakeWindowOpen={isSelectedBakeOpen}
        menu={MENU}
        money={money}
        brand={BRAND}
      />
    </div>
  );
}
