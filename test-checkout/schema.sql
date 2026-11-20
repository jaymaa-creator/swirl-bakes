CREATE TABLE IF NOT EXISTS checkout_baseline (
 id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL DEFAULT 0,
 captured INTEGER NOT NULL DEFAULT 0, snapshot TEXT
);
INSERT OR IGNORE INTO checkout_baseline(id) VALUES(1);
CREATE TABLE IF NOT EXISTS checkout_orders (
 request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, revision INTEGER NOT NULL,
 created INTEGER NOT NULL, receipt TEXT NOT NULL, payment_id TEXT NOT NULL UNIQUE, token TEXT NOT NULL,
 reserved TEXT, ledger_row TEXT, delivered INTEGER NOT NULL DEFAULT 0, retry_after INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS checkout_overlay ON checkout_orders(created) WHERE reserved IS NOT NULL;
CREATE INDEX IF NOT EXISTS checkout_delivery ON checkout_orders(retry_after,created) WHERE delivered=0;
CREATE TRIGGER IF NOT EXISTS checkout_guard BEFORE INSERT ON checkout_orders
WHEN NEW.revision != (SELECT revision FROM checkout_baseline WHERE id=1)
BEGIN SELECT RAISE(ABORT,'checkout revision changed'); END;
CREATE TRIGGER IF NOT EXISTS checkout_advance AFTER INSERT ON checkout_orders
BEGIN UPDATE checkout_baseline SET revision=revision+1 WHERE id=1; END;
