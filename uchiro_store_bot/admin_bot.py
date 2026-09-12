import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, Bot
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, filters

import database as db
from config import ADMIN_BOT_TOKEN, STORE_BOT_TOKEN, CATEGORIES, CURRENCY
from utils import format_price, save_telegram_photo

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

EDITABLE_FIELDS = ["name", "price", "description", "quantity", "delivery_info", "photo", "active"]


def is_admin(update: Update) -> bool:
    return update.effective_user and db.is_admin_id(update.effective_user.id)


def is_owner(update: Update) -> bool:
    from config import OWNER_IDS
    return update.effective_user and update.effective_user.id in OWNER_IDS


async def deny(update: Update):
    if update.callback_query:
        await update.callback_query.answer("អ្នកមិនមែនជា Admin ទេ", show_alert=True)
    else:
        await update.message.reply_text("អ្នកមិនមែនជា Admin ទេ។")


def caption_of(item, item_id=None):
    header = f"🆔 #{item_id}\n" if item_id else ""
    return (f"{header}📦 {item['category']} — {item['name']}\n"
            f"💵 {format_price(item['price'], CURRENCY)}\n📝 {item['description']}\n📊 ស្តុក: {item['quantity']}")


# ---- start / help ----

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    text = ("👋 Uchiro Store — Admin Bot\n\n"
            "📦 Account (មានរូបភាព):\n/additem - បន្ថែម Account ម្តងមួយ\n\n"
            "⚡ Fruit/Gamepass (លឿន បន្ថែមច្រើនម្តងតែម្តង):\n"
            "/addfruit - បន្ថែម Fruit ច្រើនក្នុងម្តង\n/addgamepass - បន្ថែម Gamepass ច្រើនក្នុងម្តង\n"
            "/setstock <id> <ចំនួន> - កែស្តុកលឿន\n/setprice <id> <តម្លៃ> - កែតម្លៃលឿន\n\n"
            "🎮 ជួយ Player (ទាក់ទាញអ្នកលេងចូល Bot):\n"
            "/setcodes - Update Redeem Code ថ្មី\n/settierlist - Update Fruit Tier List\n"
            "/addguide - បន្ថែម Video Guide\n/removeguide <id> - លុប Guide\n/guides - មើល Guide ទាំងអស់\n\n"
            "🛠 គ្រប់គ្រង:\n/listitems - មើល/កែ/លុប ទំនិញ\n/orders - Order កំពុងរង់ចាំ\n"
            "/setpayment - កំណត់ QR + ព័ត៌មានទូទាត់\n/showpayment - មើល QR បច្ចុប្បន្ន\n"
            "/stats - ស្ថិតិហាង\n/users - អ្នកប្រើប្រាស់ចុងក្រោយ")
    if is_owner(update):
        text += "\n\n👑 Owner:\n/addseller <id> - បន្ថែម Admin\n/removeseller <id> - លុប Admin\n/sellers - មើលបញ្ជី Admin"
    await update.message.reply_text(text)


# ---- add item ----

