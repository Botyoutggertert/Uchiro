<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Uchiro Store

Cambodia gaming marketplace -- React/Vite frontend + Express backend, KHQR (Bakong) payments, Telegram bot integration.

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in at minimum `JWT_SECRET` (see comments in that file for how to generate one).
3. Run the app: `npm run dev`

## Resetting store data

The Admin Settings screen has a "Reset to Zero" button (calls `POST /api/reset-data` with `{ mode: 'zero' }`), which wipes all products and orders. Passing `{ mode: 'starter' }` instead restores the demo starter pack.

## Deploying to Vercel

1. Push this repo to GitHub, import it at vercel.com/new (it auto-detects the build settings from `vercel.json`).
2. In Project Settings -> Environment Variables, set:
   - `JWT_SECRET` -- required, the app refuses to boot without it in production.
   - `FIREBASE_SERVICE_ACCOUNT` -- optional but strongly recommended. Without it, product/order data is stored in `/tmp`, which Vercel wipes between serverless cold starts, so data can randomly disappear. See `.env.example` for how to get this value from the Firebase console.
   - `APP_URL`, `SMTP_*` -- optional, see `.env.example`.
3. Deploy.

## Deploying to Railway

Railway has a persistent disk, so the default local-JSON-file storage works there without any extra setup (`railway.json` is already configured). Still set `JWT_SECRET`.

## Telegram bot (`bot.py`)

This is separate from the web app and needs its own always-on host (e.g. Railway), since it isn't compatible with Vercel's serverless model. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_CHAT_IDS` as environment variables wherever you run it -- see `config.py`.

