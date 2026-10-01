// Manual incident probe. Copies Orders inside its current spreadsheet so native
// Google Table rules are reproduced, then removes only the copy it created.
function diagnoseOrderWrite() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const orders = spreadsheet.getSheetByName(ORDERS_SHEET_NAME);
  let probe = null;
  try {
    probe = orders.copyTo(spreadsheet);
    probe.setName("INCIDENT_PROBE_" + Utilities.getUuid().slice(0, 8));
    const report = { stage: "appendOrderRow", columns: probe.getLastColumn(), rows: probe.getLastRow() };
    console.log(JSON.stringify(report));
    const requestId = Utilities.getUuid();
    const headers = probe.getRange(1, 1, 1, probe.getLastColumn()).getValues()[0].map(normalizeHeader);
    const row = findNextOrderRow(probe, headers);
    appendOrderRow(probe, {
      requestId, requestFingerprint: "0".repeat(64),
      orderNumber: "DIAGNOSTIC-DO-NOT-FULFIL", createdAt: new Date(), status: "New", paid: false,
      name: "Temporary incident probe", whatsApp: "", saturdayBatch: parseCalendarDate("2026-10-10"),
      items: "Diagnostic only", total: "S$0.00", fulfilment: COLLECTION_OPTION,
      collectionSlot: "11am-12pm", deliveryAddress: "", notes: "Temporary copy only",
      referralProgramVersion: "", customerKey: "", customerReferralCode: "", enteredReferralCode: "",
      referralDiscount: 0, creditRedeemed: 0, creditSourceEventId: "", amountDue: 0, referredByCustomerKey: "",
    });
    SpreadsheetApp.flush();
    const saved = findOrderRequest(probe, requestId);
    if (saved?.orderNumber !== "DIAGNOSTIC-DO-NOT-FULFIL") throw new Error("Probe request identity was not saved");
    if (probe.getRange(row, headers.indexOf("paid") + 1).getValue() !== false) throw new Error("Probe Paid is not boolean false");
    if (probe.getRange(row, headers.indexOf("status") + 1).getValue() !== "New") throw new Error("Probe Status is not New");
    console.log("ORDER_WRITE_PROBE_PASSED");
  } catch (error) {
    console.error("ORDER_WRITE_PROBE_FAILED " + String(error.stack || error));
    throw error;
  } finally {
    if (probe) {
      spreadsheet.deleteSheet(probe);
      console.log("ORDER_WRITE_PROBE_COPY_REMOVED");
    }
  }
}

// Read-only health inspection: no email, order or Script Property mutation.
function diagnoseProductionHealth() {
  const status = collectProductionHealthStatus();
  console.log(JSON.stringify({ ok: status.failures.length === 0, failures: status.failures }));
}
