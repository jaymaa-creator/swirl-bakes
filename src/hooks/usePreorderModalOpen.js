export default function usePreorderModalOpen(setForm, setModalOpen) {
  const handleOpenPreorder = (optionalBakeDate) => {
    if (optionalBakeDate) {
      setForm((form) => ({ ...form, bakeWindow: optionalBakeDate }));
    }
    setModalOpen(true);
  };

  return { isOpeningModal: false, openingTriggerId: null, handleOpenPreorder };
}
