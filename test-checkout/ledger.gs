// Included only in the generated, project-guarded test web app.
function TEST_checkoutSnapshot() {
  TEST_assertProject();
  const lock = LockService.getScriptLock();
  const ownsLock = !lock.hasLock();
  if (ownsLock) lock.waitLock(30000);
  try {
    const captured = Date.now();
    const book = TEST_openSpreadsheet(SPREADSHEET_ID);
    const orders = book.getSheetByName(ORDERS_SHEET_NAME);
    const rows = orders.getDataRange().getValues();
    const headers = rows.shift().map(TEST_normalizeHeader);
    const seen = {}, existing = {};
    const used = new Set();
    for (const row of rows) {
      const value = name => TEST_valueFromRow(headers, row, name);
      const number = value("order_no") || value("order_number");
      if (!number) continue;
      const digits = String(value("whatsapp") || value("phone") || value("contact_number") || "").replace(/\D/g,"");
      const key = value("customer_key") || (digits && TEST_referralCustomerKey(digits));
      if (key) seen[key] = true;
      if (value("credit_source_event_id")) used.add(String(value("credit_source_event_id")));
      const id = value("request_id");
      if (id) existing[id] = { fingerprint: value("request_fingerprint"), orderNumber: number,
        referralCode: value("customer_referral_code") || "", referralDiscountSgd: Number(value("referral_discount") || 0),
        creditRedeemedSgd: Number(value("credit_redeemed") || 0), amountDueSgd: Number(value("amount_due")) };
    }
    const customers = {}, credits = [];
    const customerSheet = book.getSheetByName(REFERRAL_CUSTOMERS_SHEET_NAME);
    if (customerSheet) for (const row of customerSheet.getDataRange().getValues().slice(1)) customers[String(row[0])] = String(row[1]);
    const ledger = book.getSheetByName(REFERRAL_LEDGER_SHEET_NAME);
    const events = ledger ? ledger.getDataRange().getValues().slice(1) : [];
    for (const row of events) if (row[2] === "CREDIT_REDEEMED") used.add(String(row[9]));
    for (const row of events) if (row[2] === "CREDIT_EARNED" && !used.has(String(row[0])) && new Date(row[8]).getTime() > captured)
      credits.push({ id:String(row[0]), key:String(row[3]), created:new Date(row[1]).getTime(), expires:new Date(row[8]).getTime() });
    credits.sort((a,b) => a.created-b.created);
    const calendar = TEST_readBakeCalendar(book);
    const currentBatch = TEST_formatBatchKey(TEST_getMenuBatchDate("",book,calendar));
    const snapshots = TEST_buildMenuSnapshots(TEST_getSnapshotBatchKeys(calendar,currentBatch),currentBatch,calendar,book,true);
    return {captured, existing, seen, customers, credits, bundle:{ok:true,currentBatch,snapshots}};
  } finally { if (ownsLock) lock.releaseLock(); }
}

function TEST_appendCloudOrder(entry) {
  TEST_assertProject();
  if (!entry || !/^TEST-[\w-]+$/.test(entry.orderNumber) || !REQUEST_ID_PATTERN.test(entry.requestId) ||
      !/^[a-f0-9]{64}$/.test(entry.requestFingerprint) || !Number.isFinite(entry.amountDue)) throw new Error("Invalid ledger entry");
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const book = TEST_openSpreadsheet(SPREADSHEET_ID);
    const orders = book.getSheetByName(ORDERS_SHEET_NAME);
    TEST_ensureOrderRequestColumns(orders);
    const previous = TEST_findOrderRequest(orders,entry.requestId);
    if (previous && (previous.orderNumber !== entry.orderNumber || previous.requestFingerprint !== entry.requestFingerprint))
      throw new Error("Ledger identity conflict");
    TEST_ensureReferralSheets(book);
    const customer = TEST_findReferralCustomerByKey(book,entry.customerKey);
    if (customer && customer.code !== entry.customerReferralCode) throw new Error("Referral identity conflict");
    if (!customer) {
      if (TEST_findReferralCustomerByCode(book,entry.customerReferralCode)) throw new Error("Referral code conflict");
      book.getSheetByName(REFERRAL_CUSTOMERS_SHEET_NAME).appendRow([entry.customerKey,entry.customerReferralCode,new Date(entry.createdAt),
        entry.orderNumber,TEST_safeCell(TEST_normalizeReferralPhone(entry.phone))]);
    }
    if (!previous) {
      const row = {...entry, createdAt:new Date(entry.createdAt), saturdayBatch:TEST_parseCalendarDate(entry.saturdayBatch),
        whatsApp:TEST_whatsAppLink(entry.phone), paid:false, status:"New", referralProgramVersion:REFERRAL_PROGRAM_VERSION};
      for (const key of ["name","items","fulfilment","collectionSlot","deliveryAddress","notes","total"]) row[key]=TEST_safeCell(row[key]);
      TEST_appendOrderRow(orders,row);
      SpreadsheetApp.flush();
    }
    TEST_reconcileReferralLedgerForSavedOrders(book,orders);
    SpreadsheetApp.flush();
    return {ok:true,requestId:entry.requestId,orderNumber:entry.orderNumber};
  } finally { lock.releaseLock(); }
}
