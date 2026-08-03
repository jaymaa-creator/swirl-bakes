export const MENU = [
  {
    id: "cinnamon-rolls",
    name: "Cinnamon Rolls",
    category: "Signature Rolls",
    unitLabel: "per box of 6",
    quantityLabel: "box",
    quantityLabelPlural: "boxes",
    orderDescription: "box of 6 rolls",
    image: "/cinnamon-rolls-opt.webp",
    imageAlt: "Freshly glazed cinnamon rolls in a close-up tray shot",
    badge: "Best seller",
    note: "Six soft, freshly baked cinnamon rolls in every box.",
    allergens: "Contains gluten, dairy, eggs.",
  },
  {
    id: "banana-bread",
    name: "Banana Bread",
    category: "Loaf Cakes",
    unitLabel: "per loaf",
    quantityLabel: "loaf",
    quantityLabelPlural: "loaves",
    orderDescription: "loaf",
    image: "/banana-bread-slices.webp",
    imageAlt: "Freshly sliced banana bread on a wooden board with banana pieces",
    note: "A tender, buttery banana loaf baked fresh for the Saturday batch.",
    allergens: "Contains gluten, dairy, eggs.",
  },
];

export const QUANTITY_OPTIONS = [1, 2, 3];

export const ALLERGEN_NAMES = [
  "Cereals containing gluten",
  "Crustaceans",
  "Eggs",
  "Fish",
  "Milk",
  "Molluscs",
  "Mustard",
  "Nuts",
  "Peanuts",
  "Celery",
  "Sesame",
  "Soya",
  "Sulphur dioxide & sulphites",
  "Lupin",
];

export const ALLERGEN_DISCLAIMER =
  `Baked in a home kitchen. Allergens present in the kitchen may include: ${ALLERGEN_NAMES.join(", ")}. We cannot guarantee any item is free from cross-contamination. Please let us know of any allergies in your order notes.`;

export const FAQ = [
  {
    q: "How do Saturday reservations work?",
    a: "Reserve within the current pre-order window for the next Saturday batch. We confirm your slot, total, and delivery timing before bake day.",
  },
  {
    q: "Do you take same-day orders?",
    a: "No, we do not run on-demand bakes. We work in limited Saturday batches, so reservations close when slots are full.",
  },
  {
    q: "Payments?",
    a: "PayNow is simplest. Payment details are shared once your Saturday slot is confirmed.",
  },
  {
    q: "Delivery pricing?",
    a: "Delivery is available for orders of S$50 or more. A flat S$5 fee is added to eligible delivery orders.",
  },
  {
    q: "Where is collection?",
    a: "Collection is in Joo Chiat, with exact details shared after confirmation so we can keep handoff timings close to bake completion.",
  },
  {
    q: "How should I store and reheat my order?",
    a: "Orders are best on the day of pickup. If needed, keep them covered at room temperature and follow the included reheating notes to bring back the soft centre and glossy finish.",
  },
];
