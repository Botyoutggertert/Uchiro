import os
import uuid

MEDIA_DIR = "media"


def format_price(price, currency="$"):
    price = float(price)
    if price == int(price):
        return f"{int(price)}{currency}"
    return f"{price:.2f}{currency}"


async def save_telegram_photo(bot, file_id, subdir):
    """Telegram file_ids only work with the bot that received them.
    Since we run 2 bots, download the photo once and re-serve it from disk."""
    folder = os.path.join(MEDIA_DIR, subdir)
    os.makedirs(folder, exist_ok=True)
    tg_file = await bot.get_file(file_id)
    path = os.path.join(folder, f"{uuid.uuid4().hex}.jpg")
    await tg_file.download_to_drive(path)
    return path
