const BRAND = {
  name: "Swirl Girl",
  tagline: "Small-batch Saturday bakes, made fresh in Singapore.",
  primaryCTA: "Reserve for Saturday",
  secondaryCTA: "Available this week",
  waNumberE164: "+6581307971",
  instagramUrl: "https://www.instagram.com/swirlgirl.sg/",
  instagramHandle: "@swirlgirl.sg",
  siteUrl: import.meta.env.VITE_SITE_URL || "https://swirlgirl.sg",
  orderCutoffLabel: "Thursday 10pm SGT",
  originLabel: "Baked in Singapore",
  story:
    "Small-batch cinnamon rolls and banana bread, baked fresh on Saturdays from Joo Chiat.",
  ingredients: [
    "Banana bread is made with banana, butter, self-raising flour, caster sugar, eggs, and baking powder.",
    "Cinnamon rolls contain gluten, dairy, and eggs.",
    "Baked in small Saturday batches in a home kitchen.",
    "Allergen cross-contamination is possible because ingredients and tools are shared.",
  ],
  collectionLocation: "Joo Chiat collection point",
  collectionNote:
    "Exact pickup details are shared after your order is confirmed.",
  pickupInstructions: [
    "Pickup time is confirmed after your order is accepted.",
    "Bring a bag if you are collecting multiple boxes.",
    "Reheat notes are included with each order.",
  ],
  pickupAreas: ["Central", "East", "North", "North-East", "West"],
  deliveryOptions: [
    "Delivery (GrabExpress / Lalamove) - paid by customer",
    "Self-collection - agreed pickup point",
  ],
  colors: {
    brown: "#5A3825",
    cinnamon: "#C47A3A",
    cream: "#F5E6D3",
    blush: "#F2B6A0",
  },
};

export default BRAND;
