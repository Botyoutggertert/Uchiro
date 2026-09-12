"""
ដំណើរការ Bot ទាំង ២ (Admin Bot និង Store Bot) ក្នុងពេលតែមួយ ដោយប្រើ process តែមួយ។
ដំណើរការ: python main.py
ឈប់: Ctrl + C
"""
import asyncio
import logging
import os

import database as db
import admin_bot
import store_bot
from keep_alive import keep_alive

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    db.init_db()

    if os.getenv("ENABLE_KEEPALIVE") == "1":
        keep_alive()

    admin_app = admin_bot.build_app()
    store_app = store_bot.build_app()

    await admin_app.initialize()
    await store_app.initialize()

    await admin_app.start()
    await store_app.start()

    await admin_app.updater.start_polling()
    await store_app.updater.start_polling()

    logger.info("Both Uchiro Store bots are running. Press Ctrl+C to stop.")

    stop_event = asyncio.Event()
    try:
        await stop_event.wait()
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        await admin_app.updater.stop()
        await store_app.updater.stop()
        await admin_app.stop()
        await store_app.stop()
        await admin_app.shutdown()
        await store_app.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
