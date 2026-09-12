"""
UCHIRO STORE - Telegram Bot Configuration
Configure your Telegram Bot Token, Admin IDs, and Store WebApp URL here.
"""

import os

# ==========================================================
# 🤖 BOT CREDENTIALS & TOKENS
# ==========================================================

# Your Telegram Bot Token from @BotFather
# Example: "7123456789:AAFlkjw9e8u2h3kjh4kj5h6k7j8h9k0"
# NOTE: No hardcoded fallback on purpose -- a previous version of this file had a
# live token committed here. That token should be treated as compromised: revoke
# it via @BotFather and generate a new one, then set it only as an env var below.
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
if not BOT_TOKEN:
    raise RuntimeError(
        "TELEGRAM_BOT_TOKEN environment variable is not set. "
        "Get a token from @BotFather and set it in your environment (never hardcode it here)."
    )

# Telegram Admin Chat IDs (Users who receive admin alerts and order notifications)
# Example: "123456789,987654321"
ADMIN_CHAT_IDS = [
    int(x) for x in os.getenv("TELEGRAM_ADMIN_CHAT_IDS", "").split(",") if x.strip().isdigit()
]
if not ADMIN_CHAT_IDS:
    print("WARNING: TELEGRAM_ADMIN_CHAT_IDS is not set -- no admin will receive order alerts.")

# Admin Telegram handle
ADMIN_USERNAME = "@Noreakyout"

# Official Telegram Channel URL
TELEGRAM_CHANNEL_URL = "https://t.me/uchirostore"

# Admin Telegram Contact
ADMIN_TELEGRAM_URL = "https://t.me/Noreakyout"

# Official Phone support
SUPPORT_PHONE = "+855 16866125"

# ==========================================================
# 🌐 WEBAPP & STORE URL
# ==========================================================

# The URL of your Uchiro Store web application (opens directly inside Telegram Mini App)
WEBAPP_URL = os.getenv("STORE_WEBAPP_URL", "https://uchiro-store.ai.studio")

# Secret Admin Panel direct URL (Protected by Admin PIN / credentials)
ADMIN_PANEL_URL = os.getenv("ADMIN_PANEL_URL", "https://uchiro-store.ai.studio/adminpanel")

# ==========================================================
# 🇰🇭 KHQR & BAKONG PAYMENT SETTINGS
# ==========================================================

# Bakong Account ID for KHQR generation
BAKONG_ACCOUNT_ID = os.getenv("BAKONG_ACCOUNT_ID", "khinsovan_noreakyout@bkrt")
MERCHANT_NAME = os.getenv("MERCHANT_NAME", "UCHIRO STORE")
MERCHANT_CITY = os.getenv("MERCHANT_CITY", "Phnom Penh")
MINIMUM_TOPUP_USD = 0.50

# ==========================================================
# 📦 AUTO-DELIVERY & FULFILLMENT SETTINGS
# ==========================================================

# Warranty period for Roblox accounts (in days)
ACCOUNT_WARRANTY_DAYS = 14

# Estimated wait time for Gift Gamepass orders (in minutes)
GIFT_DELIVERY_MINUTES = "15-30"

# Welcome message in Telegram Bot
WELCOME_MESSAGE = """
🔥 **Welcome to Uchiro Store Bot!** 🇰🇭
Your #1 Trusted Roblox Accounts, Gamepasses, MM2 & Blox Fruits Items Store in Cambodia.

⚡ **Features:**
• Instant KHQR Payment (ABA, ACLEDA, Bakong)
• Automated Account Delivery with 14-Day Warranty & Live 2FA
• Fast In-Game Trades with Admin (@Noreakyout)
• Roblox Gift Gamepasses (15-30 mins delivery)

📞 **Support:** +855 16866125
📢 **Channel:** @uchirostore
👑 **Admin:** @Noreakyout

👇 Tap the button below to open the **Uchiro Store Mini App**!
"""
