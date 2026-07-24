const BRAND = {
  name: "Swirl Girl Bakes",
  tagline: "Small-batch Saturday bakes, made fresh in Singapore.",
  primaryCTA: "Reserve for Saturday",
  secondaryCTA: "Available this week",
  waNumberE164: "+6581307971",
  instagramUrl: "https://www.instagram.com/swirlgirlbakes/",
  instagramHandle: "@swirlgirl.sg",
  siteUrl: import.meta.env.VITE_SITE_URL || "https://swirl-girl.jaemcd95.workers.dev",
  orderCutoffLabel: "Friday 7pm SGT",
  originLabel: "Baked in Singapore",
  story:
    "Swirl Girl Bakes is a home-baking microbrand built around one careful Saturday batch each week. The goal is simple: soft cinnamon rolls, tender banana bread, and a pickup or delivery flow that still feels personal.",
  ingredients: [
    "French-style butter for richer dough and banana bread",
    "Saigon cinnamon for a deeper swirl and glaze aroma",
    "Small-batch dough rested overnight for a softer crumb",
    "Freshly baked on Saturday for best texture and flavour",
  ],
  collectionLocation: "Central Singapore collection point",
  collectionNote:
    "Exact meetup details are shared after confirmation so timing stays tight and bakes stay fresh.",
  pickupInstructions: [
    "Collection timing is confirmed after your order is accepted.",
    "Bring an insulated bag if you are collecting multiple boxes.",
    "Reheat instructions are included for the best same-day texture.",
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
