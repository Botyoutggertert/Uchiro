#!/usr/bin/env python3
"""
UCHIRO STORE - Telegram Store & Admin Bot
Integrates with Uchiro Store WebApp, handles customer orders, sends instant KHQR alerts,
and provides administrative controls for managing accounts, warranty, gifts, and in-game trades.
"""

import sys
import logging
from config import (
    BOT_TOKEN,
    ADMIN_CHAT_IDS,
    WEBAPP_URL,
    ADMIN_PANEL_URL,
    ADMIN_USERNAME,
    TELEGRAM_CHANNEL_URL,
    ADMIN_TELEGRAM_URL,
    SUPPORT_PHONE,
    WELCOME_MESSAGE,
    BAKONG_ACCOUNT_ID,
    MERCHANT_NAME,
)

# Configure logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

def check_dependencies():
    try:
        import telegram
        from telegram import (
            InlineKeyboardButton,
            InlineKeyboardMarkup,
            WebAppInfo,
            Update,
        )
        from telegram.ext import (
            Application,
            CommandHandler,
            ContextTypes,
            CallbackQueryHandler,
        )
        return True
    except ImportError:
        print("[!] python-telegram-bot is required to run this script.")
        print("[!] Install it using: pip install python-telegram-bot")
        return False

def main():
    if not check_dependencies():
        sys.exit(1)

    from telegram import (
        InlineKeyboardButton,
        InlineKeyboardMarkup,
        WebAppInfo,
        Update,
    )
    from telegram.ext import (
        Application,
        CommandHandler,
        ContextTypes,
        CallbackQueryHandler,
    )

    if BOT_TOKEN == "YOUR_TELEGRAM_BOT_TOKEN_HERE" or not BOT_TOKEN:
        print("[!] Please set your TELEGRAM_BOT_TOKEN in config.py first.")
        print("[!] Example: BOT_TOKEN = '123456789:ABCDefgh-your-token'")
        sys.exit(1)

    app = Application.builder().token(BOT_TOKEN).build()

    # /start command handler
    async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
        chat_id = update.effective_chat.id
        is_admin = chat_id in ADMIN_CHAT_IDS

        keyboard = [
            [
                InlineKeyboardButton(
                    "🛒 OPEN UCHIRO STORE (MINI APP)",
                    web_app=WebAppInfo(url=WEBAPP_URL),
                )
            ],
            [
                InlineKeyboardButton("📢 Official Channel", url=TELEGRAM_CHANNEL_URL),
                InlineKeyboardButton("👑 Contact Admin", url=ADMIN_TELEGRAM_URL),
            ],
        ]

        if is_admin:
            keyboard.append([
                InlineKeyboardButton(
                    "🔐 OPEN ADMIN PANEL",
                    web_app=WebAppInfo(url=ADMIN_PANEL_URL),
                )
            ])

        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(
            WELCOME_MESSAGE,
            reply_markup=reply_markup,
            parse_mode="Markdown",
        )

    # /admin command handler
    async def admin_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
        chat_id = update.effective_chat.id
        if chat_id not in ADMIN_CHAT_IDS:
            await update.message.reply_text(
                "❌ Unauthorized. This command is restricted to Uchiro Store Admins only."
            )
            return

        admin_text = f"""
👑 **UCHIRO STORE - ADMIN CONTROLS**

• **Merchant:** {MERCHANT_NAME}
• **Bakong ID:** `{BAKONG_ACCOUNT_ID}`
• **Support Phone:** `{SUPPORT_PHONE}`
• **Admin Username:** {ADMIN_USERNAME}

🔗 **Direct Admin Panel URL:**
{ADMIN_PANEL_URL}
        """
        keyboard = [
            [
                InlineKeyboardButton(
                    "🔐 Open Secret Admin Dashboard",
                    web_app=WebAppInfo(url=ADMIN_PANEL_URL),
                )
            ],
            [
                InlineKeyboardButton("👥 Open Customer Store", web_app=WebAppInfo(url=WEBAPP_URL))
            ]
        ]
        await update.message.reply_text(
            admin_text,
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )

    # /help command handler
    async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
        help_text = f"""
ℹ️ **UCHIRO STORE CUSTOMER SUPPORT**

• 📱 **Phone:** `{SUPPORT_PHONE}`
• 👑 **Admin Telegram:** {ADMIN_USERNAME}
• 📢 **Channel:** {TELEGRAM_CHANNEL_URL}
• 🛡️ **Account Warranty:** 14-Day Free Replacement
• 🎁 **Gift Items:** Dispatched within 15-30 minutes
• 🤝 **In-Game Trades:** Contact admin after KHQR payment
        """
        keyboard = [
            [InlineKeyboardButton("🛒 Open Store Mini App", web_app=WebAppInfo(url=WEBAPP_URL))],
            [InlineKeyboardButton("👑 Chat with Admin", url=ADMIN_TELEGRAM_URL)]
        ]
        await update.message.reply_text(
            help_text,
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )

    # Register handlers
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("admin", admin_command))
    app.add_handler(CommandHandler("help", help_command))

    print("🤖 Uchiro Store Telegram Bot is running...")
    print(f"🌐 WebApp URL: {WEBAPP_URL}")
    print(f"🔐 Admin URL: {ADMIN_PANEL_URL}")
    app.run_polling()

if __name__ == "__main__":
    main()
