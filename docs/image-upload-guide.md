# Adding a Product Photo

Use this guide when you want to add or change a photo on the Swirl Girl menu.

## Before You Start

You need access to:

- the Swirl Girl Cloudflare account
- the `Swirl Girl Orders` Google Sheet

Do this from your iPhone. You do not need to resize or convert the photo first.

## 1. Upload the Photo

1. Open Cloudflare in Safari and sign in.
2. Tap the menu, then tap **Images**.
3. Tap **Upload**.
4. Choose the photo from your Photo Library.
5. When it finishes uploading, open the image and copy its **delivery URL**.

The link should start with `https://imagedelivery.net/`.

## 2. Add It to the Menu

1. Open the `Swirl Girl Orders` Google Sheet.
2. Open the **Products** tab.
3. Find the product row you want to change.
4. Paste the delivery URL into the `image_url` column.
5. Check that `available` is set to `TRUE`.
6. If it is the featured item for the week, set `special` to `TRUE` too.

## 3. See It on the Website

The website normally updates after the Sheet edit automatically. Give it about one minute, then refresh the website.

If it has not changed after two minutes:

1. Open the Google Apps Script project on a computer.
2. Select `syncMenuSnapshot` from the function list.
3. Click **Run**.

## Useful Notes

- Use one clear, well-lit photo per product.
- Portrait photos work well for the menu cards.
- Do not use a Google Photos or Google Drive sharing link. They are not reliable direct image links for the website.
- You can replace a product image at any time by pasting a new URL into `image_url`.
