# ដំណើរការ 24/7 ដោយឥតគិតថ្លៃ — គ្មាន Credit Card (Replit + UptimeRobot)

វិធីនេះ**មិនត្រូវការ Credit Card ទាល់តែសោះ** ត្រូវការតែ Email សម្រាប់ចុះឈ្មោះ ២កន្លែង។

## របៀបដំណើរការ

Replit ឲ្យ Server ឥតគិតថ្លៃរត់កូដរបស់អ្នក ប៉ុន្តែវានឹង "wake/sleep" ដោយស្វ័យប្រវត្តិបើគ្មាននរណា visit។ ដូច្នេះយើងប្រើ **UptimeRobot** (ក៏ឥតគិតថ្លៃ គ្មាន card ដែរ) ឲ្យ "ping" Bot របស់អ្នករាល់ ៥ នាទី ដើម្បីរក្សាឲ្យវារត់ជានិច្ច។

---

## ១. បង្កើត Account + Project លើ Replit

1. ចូល https://replit.com → ចុច **Sign up** → ជ្រើសរើស Sign up ដោយ Email (មិនចាំបាច់ Google/GitHub ក៏បាន តែ Email លឿនជាង) → បញ្ចូល Email + Password → បញ្ជាក់ Email
2. ក្រោយចូល Dashboard → ចុចប៊ូតុង **"+ Create"** (ជ្រុងស្តាំលើ ឬកណ្តាលអេក្រង់)
3. ក្នុងប្រអប់លេចឡើង ជ្រើសរើស **Python** ជា Template/Language
4. ដាក់ឈ្មោះ Project (ឧ. `uchiro-store-bot`) → ចុច **Create App** ឬ **Create Repl**
5. រង់ចាំ Editor បង្ហាញ (ប្រហែល ១០ វិនាទី)

## ២. Upload ឯកសារ Bot ចូល

1. ក្នុង Editor មើលផ្នែក **Files** (Sidebar ខាងឆ្វេង)
2. ចុច icon "..." (three-dot menu) នៅផ្នែក Files → ជ្រើសរើស **Upload folder**
3. ជ្រើសរើស folder `uchiro_store_bot` ដែលអ្នក Extract ពី zip លើកុំព្យូទ័រអ្នក → Upload
4. រង់ចាំរហូតឯកសារទាំងអស់ (config.py, admin_bot.py, store_bot.py, ...) បង្ហាញក្នុង Files panel

## ៣. ដំឡើង Library

1. ចុច Tab **Shell** (Sidebar ខាងឆ្វេង ឬខាងក្រោម)
2. វាយ:
```bash
pip install -r requirements.txt
```
3. ចុច Enter រង់ចាំដំឡើងចប់ (ប្រហែល ១-២ នាទី)

## ៤. កំណត់ Token ជា Secrets

1. ចុច icon **🔒 Secrets** (Lock icon នៅ Sidebar ខាងឆ្វេង — ជួនកាលហៅថា "App Secrets")
2. ចុច **+ New Secret** បន្ថែម ៤ ដង៖

| Key | Value |
|---|---|
| `ADMIN_BOT_TOKEN` | token Admin Bot ពី @BotFather |
| `STORE_BOT_TOKEN` | token Store Bot ពី @BotFather |
| `OWNER_IDS` | telegram id របស់អ្នក (ពី @userinfobot) |
| `ENABLE_KEEPALIVE` | `1` |

3. រាល់ Secret ចុច **Add Secret** ដើម្បី Save

## ៥. Run Bot

1. ចុចប៊ូតុងពណ៌បៃតង **▶️ Run** ខាងលើ Editor
2. Console (ខាងស្តាំ ឬខាងក្រោម) ត្រូវបង្ហាញ:
```
Both Uchiro Store bots are running. Press Ctrl+C to stop.
```
3. Tab **Webview** (ក្បែរ Console) នឹងបង្ហាញ URL មួយ ស្រដៀង `https://uchiro-store-bot.yourname.repl.co` — **ចម្លង URL នេះទុក** (ត្រូវការសម្រាប់ជំហានបន្ទាប់)

## ៦. រក្សា Bot ឲ្យរត់ 24/7 (UptimeRobot)

1. ចូល https://uptimerobot.com → ចុច **Sign Up** ដោយ Email (មិនចាំបាច់ card)
2. បញ្ជាក់ Email → ចូល Dashboard
3. ចុច **"+ Add New Monitor"**
4. កំណត់៖
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `Uchiro Store Bot` (ដាក់ឈ្មោះអ្វីក៏បាន)
   - URL: paste URL ពីជំហានទី ៥
   - Monitoring Interval: **5 minutes**
5. ចុច **Create Monitor**

ចប់! UptimeRobot នឹង ping Bot របស់អ្នករាល់ ៥ នាទីស្វ័យប្រវត្តិ ធ្វើឲ្យ Replit មិន sleep = **Bot រត់ 24/7 ដោយស្វ័យប្រវត្តិ** សូម្បីអ្នកបិទកុំព្យូទ័រ ឬបិទ Browser ក៏ដោយ។

---



## ចំណាំ

- ទិន្នន័យ (`store.db`, `media/`) **ស្តុកនៅជាប់ក្នុង Repl** ដដែល មិនបាត់ទោះ Bot restart ប៉ុន្មានដងក៏ដោយ (លុះត្រាតែអ្នកលុប Repl ចោល)
- Replit free tier អាចមានពេលខ្លះមិនស្ថិតស្ថេរ 100% ដូច VPS ពិត (ជាពិសេសពេល Server maintenance) — ប៉ុន្តែសម្រាប់ហាងតូចមួយ គ្រប់គ្រាន់ស្រេចហើយ
- ចង់ backup ដោយដៃ អាចទាញយកឯកសារ `store.db` ចេញពី Replit Files panel ម្តងម្កាល
