import { useEffect, useRef, useState } from "react";

export default function usePreorderModalOpen(setForm, setModalOpen) {
  const [isOpeningModal, setIsOpeningModal] = useState(false);
  const [openingTriggerId, setOpeningTriggerId] = useState(null);
  const openingTimeoutRef = useRef(null);

  const handleOpenPreorder = (optionalBakeDate, triggerId) => {
    if (isOpeningModal) return;

    if (optionalBakeDate) {
      setForm((f) => ({ ...f, bakeWindow: optionalBakeDate }));
    }

    setOpeningTriggerId(triggerId || null);
    setIsOpeningModal(true);

    openingTimeoutRef.current = window.setTimeout(() => {
      setModalOpen(true);
      setIsOpeningModal(false);
      setOpeningTriggerId(null);
    }, 1000);
  };

  useEffect(
    () => () => {
      if (openingTimeoutRef.current) {
        window.clearTimeout(openingTimeoutRef.current);
      }
    },
    []
  );

  return { isOpeningModal, openingTriggerId, handleOpenPreorder };
}
