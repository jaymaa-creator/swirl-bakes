import { useEffect } from "react";

function upsertMeta(selector, attributes) {
  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement("meta");
    document.head.appendChild(node);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    node.setAttribute(key, value);
  });
}

export default function Seo({ brand, menu, faq }) {
  useEffect(() => {
    const title = `${brand.name} | Saturday Cinnamon Rolls & Cookies in Singapore`;
    const description =
      "Reserve small-batch Saturday cinnamon rolls and brown butter cookies from Swirl Girl Bakes in Singapore. Weekly pre-orders close Friday at 7pm SGT.";
    const origin =
      typeof window !== "undefined" && window.location.origin !== "null"
        ? window.location.origin
        : "";
    const siteUrl = brand.siteUrl || origin;
    const pageUrl = siteUrl || undefined;
    const imageUrl = siteUrl ? `${siteUrl}/og-image.svg` : "/og-image.svg";
    const gscVerification = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION;

    document.title = title;

    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertMeta('meta[name="theme-color"]', { name: "theme-color", content: "#5A3825" });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMeta('meta[property="og:description"]', {
      property: "og:description",
      content: description,
    });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl });
    upsertMeta('meta[property="og:locale"]', { property: "og:locale", content: "en_SG" });
    upsertMeta('meta[name="twitter:card"]', {
      name: "twitter:card",
      content: "summary_large_image",
    });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    upsertMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: description,
    });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });

    if (pageUrl) {
      upsertMeta('meta[property="og:url"]', { property: "og:url", content: pageUrl });

      let canonicalLink = document.head.querySelector('link[rel="canonical"]');
      if (!canonicalLink) {
        canonicalLink = document.createElement("link");
        canonicalLink.setAttribute("rel", "canonical");
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.setAttribute("href", pageUrl);
    }

    if (gscVerification) {
      upsertMeta('meta[name="google-site-verification"]', {
        name: "google-site-verification",
        content: gscVerification,
      });
    }

    const existingJsonLd = document.getElementById("bakery-json-ld");
    if (existingJsonLd) existingJsonLd.remove();

    const jsonLd = document.createElement("script");
    jsonLd.id = "bakery-json-ld";
    jsonLd.type = "application/ld+json";
    jsonLd.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Bakery",
      "@id": pageUrl ? `${pageUrl}#bakery` : undefined,
      name: brand.name,
      description,
      url: pageUrl,
      image: imageUrl,
      telephone: brand.waNumberE164,
      areaServed: "Singapore",
      sameAs: [brand.instagramUrl],
      servesCuisine: ["Bakery", "Dessert"],
      hasMenu: {
        "@type": "Menu",
        hasMenuSection: menu.map((item) => ({
          "@type": "MenuSection",
          name: item.category,
          hasMenuItem: {
            "@type": "MenuItem",
            name: item.name,
            description: item.note,
            offers: {
              "@type": "Offer",
              priceCurrency: "SGD",
              price: item.priceSgd,
            },
          },
        })),
      },
      makesOffer: menu.map((item) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Product",
          name: item.name,
          description: item.note,
        },
        priceCurrency: "SGD",
        price: item.priceSgd,
      })),
      faq: faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    });
    document.head.appendChild(jsonLd);
  }, [brand, faq, menu]);

  return null;
}
