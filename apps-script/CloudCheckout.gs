// Production ledger functions run only in the bound production project.
function productionCheckoutSnapshot(activate) {
  assertProductionLedger();
  const lock = LockService.getScriptLock();
  const ownsLock = !lock.hasLock();
  if (ownsLock) lock.waitLock(30000);
  try {
    const captured = Date.now();
    const book = SpreadsheetApp.openById(SPREADSHEET_ID);
    const orders = book.getSheetByName(ORDERS_SHEET_NAME);
    const rows = orders.getDataRange().getValues();
    const headers = rows.shift().map(normalizeHeader);
    const props = PropertiesService.getScriptProperties();
    let sequence = Number(props.getProperty(ORDER_SEQUENCE_PROPERTY) || 0);
    const seen = {}, existing = {};
    const used = new Set();
    for (const row of rows) {
      const value = name => valueFromRow(headers, row, name);
      const number = value("order_no") || value("order_number");
      if (!number) continue;
      const match = /^SG-(\d+)$/.exec(number);
      if (match) sequence = Math.max(sequence, Number(match[1]));
      const digits = String(value("whatsapp") || value("phone") || value("contact_number") || "").replace(/\D/g,"");
      const key = value("customer_key") || (digits && referralCustomerKey(digits));
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
    const calendar = readBakeCalendar(book);
    const currentBatch = formatBatchKey(getMenuBatchDate("",book,calendar));
    const snapshots = buildMenuSnapshots(getSnapshotBatchKeys(calendar,currentBatch),currentBatch,calendar,book,false);
    if (!Number.isSafeInteger(sequence) || sequence < 0) throw Error("Invalid order sequence");
    if (activate) props.setProperty("CLOUD_CHECKOUT_ACTIVE", "1");
    return {captured, sequence, writerActive:props.getProperty("CLOUD_CHECKOUT_ACTIVE") === "1", existing, seen, customers, credits, bundle:{ok:true,currentBatch,snapshots}};
  } finally { if (ownsLock) lock.releaseLock(); }
}

function appendProductionCloudOrder(entry) {
  assertProductionLedger();
  if (!entry || !/^SG-\d{4,}$/.test(entry.orderNumber) || !REQUEST_ID_PATTERN.test(entry.requestId) ||
      !/^[a-f0-9]{64}$/.test(entry.requestFingerprint) || (!Number.isFinite(entry.amountDue) || entry.amountDue <= 0)) throw new Error("Invalid ledger entry");
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const book = SpreadsheetApp.openById(SPREADSHEET_ID);
    const orders = book.getSheetByName(ORDERS_SHEET_NAME);
    ensureOrderRequestColumns(orders);
    const previous = findOrderRequest(orders,entry.requestId);
    if (previous && (previous.orderNumber !== entry.orderNumber || previous.requestFingerprint !== entry.requestFingerprint))
      throw new Error("Ledger identity conflict");
    ensureReferralSheets(book);
    const customer = findReferralCustomerByKey(book,entry.customerKey);
    if (customer && customer.code !== entry.customerReferralCode) throw new Error("Referral identity conflict");
    if (!customer) {
      if (findReferralCustomerByCode(book,entry.customerReferralCode)) throw new Error("Referral code conflict");
      book.getSheetByName(REFERRAL_CUSTOMERS_SHEET_NAME).appendRow([entry.customerKey,entry.customerReferralCode,new Date(entry.createdAt),
        entry.orderNumber,safeCell(normalizeReferralPhone(entry.phone))]);
    }
    if (!previous) {
      const headers = orders.getRange(1,1,1,orders.getLastColumn()).getValues()[0].map(normalizeHeader);
      const numberColumn = Math.max(headers.indexOf("order_no"), headers.indexOf("order_number")) + 1;
      if (orders.getLastRow()>1 && orders.getRange(2,numberColumn,orders.getLastRow()-1,1).createTextFinder(entry.orderNumber).matchEntireCell(true).findNext()) throw Error("Ledger reference conflict");
      const row = {...entry, createdAt:new Date(entry.createdAt), saturdayBatch:parseCalendarDate(entry.saturdayBatch),
        whatsApp:whatsAppLink(entry.phone), paid:false, status:"New", referralProgramVersion:REFERRAL_PROGRAM_VERSION};
      for (const key of ["name","items","fulfilment","collectionSlot","deliveryAddress","notes","total"]) row[key]=safeCell(row[key]);
      appendOrderRow(orders,row);
      SpreadsheetApp.flush();
    }
    const props = PropertiesService.getScriptProperties();
    const sequence = Math.max(Number(props.getProperty(ORDER_SEQUENCE_PROPERTY) || 0), Number(entry.orderNumber.slice(3)));
    props.setProperty(ORDER_SEQUENCE_PROPERTY,String(sequence));
    reconcileReferralLedgerForSavedOrders(book,orders);
    SpreadsheetApp.flush();
    return {ok:true,requestId:entry.requestId,orderNumber:entry.orderNumber};
  } finally { lock.releaseLock(); }
}

function assertProductionLedger() {
  if (ScriptApp.getScriptId() !== "1YfNLgt5YZnDv8CwcR9zcGICM4v0jjfMCs9lzD_pWVh5M8O5Yc5xMVnhf" ||
      SPREADSHEET_ID !== "12YlQLXoM4yjy9dfZExeAQhEM-QMZZn_TyzbmHLN3L2A") throw Error("Unexpected checkout ledger");
}

function productionCheckoutCommand(payload) {
  assertProductionLedger();
  const props = PropertiesService.getScriptProperties();
  if (payload.action === "checkoutSchemaProbe") {
    if (props.getProperty("CLOUD_CHECKOUT_PROBE_V1") !== "passed") {
      diagnoseOrderWrite();
      props.setProperty("CLOUD_CHECKOUT_PROBE_V1","passed");
    }
    return {ok:true, probe:"passed", copyRemoved:true};
  }
  if (props.getProperty("CLOUD_CHECKOUT_PROBE_V1") !== "passed") throw Error("Schema probe pending");
  if (payload.action === "checkoutBootstrap") return {ok:true,scriptId:ScriptApp.getScriptId(),spreadsheetId:SPREADSHEET_ID,checkout:productionCheckoutSnapshot(true)};
  if (props.getProperty("CLOUD_CHECKOUT_ACTIVE") !== "1") throw Error("Inactive ledger writer");
  return appendProductionCloudOrder(payload.entry);
}
