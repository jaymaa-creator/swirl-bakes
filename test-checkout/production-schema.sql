CREATE TABLE IF NOT EXISTS checkout_sequence (
  id INTEGER PRIMARY KEY CHECK (id=1), last_number INTEGER NOT NULL DEFAULT 0, probe_ok INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO checkout_sequence(id) VALUES(1);
CREATE UNIQUE INDEX IF NOT EXISTS checkout_receipt_number ON checkout_orders(json_extract(receipt,'$.orderNumber'));
CREATE TRIGGER IF NOT EXISTS checkout_number_advance AFTER INSERT ON checkout_orders
BEGIN UPDATE checkout_sequence SET last_number=MAX(last_number,CAST(substr(json_extract(NEW.receipt,'$.orderNumber'),4) AS INTEGER)) WHERE id=1; END;
