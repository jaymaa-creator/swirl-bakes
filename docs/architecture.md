# Swirl Girl Architecture

```mermaid
flowchart LR
  U[Customer browser] -->|HTML/CSS/JS/images\n~20-150ms| CF[Cloudflare Worker + CDN]

  CF -->|Menu request\n/api/menu| EC{Edge menu cache}
  EC -->|Cache hit\n~1-10ms| M[Live menu response]
  EC -->|Cache miss\n~10-100ms| KV[Workers KV\nmenu snapshots]
  KV --> M
  M --> U

  U -->|Reserve order| CF
  CF -->|Optional bot check\n~100-500ms| T[Cloudflare Turnstile]
  CF -->|Save order\nusually 1-10s| AS[Google Apps Script]
  AS --> GS[Google Sheet\nOrders tab]
  CF -->|Order number returned| U
  U -->|Prefilled message| WA[WhatsApp]

  GS -->|Products + Calendar edited| AS
  AS -->|Manual/triggered sync\nabout 5-15s| P[Production Worker\n/api/menu/sync]
  AS -->|Same sync| Q[Test Worker\n/api/menu/sync]
  P -->|Write snapshots| KV
  Q -->|Write snapshots| KVT[Test KV]
  P -->|Immediately clear| EC
```

## Timing guide

| Path | Typical time |
| --- | --- |
| Website assets from Cloudflare | 20-150ms |
| Menu edge-cache hit | 1-10ms |
| Menu cache miss, read from KV | 10-100ms |
| Turnstile verification | 100-500ms |
| Order write through Apps Script to Google Sheets | 1-10 seconds |
| Apps Script menu/calendar sync to production and test | 5-15 seconds |

## Menu update flow

1. Update `Products` or `Calendar` in Google Sheets.
2. Run `syncMenuSnapshot` in Apps Script.
3. Apps Script sends snapshots to production and test Workers.
4. Each Worker updates KV and clears its edge menu cache.
5. The next visitor receives the new menu immediately; later visitors use the fast edge cache.
