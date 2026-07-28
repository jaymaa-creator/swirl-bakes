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
npm run apps:deploy -- --deploymentId YOUR_DEPLOYMENT_ID --versionNumber VERSION_NUMBER --description "Describe the change"
```

The live deployment ID is the `AKfy...` value from the `/exec` URL.

## Web App Manifest

The manifest keeps this as a public web app:

```json
"webapp": {
  "access": "ANYONE_ANONYMOUS",
  "executeAs": "USER_DEPLOYING"
}
```