async def setpayment(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    context.user_data["state"] = "await_qr"
    await update.message.reply_text("សូមផ្ញើរូបភាព QR Code សម្រាប់ទូទាត់:")


async def showpayment(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    qr = db.get_setting("qr_photo_path")
    note = db.get_setting("payment_note", "")
    if not qr or not os.path.exists(qr):
        return await update.message.reply_text("មិនទាន់កំណត់ QR ទេ។ ប្រើ /setpayment")
    with open(qr, "rb") as f:
        await update.message.reply_photo(f, caption=note or "QR ទូទាត់បច្ចុប្បន្ន")


async def stats_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    total_users = db.count_users()
    total_items = len(db.get_all_items())
    orders = db.count_orders_by_status()
    text = (
        "📊 ស្ថិតិហាង\n\n"
        f"👥 អ្នកប្រើប្រាស់សរុប (ធ្លាប់ចូល Store Bot): {total_users}\n"
        f"📦 ទំនិញសរុបក្នុងស្តុក: {total_items}\n\n"
        f"🧾 Order កំពុងរង់ចាំ: {orders.get('pending', 0)}\n"
        f"✅ Order អនុម័តរួច: {orders.get('approved', 0)}\n"
        f"❌ Order បដិសេធ: {orders.get('rejected', 0)}"
    )
    await update.message.reply_text(text)


async def users_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    users = db.list_users(30)
    if not users:
        return await update.message.reply_text("មិនទាន់មានអ្នកប្រើប្រាស់ទេ។")
    lines = [f"@{u['username'] or 'N/A'} (id: {u['chat_id']}) — ចុងក្រោយ {u['last_seen']}" for u in users]
    await update.message.reply_text(f"👥 អ្នកប្រើប្រាស់ចុងក្រោយ ({db.count_users()} សរុប):\n\n" + "\n".join(lines))


async def setcodes(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    context.user_data.clear()
    context.user_data["state"] = "await_codes"
    await update.message.reply_text("🎁 វាយ Code ថ្មីទាំងអស់ (១បន្ទាត់ = ១ Code):")


async def settierlist(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    context.user_data.clear()
    context.user_data["state"] = "await_tierlist"
    await update.message.reply_text("🍈 វាយ Fruit Tier List ថ្មី (វាយបែបណាក៏បាន):")


async def addguide(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    text = " ".join(context.args)
    if "|" not in text:
        return await update.message.reply_text("ប្រើ: /addguide ចំណងជើង | Link YouTube\nឧ. /addguide របៀបយក Dough V4 | https://youtu.be/xxxx")
    title, url = [p.strip() for p in text.split("|", 1)]
    guide_id = db.add_guide(title, url)
    await update.message.reply_text(f"✅ បានបន្ថែម Guide #{guide_id}: {title}")


async def removeguide(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    if not context.args or not context.args[0].isdigit():
        return await update.message.reply_text("ប្រើ: /removeguide <guide_id>")
    db.delete_guide(int(context.args[0]))
    await update.message.reply_text("✅ បានលុប Guide")


async def guides_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    guides = db.list_guides()
    if not guides:
        return await update.message.reply_text("មិនទាន់មាន Guide ទេ។ ប្រើ /addguide")
    lines = [f"#{g['id']} {g['title']} — {g['video_url']}" for g in guides]
    await update.message.reply_text("📺 Guide ទាំងអស់:\n\n" + "\n".join(lines))


async def addfruit(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    context.user_data.clear()
    context.user_data["state"] = "bulk_add"
    context.user_data["bulk_category"] = "Fruit"
    await update.message.reply_text(
        "🍎 វាយបញ្ជីផ្លែឈើ (១បន្ទាត់ = ១មុខ) ទម្រង់៖\n"
        "ឈ្មោះ, តម្លៃ, ស្តុក\n\n"
        "ឧទាហរណ៍ (វាយច្រើនបន្ទាត់ម្តងបាន):\n"
        "East Dragon, 1.25, 3\n"
        "Buddha, 1.25, 1\n"
        "Rocket, 1, 5\n\n"
        "ផ្ញើមកតែម្តង Bot នឹងបន្ថែមទាំងអស់ភ្លាមៗ។ /cancel ដើម្បីបោះបង់"
    )


async def addgamepass(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    context.user_data.clear()
    context.user_data["state"] = "bulk_add"
    context.user_data["bulk_category"] = "Gamepass"
    await update.message.reply_text(
        "🎮 វាយបញ្ជី Gamepass (១បន្ទាត់ = ១មុខ) ទម្រង់៖\n"
        "ឈ្មោះ, តម្លៃ, ស្តុក\n\n"
        "ឧទាហរណ៍ (វាយច្រើនបន្ទាត់ម្តងបាន):\n"
        "2x Boost, 2, 10\n"
        "Fruit Notifier, 1.5, 10\n\n"
        "ផ្ញើមកតែម្តង Bot នឹងបន្ថែមទាំងអស់ភ្លាមៗ។ /cancel ដើម្បីបោះបង់"
    )


async def cancel_state(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    context.user_data.clear()
    await update.message.reply_text("បានបោះបង់។")


async def setstock(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    if len(context.args) != 2 or not context.args[0].isdigit():
        return await update.message.reply_text("ប្រើ: /setstock <item_id> <ចំនួន>")
    item_id = int(context.args[0])
    if not db.get_item(item_id):
        return await update.message.reply_text(f"រកមិនឃើញទំនិញ #{item_id} ទេ")
    try:
        qty = int(context.args[1])
    except ValueError:
        return await update.message.reply_text("ស្តុកត្រូវជាលេខគត់")
    db.update_item_field(item_id, "quantity", qty)
    db.update_item_field(item_id, "active", 1 if qty > 0 else 0)
    await update.message.reply_text(f"✅ បានកែស្តុក #{item_id} ទៅ {qty}")


async def setprice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    if len(context.args) != 2 or not context.args[0].isdigit():
        return await update.message.reply_text("ប្រើ: /setprice <item_id> <តម្លៃ>")
    item_id = int(context.args[0])
    if not db.get_item(item_id):
        return await update.message.reply_text(f"រកមិនឃើញទំនិញ #{item_id} ទេ")
    try:
        price = float(context.args[1])
    except ValueError:
        return await update.message.reply_text("តម្លៃត្រូវជាលេខ")
    db.update_item_field(item_id, "price", price)
    await update.message.reply_text(f"✅ បានកែតម្លៃ #{item_id} ទៅ {format_price(price, CURRENCY)}")


async def additem(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    context.user_data.clear()
    context.user_data["new_item"] = {}
    kb = [[InlineKeyboardButton(c, callback_data=f"newcat_{c}")] for c in CATEGORIES]
    await update.message.reply_text("ជ្រើសរើសប្រភេទ:", reply_markup=InlineKeyboardMarkup(kb))


async def newcat_cb(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not is_admin(update):
        return await deny(update)
    await query.answer()
    context.user_data["new_item"] = {"category": query.data.split("_", 1)[1]}
    context.user_data["state"] = "add_name"
    await query.edit_message_text(f"ប្រភេទ: {context.user_data['new_item']['category']}\n\nវាយឈ្មោះទំនិញ:")


ADD_STEPS = {
    "add_name": ("name", str, "តម្លៃប៉ុន្មាន? (លេខ)", "add_price"),
    "add_price": ("price", float, "ពិពណ៌នាលម្អិត:", "add_desc"),
    "add_desc": ("description", str, "ស្តុកប៉ុន្មាន? (លេខគត់)", "add_qty"),
    "add_qty": ("quantity", int, "ព័ត៌មានប្រគល់ជូន (Login/Password/Code) — វាយ - បើមិនទាន់មាន:", "add_delivery"),
    "add_delivery": ("delivery_info", str, "ផ្ញើរូបភាពទំនិញ:", "add_photo"),
}


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    state = context.user_data.get("state")
    if not state or not is_admin(update):
        return
    text = update.message.text.strip()

    if state in ADD_STEPS:
        field, cast, next_prompt, next_state = ADD_STEPS[state]
        try:
            value = "" if (field == "delivery_info" and text == "-") else cast(text)
        except ValueError:
            return await update.message.reply_text("សូមវាយឲ្យត្រឹមត្រូវ (លេខ) ម្តងទៀត:")
        context.user_data["new_item"][field] = value
        context.user_data["state"] = next_state
        return await update.message.reply_text(next_prompt)

    if state == "edit_value":
        return await apply_edit(update, context, text)

    if state == "await_payment_note":
        db.set_setting("payment_note", "" if text == "-" else text)
        context.user_data["state"] = None
        return await update.message.reply_text("✅ បានកំណត់ព័ត៌មានទូទាត់ (QR + Note) រួចរាល់។")

    if state == "await_codes":
        db.set_setting("codes_text", text)
        context.user_data["state"] = None
        return await update.message.reply_text("✅ បាន Update Code រួចរាល់! Player អាចមើលបានតាម /codes")

    if state == "await_tierlist":
        db.set_setting("tierlist_text", text)
        context.user_data["state"] = None
        return await update.message.reply_text("✅ បាន Update Tier List រួចរាល់! Player អាចមើលបានតាម /tierlist")

    if state == "bulk_add":
        category = context.user_data.get("bulk_category", "Fruit")
        added, errors = [], []
        for i, line in enumerate(text.splitlines(), start=1):
            line = line.strip()
            if not line:
                continue
            parts = [p.strip() for p in line.split(",")]
            if len(parts) < 2:
                errors.append(f"បន្ទាត់ {i}: '{line}' — ខ្វះ Comma (ត្រូវការ ឈ្មោះ, តម្លៃ, ស្តុក)")
                continue
            name = parts[0]
            try:
                price = float(parts[1])
                qty = int(parts[2]) if len(parts) > 2 and parts[2] else 1
            except ValueError:
                errors.append(f"បន្ទាត់ {i}: '{line}' — តម្លៃ/ស្តុកមិនមែនជាលេខ")
                continue
            item_id = db.add_item(category, name, price, "", None, "", qty)
            added.append(f"#{item_id} {name}")
        context.user_data.clear()
        reply = f"✅ បានបន្ថែម {len(added)} មុខ ចូល {category}:\n" + "\n".join(added) if added else "គ្មានទំនិញត្រូវបានបន្ថែមទេ។"
        if errors:
            reply += "\n\n⚠️ បញ្ហា:\n" + "\n".join(errors)
        return await update.message.reply_text(reply)


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    state = context.user_data.get("state")
    if not state or not is_admin(update):
        return
    file_id = update.message.photo[-1].file_id

    if state == "add_photo":
        path = await save_telegram_photo(context.bot, file_id, "items")
        item = context.user_data["new_item"]
        item["photo_path"] = path
        context.user_data["state"] = None
        kb = InlineKeyboardMarkup([[InlineKeyboardButton("✅ រក្សាទុក", callback_data="save_item"),
                                     InlineKeyboardButton("❌ បោះបង់", callback_data="cancel_item")]])
        with open(path, "rb") as f:
            return await update.message.reply_photo(f, caption=caption_of(item), reply_markup=kb)

    if state == "edit_value" and context.user_data.get("edit_field") == "photo":
        path = await save_telegram_photo(context.bot, file_id, "items")
        return await apply_edit(update, context, path)

    if state == "await_qr":
        path = await save_telegram_photo(context.bot, file_id, "settings")
        db.set_setting("qr_photo_path", path)
        context.user_data["state"] = "await_payment_note"
        return await update.message.reply_text(
            "✅ បាន Save QR។ សូមវាយព័ត៌មានទូទាត់ (ឧ. ABA: 000 111 222 - NAME) — វាយ - បើមិនចង់ដាក់:"
        )


async def save_item_cb(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not is_admin(update):
        return await deny(update)
    await query.answer()
    if query.data == "cancel_item":
        context.user_data.clear()
        return await query.edit_message_caption("បានបោះបង់។")
    item = context.user_data.get("new_item", {})
    item_id = db.add_item(item["category"], item["name"], item["price"], item["description"],
                           item["photo_path"], item.get("delivery_info", ""), item["quantity"])
    context.user_data.clear()
    await query.edit_message_caption(f"✅ រក្សាទុករួច! (ID #{item_id})")


# ---- list / edit / delete ----

async def listitems(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    items = db.get_all_items()
    if not items:
        return await update.message.reply_text("មិនទាន់មានទំនិញ។ ប្រើ /additem")
    for it in items:
        status = "🟢" if it["active"] and it["quantity"] > 0 else "🔴"
        kb = InlineKeyboardMarkup([[InlineKeyboardButton("✏️ កែប្រែ", callback_data=f"edit_{it['id']}"),
                                     InlineKeyboardButton("🗑 លុប", callback_data=f"del_{it['id']}")]])
        caption = f"{status} {caption_of(it, it['id'])}"
        if it["photo_file_id"] and os.path.exists(it["photo_file_id"]):
            with open(it["photo_file_id"], "rb") as f:
                await update.message.reply_photo(f, caption=caption, reply_markup=kb)
        else:
            await update.message.reply_text(caption, reply_markup=kb)


async def delete_cb(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not is_admin(update):
        return await deny(update)
    await query.answer()
    item_id = int(query.data.split("_")[1])
    db.delete_item(item_id)
    await query.message.reply_text(f"🗑 បានលុប #{item_id}")


async def edit_start_cb(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not is_admin(update):
        return await deny(update)
    await query.answer()
    item_id = int(query.data.split("_")[1])
    context.user_data["edit_item_id"] = item_id
    kb = [[InlineKeyboardButton(f, callback_data=f"field_{f}")] for f in EDITABLE_FIELDS]
    await query.message.reply_text("កែផ្នែកណា?", reply_markup=InlineKeyboardMarkup(kb))


async def edit_field_cb(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not is_admin(update):
        return await deny(update)
    await query.answer()
    field = query.data.split("_", 1)[1]
    context.user_data["edit_field"] = field
    context.user_data["state"] = "edit_value"
    prompt = "ផ្ញើរូបភាពថ្មី:" if field == "photo" else \
        ("វាយ 1 ដើម្បីបើក ឬ 0 ដើម្បីបិទ:" if field == "active" else f"វាយតម្លៃថ្មីសម្រាប់ {field}:")
    await query.message.reply_text(prompt)


async def apply_edit(update: Update, context: ContextTypes.DEFAULT_TYPE, raw_value):
    item_id = context.user_data.get("edit_item_id")
    field = context.user_data.get("edit_field")
    if item_id is None or field is None:
        return
    db_field = "photo_file_id" if field == "photo" else field
    value = raw_value
    try:
        if field == "price":
            value = float(raw_value)
        elif field in ("quantity", "active"):
            value = int(raw_value)
    except ValueError:
        return await update.message.reply_text("សូមវាយជាលេខ:")
    db.update_item_field(item_id, db_field, value)
    context.user_data["state"] = None
    context.user_data.pop("edit_item_id", None)
    context.user_data.pop("edit_field", None)
    await update.message.reply_text(f"✅ បានកែ {field} របស់ #{item_id}")


# ---- orders ----

async def orders_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    pending = db.get_orders_by_status("pending")
    if not pending:
        return await update.message.reply_text("មិនមាន Order កំពុងរង់ចាំ។")
    for order in pending:
        item = db.get_item(order["item_id"])
        caption = (f"🧾 Order #{order['id']}\n👤 @{order['buyer_username'] or 'N/A'} ({order['buyer_chat_id']})\n"
                   f"📦 {item['name'] if item else 'N/A'}\n💵 {format_price(item['price'], CURRENCY) if item else '?'}")
        kb = InlineKeyboardMarkup([[InlineKeyboardButton("✅ អនុម័ត", callback_data=f"appr_{order['id']}"),
                                     InlineKeyboardButton("❌ បដិសេធ", callback_data=f"rej_{order['id']}")]])
        if order["payment_photo_file_id"] and os.path.exists(order["payment_photo_file_id"]):
            with open(order["payment_photo_file_id"], "rb") as f:
                await update.message.reply_photo(f, caption=caption, reply_markup=kb)
        else:
            await update.message.reply_text(caption, reply_markup=kb)


async def order_decision_cb(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not is_admin(update):
        return await deny(update)
    await query.answer()
    action, order_id = query.data.split("_")
    order_id = int(order_id)
    order = db.get_order(order_id)
    if not order or order["status"] != "pending":
        return await query.message.reply_text("Order នេះដោះស្រាយរួចហើយ។")

    item = db.get_item(order["item_id"])
    store_bot = Bot(token=STORE_BOT_TOKEN)

    if action == "appr":
        db.update_order_status(order_id, "approved")
        db.decrement_stock(order["item_id"])
        msg = f"🎉 ការទូទាត់សម្រាប់ {item['name']} ត្រូវបានអនុម័ត! អរគុណដែលទិញនៅ Uchiro Store 🇰🇭"
        if item["delivery_info"]:
            msg += f"\n\n🔑 {item['delivery_info']}"
        else:
            msg += "\n\nម្ចាស់ហាងនឹងផ្ញើព័ត៌មានឲ្យអ្នកឆាប់ៗ។"
        await store_bot.send_message(order["buyer_chat_id"], msg)
        await query.message.reply_text(f"✅ អនុម័ត #{order_id}")
    else:
        db.update_order_status(order_id, "rejected")
        await store_bot.send_message(order["buyer_chat_id"],
                                      f"❌ ការទូទាត់សម្រាប់ {item['name'] if item else ''} មិនត្រូវបានអនុម័តទេ។ សូមទាក់ទងម្ចាស់ហាង។")
        await query.message.reply_text(f"❌ បដិសេធ #{order_id}")


# ---- seller management (owner only) ----

async def addseller(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_owner(update):
        return await deny(update)
    if not context.args or not context.args[0].isdigit():
        return await update.message.reply_text("ប្រើ: /addseller <chat_id>")
    chat_id = int(context.args[0])
    db.add_seller(chat_id)
    await update.message.reply_text(f"✅ បានបន្ថែម Admin: {chat_id}")


async def removeseller(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_owner(update):
        return await deny(update)
    if not context.args or not context.args[0].isdigit():
        return await update.message.reply_text("ប្រើ: /removeseller <chat_id>")
    chat_id = int(context.args[0])
    db.remove_seller(chat_id)
    await update.message.reply_text(f"✅ បានលុប Admin: {chat_id}")


async def sellers_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update):
        return await deny(update)
    from config import OWNER_IDS
    lines = [f"👑 Owner: {oid}" for oid in OWNER_IDS]
    lines += [f"🧑‍💼 Admin: {s['chat_id']}" for s in db.list_sellers()]
    await update.message.reply_text("\n".join(lines) or "មិនមាន Admin ណាទេ។")


# ---- build ----

async def on_error(update, context: ContextTypes.DEFAULT_TYPE):
    logger.error("Admin bot error", exc_info=context.error)
    try:
        if isinstance(update, Update) and update.effective_chat:
            await context.bot.send_message(update.effective_chat.id, "⚠️ មានបញ្ហាបច្ចេកទេស សូមព្យាយាមម្តងទៀត។")
    except Exception:
        pass


def build_app():
    app = Application.builder().token(ADMIN_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("additem", additem))
    app.add_handler(CommandHandler("addfruit", addfruit))
    app.add_handler(CommandHandler("addgamepass", addgamepass))
    app.add_handler(CommandHandler("setstock", setstock))
    app.add_handler(CommandHandler("setprice", setprice))
    app.add_handler(CommandHandler("cancel", cancel_state))
    app.add_handler(CommandHandler("setcodes", setcodes))
    app.add_handler(CommandHandler("settierlist", settierlist))
    app.add_handler(CommandHandler("addguide", addguide))
    app.add_handler(CommandHandler("removeguide", removeguide))
    app.add_handler(CommandHandler("guides", guides_cmd))
    app.add_handler(CommandHandler("listitems", listitems))
    app.add_handler(CommandHandler("orders", orders_cmd))
    app.add_handler(CommandHandler("addseller", addseller))
    app.add_handler(CommandHandler("removeseller", removeseller))
    app.add_handler(CommandHandler("sellers", sellers_cmd))
    app.add_handler(CommandHandler("setpayment", setpayment))
    app.add_handler(CommandHandler("showpayment", showpayment))
    app.add_handler(CommandHandler("stats", stats_cmd))
    app.add_handler(CommandHandler("users", users_cmd))

    app.add_handler(CallbackQueryHandler(newcat_cb, pattern=r"^newcat_"))
    app.add_handler(CallbackQueryHandler(save_item_cb, pattern=r"^(save_item|cancel_item)$"))
    app.add_handler(CallbackQueryHandler(edit_start_cb, pattern=r"^edit_\d+$"))
    app.add_handler(CallbackQueryHandler(edit_field_cb, pattern=r"^field_"))
    app.add_handler(CallbackQueryHandler(delete_cb, pattern=r"^del_\d+$"))
    app.add_handler(CallbackQueryHandler(order_decision_cb, pattern=r"^(appr|rej)_\d+$"))

    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_error_handler(on_error)
    return app


if __name__ == "__main__":
    db.init_db()
    build_app().run_polling()
