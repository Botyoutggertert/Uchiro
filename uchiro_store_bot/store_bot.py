import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, Bot
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, filters

import database as db
from config import STORE_BOT_TOKEN, ADMIN_BOT_TOKEN, CATEGORIES, STORE_NAME, CURRENCY, ADMIN_CONTACT_USERNAME
from utils import format_price, save_telegram_photo

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def contact_kb(extra_rows=None):
    rows = extra_rows or []
    rows.append([InlineKeyboardButton("📞 ទាក់ទងម្ចាស់ហាង", url=f"https://t.me/{ADMIN_CONTACT_USERNAME}")])
    return InlineKeyboardMarkup(rows)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    db.track_user(update.effective_user.id, update.effective_user.username)
    text = (f"🛒 សួស្តី! សូមស្វាគមន៍មកកាន់ {STORE_NAME} 🇰🇭\n"
            "ហាងលក់ Account / Fruit / Gamepass Blox Fruits!\n\n"
            "🎮 មានជំនួយល្អៗសម្រាប់អ្នកលេងផងដែរ:\n"
            "/codes — Code ថ្មីៗ 🎁\n/tierlist — Fruit មួយណាល្អ 🍈\n/guide — វីដេអូបង្រៀន 📺\n\n"
            "សូមជ្រើសរើសប្រភេទខាងក្រោម ដើម្បីទិញ:")
    kb = [[InlineKeyboardButton(c, callback_data=f"cat_{c}")] for c in CATEGORIES]
    await update.message.reply_text(text, reply_markup=contact_kb(kb))


async def support_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("ត្រូវការជំនួយ? ចុចប៊ូតុងខាងក្រោមដើម្បីទាក់ទងម្ចាស់ហាងផ្ទាល់៖", reply_markup=contact_kb())


async def codes_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    codes = db.get_setting("codes_text")
    if not codes:
        return await update.message.reply_text("😅 មិនទាន់មាន Code ថ្មីទេ! សូមចាំមើលពេលក្រោយ។")
    await update.message.reply_text(
        f"🎁 Code ថ្មីៗ សម្រាប់ Blox Fruits!\n\n{codes}\n\n"
        "👉 របៀបប្រើ: ចូលហ្គេម → ចុច Setting (រូប Gear) → Redeem Code → Paste Code → Enter"
    )


async def tierlist_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tierlist = db.get_setting("tierlist_text")
    if not tierlist:
        return await update.message.reply_text("😅 មិនទាន់មាន Tier List ទេ! សូមចាំមើលពេលក្រោយ។")
    await update.message.reply_text(f"🍈 Fruit Tier List (ល្អទៅមិនល្អ):\n\n{tierlist}")


async def guide_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    guides = db.list_guides()
    if not guides:
        return await update.message.reply_text("😅 មិនទាន់មាន Guide ទេ! សូមចាំមើលពេលក្រោយ។")
    kb = [[InlineKeyboardButton(g["title"], callback_data=f"guide_{g['id']}")] for g in guides]
    await update.message.reply_text("📺 ជ្រើសរើស Guide ដែលចង់មើល:", reply_markup=InlineKeyboardMarkup(kb))


