import {
  COLLECTION_OPTION,
  DELIVERY_FEE_SGD,
  DELIVERY_MINIMUM_SGD,
  DELIVERY_OPTION,
  PICKUP_WINDOWS,
} from "./orderPolicy.js";

const BRAND = {
  name: "Swirl Girl",
  tagline: "Small-batch Saturday bakes, made fresh in Singapore.",
  primaryCTA: "Reserve for Saturday",
  secondaryCTA: "Available this week",
  waNumberE164: "+6581307971",
  instagramUrl: "https://www.instagram.com/swirlgirl.sg/",
  instagramHandle: "@swirlgirl.sg",
  instagramFeed: {
    heading: "From The Kitchen",
    title: "See more on Instagram.",
    intro:
      "More bakes and updates on Instagram.",
    embeds: [
      {
        permalink: "https://www.instagram.com/reel/CtRgv3kpfEI/?utm_source=ig_embed&utm_campaign=loading",
        label: "Featured reel",
      },
    ],
  },
  siteUrl: import.meta.env.VITE_SITE_URL || "https://swirlgirl.sg",
  orderCutoffLabel: "Thursday 10pm SGT",
  deliveryMinimumSgd: DELIVERY_MINIMUM_SGD,
  deliveryFeeSgd: DELIVERY_FEE_SGD,
  originLabel: "Baked in Singapore",
  story:
    "Small-batch Saturday bakes from Joo Chiat. See the menu for our next bake date.",
  ingredients: [
    "Banana cake is made with banana, butter, self-raising flour, caster sugar, eggs, and baking powder.",
    "Cinnamon rolls contain gluten, dairy, and eggs.",
    "Baked in small Saturday batches in a home kitchen.",
    "Allergen cross-contamination is possible because ingredients and tools are shared.",
  ],
  collectionLocation: "Joo Chiat collection point",
  collectionReadyLabel: "Pickup from 11am-3pm",
  pickupWindows: PICKUP_WINDOWS,
  collectionNote:
    "Exact pickup details are shared after confirmation.",
  pickupInstructions: [
    "Pickup time is confirmed after your order is accepted.",
    "Bring a bag for larger orders.",
    "Reheating notes are included.",
  ],
  pickupAreas: ["Central", "East", "North", "North-East", "West"],
  deliveryOptions: [DELIVERY_OPTION, COLLECTION_OPTION],
  colors: {
    brown: "#5A3825",
    cinnamon: "#C47A3A",
    cream: "#F5E6D3",
    blush: "#F2B6A0",
  },
};

export default BRAND;
