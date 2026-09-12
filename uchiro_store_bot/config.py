import os

ADMIN_BOT_TOKEN = os.getenv("ADMIN_BOT_TOKEN", "8906347735:AAHiHksd28uRWd5YdsVTynYMv9vCz5rPuxg")
STORE_BOT_TOKEN = os.getenv("STORE_BOT_TOKEN", "8546642077:AAGeBkvSJ9NS8D3C8bEg_xdIjwMXftYJ0bU")

# Owner(s) - can add/remove other sellers. Comma separated telegram user ids.
OWNER_IDS = [int(x) for x in os.getenv("OWNER_IDS", "6594079594").split(",") if x.strip().isdigit()]

STORE_NAME = "Uchiro Store 🇰🇭"
CURRENCY = "$"
CATEGORIES = ["Account", "Fruit", "Gamepass"]
DB_PATH = os.getenv("DB_PATH", "store.db")

ADMIN_CONTACT_USERNAME = "noreakyout"  # @noreakyout
