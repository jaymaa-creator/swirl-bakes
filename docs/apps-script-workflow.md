# Apps Script Workflow

The Apps Script source lives in `apps-script/` and is managed with `clasp`.

The root `.clasp.json` points at the existing Apps Script project:

```text
1YfNLgt5YZnDv8CwcR9zcGICM4v0jjfMCs9lzD_pWVh5M8O5Yc5xMVnhf
```

Script Properties such as `ORDER_WEBHOOK_SECRET` stay in Google Apps Script and are not stored in Git.

## Push Code

```bash
npm run apps:push
```

## Deploy Web App

Create a version:

```bash
npm run apps:version -- "Describe the change"
```

List deployments:

```bash
npm run apps:deployments
```

Update the existing web app deployment:

```bash
npx clasp update-deployment YOUR_DEPLOYMENT_ID --versionNumber VERSION_NUMBER --description "Describe the change"
```

The live deployment ID is the `AKfy...` value from the `/exec` URL.

## Product Stock Columns

The `Products` tab should use:

```text
product_id | price_sgd | available | max_quantity | batch_limit | description | allergens | image_url
```

`max_quantity` is the most one customer can select in a single order.

`batch_limit` is the total stock for the active Saturday batch.

Example:

```text
cinnamon-rolls | 35 | TRUE | 3 | 12 | (blank) | (blank) | (blank)
banana-bread | 25 | TRUE | 3 | 6 | (blank) | (blank) | (blank)
```

If Banana Cake has `batch_limit = 6` and four cakes are already in this week's `Orders` rows, the website only shows quantity buttons `1` and `2`.

Add a row with `available = TRUE` to publish a new product. `description` is optional: it overrides the existing Cinnamon Roll or Banana Cake copy when filled in, and supplies the copy for new products. `allergens` is an optional customer-facing allergen statement. `image_url` is optional; a new product shows a tidy placeholder until an image is available.

## Web App Manifest

The manifest keeps this as a public web app:

```json
"webapp": {
  "access": "ANYONE_ANONYMOUS",
  "executeAs": "USER_DEPLOYING"
}
```