async def guide_select_cb(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    guide_id = int(query.data.split("_")[1])
    g = db.get_guide(guide_id)
    if not g:
        return await query.message.reply_text("រកមិនឃើញ Guide នេះទេ។")
    await query.message.reply_text(f"📺 {g['title']}\n▶️ {g['video_url']}")


async def category_cb(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    category = query.data.split("_", 1)[1]
    items = db.get_items_by_category(category)
    if not items:
        return await query.message.reply_text(f"📦 {category} — មិនទាន់មានស្តុកទេ។")

    if category == "Account":
        for it in items:
            caption = (f"📦 {it['category']} — {it['name']}\n💵 {format_price(it['price'], CURRENCY)}\n"
                       f"📝 {it['description']}\n📊 ស្តុកនៅសល់: {it['quantity']}")
            kb = InlineKeyboardMarkup([[InlineKeyboardButton("🛍 ទិញឥឡូវ", callback_data=f"buy_{it['id']}")]])
            photo_path = it["photo_file_id"]
            if photo_path and os.path.exists(photo_path):
                with open(photo_path, "rb") as f:
                    await query.message.reply_photo(f, caption=caption, reply_markup=kb)
            else:
                await query.message.reply_text(caption, reply_markup=kb)
        return

    lines = [f"📦 ស្តុក {category} ទាំងអស់:\n"]
    for idx, it in enumerate(items, start=1):
        lines.append(f"Option {idx}: {it['name']} — {format_price(it['price'], CURRENCY)} (ស្តុក {it['quantity']})")
    lines.append("\nចុចលេខខាងក្រោមដើម្បីទិញ:")

    buttons, row = [], []
    for idx, it in enumerate(items, start=1):
        row.append(InlineKeyboardButton(str(idx), callback_data=f"buy_{it['id']}"))
        if len(row) == 5:
            buttons.append(row)
            row = []
    if row:
        buttons.append(row)

    await query.message.reply_text("\n".join(lines), reply_markup=InlineKeyboardMarkup(buttons))


async def buy_cb(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    db.track_user(update.effective_user.id, update.effective_user.username)
    item_id = int(query.data.split("_")[1])
    item = db.get_item(item_id)
    if not item or not item["active"] or item["quantity"] <= 0:
        return await query.message.reply_text("សូមអភ័យទោស ទំនិញនេះអស់ស្តុកហើយ។")

    price_text = format_price(item["price"], CURRENCY)
    qr_path = db.get_setting("qr_photo_path")
    note = db.get_setting("payment_note", "")

    caption = f"🛍 អ្នកបានជ្រើសរើស: {item['name']}\n💵 សូមទូទាត់: {price_text}\n\n📱 ស្កេន QR ខាងក្រោមដើម្បីទូទាត់"
    if note:
        caption += f"\n{note}"
    caption += "\n\n✅ ទូទាត់រួច សូមចុចប៊ូតុង \"បញ្ជាក់\" ខាងក្រោម"

    kb = InlineKeyboardMarkup([[InlineKeyboardButton("✅ បញ្ជាក់ (ខ្ញុំបានទូទាត់)", callback_data=f"confirmbuy_{item_id}"),
                                 InlineKeyboardButton("❌ បោះបង់", callback_data="cancelbuy")]])
    if qr_path and os.path.exists(qr_path):
        with open(qr_path, "rb") as f:
            await query.message.reply_photo(f, caption=caption, reply_markup=kb)
    else:
        caption += "\n\n(ម្ចាស់ហាងមិនទាន់កំណត់ QR ទេ សូមទាក់ទងផ្ទាល់)"
        await query.message.reply_text(caption, reply_markup=kb)


async def confirm_buy_cb(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    item_id = int(query.data.split("_")[1])
    item = db.get_item(item_id)
    if not item or not item["active"] or item["quantity"] <= 0:
        return await query.message.reply_text("សូមអភ័យទោស ទំនិញនេះអស់ស្តុកហើយ។")
    context.user_data["buy_item_id"] = item_id
    context.user_data["state"] = "await_payment"
    await query.message.reply_text("សូមផ្ញើរូបភាព Screenshot នៃការទូទាត់មកទីនេះ:")


async def cancel_buy_cb(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    context.user_data.clear()
    await query.message.reply_text("បានបោះបង់ការទិញ។ ប្រើ /start ដើម្បីមើលទំនិញម្តងទៀត។")


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if context.user_data.get("state") != "await_payment":
        return
    item_id = context.user_data.get("buy_item_id")
    item = db.get_item(item_id)
    if not item:
        context.user_data.clear()
        return await update.message.reply_text("មានបញ្ហា សូម /start ម្តងទៀត។")

    file_id = update.message.photo[-1].file_id
    payment_photo_path = await save_telegram_photo(context.bot, file_id, "payments")
    buyer = update.effective_user
    order_id = db.create_order(item_id, buyer.id, buyer.username, payment_photo_path)
    context.user_data.clear()

    await update.message.reply_text(f"✅ បានទទួល Order #{order_id}! សូមរង់ចាំម្ចាស់ហាងផ្ទៀងផ្ទាត់។")

    admin_bot = Bot(token=ADMIN_BOT_TOKEN)
    caption = (f"🧾 Order ថ្មី #{order_id}\n👤 @{buyer.username or 'N/A'} (id: {buyer.id})\n"
               f"📦 {item['name']}\n💵 {format_price(item['price'], CURRENCY)}")
    kb = InlineKeyboardMarkup([[InlineKeyboardButton("✅ អនុម័ត", callback_data=f"appr_{order_id}"),
                                 InlineKeyboardButton("❌ បដិសេធ", callback_data=f"rej_{order_id}")]])
    for admin_id in db.all_admin_ids():
        try:
            with open(payment_photo_path, "rb") as f:
                await admin_bot.send_photo(admin_id, f, caption=caption, reply_markup=kb)
        except Exception as e:
            logger.warning(f"notify admin {admin_id} failed: {e}")


async def on_error(update, context: ContextTypes.DEFAULT_TYPE):
    logger.error("Store bot error", exc_info=context.error)
    try:
        if isinstance(update, Update) and update.effective_chat:
            await context.bot.send_message(update.effective_chat.id, "⚠️ មានបញ្ហាបច្ចេកទេស សូមព្យាយាមម្តងទៀត ឬចុច /start")
    except Exception:
        pass


def build_app():
    app = Application.builder().token(STORE_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("support", support_cmd))
    app.add_handler(CommandHandler("codes", codes_cmd))
    app.add_handler(CommandHandler("tierlist", tierlist_cmd))
    app.add_handler(CommandHandler("guide", guide_cmd))
    app.add_handler(CallbackQueryHandler(guide_select_cb, pattern=r"^guide_\d+$"))
    app.add_handler(CallbackQueryHandler(category_cb, pattern=r"^cat_"))
    app.add_handler(CallbackQueryHandler(buy_cb, pattern=r"^buy_\d+$"))
    app.add_handler(CallbackQueryHandler(confirm_buy_cb, pattern=r"^confirmbuy_\d+$"))
    app.add_handler(CallbackQueryHandler(cancel_buy_cb, pattern=r"^cancelbuy$"))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_error_handler(on_error)
    return app


if __name__ == "__main__":
    db.init_db()
    build_app().run_polling()
