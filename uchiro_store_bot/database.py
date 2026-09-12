import sqlite3
from contextlib import contextmanager
from config import DB_PATH, OWNER_IDS


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        description TEXT DEFAULT '',
        photo_file_id TEXT,
        delivery_info TEXT DEFAULT '',
        quantity INTEGER DEFAULT 1,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        buyer_chat_id INTEGER NOT NULL,
        buyer_username TEXT,
        payment_photo_file_id TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS admins (
        chat_id INTEGER PRIMARY KEY,
        username TEXT,
        added_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS users (
        chat_id INTEGER PRIMARY KEY,
        username TEXT,
        first_seen TEXT DEFAULT CURRENT_TIMESTAMP,
        last_seen TEXT DEFAULT CURRENT_TIMESTAMP
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS guides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        video_url TEXT NOT NULL,
        added_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""")
    conn.commit()
    conn.close()


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.commit()
        conn.close()


# ---- Items ----

def add_item(category, name, price, description, photo_file_id, delivery_info, quantity):
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO items (category, name, price, description, photo_file_id, delivery_info, quantity) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (category, name, price, description, photo_file_id, delivery_info, quantity),
        )
        return cur.lastrowid


def get_items_by_category(category, only_active=True):
    with get_conn() as conn:
        q = "SELECT * FROM items WHERE category = ?"
        if only_active:
            q += " AND active = 1 AND quantity > 0"
        q += " ORDER BY id DESC"
        return conn.execute(q, (category,)).fetchall()


def get_all_items():
    with get_conn() as conn:
        return conn.execute("SELECT * FROM items ORDER BY category, id DESC").fetchall()


def get_item(item_id):
    with get_conn() as conn:
        return conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()


def update_item_field(item_id, field, value):
    allowed = {"category", "name", "price", "description", "photo_file_id",
               "delivery_info", "quantity", "active"}
    if field not in allowed:
        raise ValueError("bad field")
    with get_conn() as conn:
        conn.execute(f"UPDATE items SET {field} = ? WHERE id = ?", (value, item_id))


def delete_item(item_id):
    with get_conn() as conn:
        conn.execute("DELETE FROM items WHERE id = ?", (item_id,))


def decrement_stock(item_id):
    with get_conn() as conn:
        conn.execute("UPDATE items SET quantity = MAX(quantity - 1, 0) WHERE id = ?", (item_id,))
        row = conn.execute("SELECT quantity FROM items WHERE id = ?", (item_id,)).fetchone()
        if row and row["quantity"] <= 0:
            conn.execute("UPDATE items SET active = 0 WHERE id = ?", (item_id,))


# ---- Orders ----

def create_order(item_id, buyer_chat_id, buyer_username, payment_photo_file_id):
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO orders (item_id, buyer_chat_id, buyer_username, payment_photo_file_id) "
            "VALUES (?, ?, ?, ?)",
            (item_id, buyer_chat_id, buyer_username, payment_photo_file_id),
        )
        return cur.lastrowid


def get_order(order_id):
    with get_conn() as conn:
        return conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()


def get_orders_by_status(status="pending"):
    with get_conn() as conn:
        return conn.execute("SELECT * FROM orders WHERE status = ? ORDER BY id DESC", (status,)).fetchall()


def update_order_status(order_id, status):
    with get_conn() as conn:
        conn.execute("UPDATE orders SET status = ? WHERE id = ?", (status, order_id))


# ---- Admins / sellers ----

def add_seller(chat_id, username=None):
    with get_conn() as conn:
        conn.execute("INSERT OR REPLACE INTO admins (chat_id, username) VALUES (?, ?)", (chat_id, username))


def remove_seller(chat_id):
    with get_conn() as conn:
        conn.execute("DELETE FROM admins WHERE chat_id = ?", (chat_id,))


def list_sellers():
    with get_conn() as conn:
        return conn.execute("SELECT * FROM admins ORDER BY added_at").fetchall()


def is_admin_id(chat_id):
    if chat_id in OWNER_IDS:
        return True
    with get_conn() as conn:
        row = conn.execute("SELECT 1 FROM admins WHERE chat_id = ?", (chat_id,)).fetchone()
        return row is not None


def all_admin_ids():
    with get_conn() as conn:
        rows = conn.execute("SELECT chat_id FROM admins").fetchall()
    return list(set(OWNER_IDS) | {r["chat_id"] for r in rows})


# ---- Settings (payment QR / note) ----

def set_setting(key, value):
    with get_conn() as conn:
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))


def get_setting(key, default=None):
    with get_conn() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


# ---- Users (who uses the store bot) ----

def track_user(chat_id, username):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO users (chat_id, username) VALUES (?, ?) "
            "ON CONFLICT(chat_id) DO UPDATE SET username = excluded.username, last_seen = CURRENT_TIMESTAMP",
            (chat_id, username),
        )


def count_users():
    with get_conn() as conn:
        return conn.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]


def list_users(limit=30):
    with get_conn() as conn:
        return conn.execute("SELECT * FROM users ORDER BY last_seen DESC LIMIT ?", (limit,)).fetchall()


def count_orders_by_status():
    with get_conn() as conn:
        rows = conn.execute("SELECT status, COUNT(*) c FROM orders GROUP BY status").fetchall()
    return {r["status"]: r["c"] for r in rows}


# ---- Guides (tutorial video links) ----

def add_guide(title, video_url):
    with get_conn() as conn:
        cur = conn.execute("INSERT INTO guides (title, video_url) VALUES (?, ?)", (title, video_url))
        return cur.lastrowid


def list_guides():
    with get_conn() as conn:
        return conn.execute("SELECT * FROM guides ORDER BY id").fetchall()


def get_guide(guide_id):
    with get_conn() as conn:
        return conn.execute("SELECT * FROM guides WHERE id = ?", (guide_id,)).fetchone()


def delete_guide(guide_id):
    with get_conn() as conn:
        conn.execute("DELETE FROM guides WHERE id = ?", (guide_id,))
