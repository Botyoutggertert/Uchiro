# 🇰🇭 Uchiro Store — Telegram Bot (Blox Fruit Account / Fruit / Gamepass)

Bot នេះមាន ២ ដាច់ដោយឡែក ប៉ុន្តែ share stock ដូចគ្នា:

1. **Admin Bot** (`admin_bot.py`) — សម្រាប់ Uchiro (ម្ចាស់ហាង) ប្រើបន្ថែម/កែ/លុប stock និងអនុម័ត order
2. **Store Bot** (`store_bot.py`) — សម្រាប់អតិថិជនមើលទំនិញ និងទិញ

ទាំងពីរនេះអាចដំណើរការជាមួយគ្នាតាមរយៈ `main.py` (ដំណើរការ process តែមួយ) ។

---

## ១. បង្កើត Bot ២ ក្នុង Telegram

1. បើក Telegram ស្វែងរក **@BotFather**
2. វាយ `/newbot` → ដាក់ឈ្មោះ Bot Admin (ឧ. `Uchiro Admin Bot`) → BotFather នឹងឱ្យ **Token** មួយ
3. ធ្វើម្តងទៀត `/newbot` សម្រាប់ Store Bot (ឧ. `Uchiro Store Bot`) → ទទួល **Token** ទី ២

## ២. រកលេខ Telegram Chat ID របស់អ្នក (Admin)

1. ស្វែងរក **@userinfobot** ក្នុង Telegram ហើយចុច Start
2. វានឹងបង្ហាញលេខ `Id:` របស់អ្នក — ចម្លងលេខនេះទុក (នេះជា ADMIN_CHAT_IDS)

## ៣. ដំឡើងកម្មវិធី

ត្រូវការ Python 3.10+ លើម៉ាស៊ីន ឬ Server (VPS) របស់អ្នក។

```bash
cd uchiro_store_bot
pip install -r requirements.txt
```

## ៤. កំណត់ Token និង Admin ID

បើកឯកសារ `config.py` ហើយដាក់ Token ២ និង Chat ID របស់អ្នកចូល ឬ set ជា environment variable ដូចខាងក្រោម:

```bash
export ADMIN_BOT_TOKEN="123456:AAA-your-admin-bot-token"
export STORE_BOT_TOKEN="789012:BBB-your-store-bot-token"
export OWNER_IDS="123456789"
```

(បើម្ចាស់ហាងមានច្រើននាក់ ដាក់ comma ដោយឡែក ឧ. `"123456789,987654321"`. Owner អាចបន្ថែម Admin/អ្នកលក់ផ្សេងទៀតបានលើ Bot ដោយប្រើ `/addseller` — មិនចាំបាច់កែ config ទេ)

📞 លេខ Contact Admin (`@noreakyout`) កំណត់នៅ `config.py` → `ADMIN_CONTACT_USERNAME`

## ៥. ដំណើរការ

```bash
python main.py
```

Bot ទាំង ២ នឹងដំណើរការក្នុងពេលតែមួយ។ ទុកវាឲ្យរត់ជានិច្ចលើ Server (ឧ. ប្រើ `screen`, `tmux`, ឬ `systemd` / `pm2` ដើម្បីកុំឲ្យ Bot ដាច់ពេលបិទ terminal) ។

---

## របៀបប្រើ — Admin Bot

- `/start` — មើលបញ្ជីពាក្យបញ្ជា
- `/additem` — បន្ថែម **Account** ម្តងមួយ (ត្រូវការរូបភាព — ប្រភេទ → ឈ្មោះ → តម្លៃ → ពិពណ៌នា → ស្តុក → ព័ត៌មានគណនី → រូបភាព)

**⚡ Fruit/Gamepass — លឿនជាង Account ច្រើន (បន្ថែមច្រើនក្នុងម្តងតែម្តង, គ្មានរូបភាព ព្រោះបង្ហាញជា list):**
- `/addfruit` — Bot សុំឲ្យវាយ `ឈ្មោះ, តម្លៃ, ស្តុក` ១បន្ទាត់ = ១មុខ អាចវាយច្រើនបន្ទាត់ម្តងបាន៖
  ```
  East Dragon, 1.25, 3
  Buddha, 1.25, 1
  Rocket, 1, 5
  ```
  ផ្ញើម្តងតែម្តង Bot បន្ថែមទាំងអស់ភ្លាមៗ (បើខ្វះ ស្តុក = 1 ដោយស្វ័យប្រវត្តិ)
- `/addgamepass` — ដូចគ្នា សម្រាប់ Gamepass
- `/setstock <item_id> <ចំនួន>` — កែស្តុកលឿន (ឧ. `/setstock 5 10`)
- `/setprice <item_id> <តម្លៃ>` — កែតម្លៃលឿន (ឧ. `/setprice 5 1.5`)
- `/cancel` — បោះបង់ Flow កំពុងធ្វើ

- `/listitems` — មើលទំនិញទាំងអស់ ព្រម ✏️កែប្រែ / 🗑លុប (មាន ID បង្ហាញ ប្រើសម្រាប់ `/setstock`, `/setprice`)

**🎮 ជួយ Player (ទាក់ទាញអ្នកលេងចូល Bot ច្រើនជាងមុន):**
- `/setcodes` — Update Redeem Code ថ្មីៗ (Player មើលតាម `/codes`)
- `/settierlist` — Update Fruit Tier List (Player មើលតាម `/tierlist`)
- `/addguide ចំណងជើង | Link YouTube` — បន្ថែម Video Guide (ឧ. របៀបយក Dough V4) — Player មើលតាម `/guide`
  ឧទាហរណ៍: `/addguide របៀបយក God Human V4 | https://youtu.be/xxxx`
- `/removeguide <guide_id>` — លុប Guide
- `/guides` — មើល Guide ទាំងអស់ (សម្រាប់ Admin)
- `/orders` — Order កំពុងរង់ចាំ — ✅ អនុម័ត / ❌ បដិសេធ (អនុម័តរួច Bot ផ្ញើគណនីទៅអតិថិជនស្វ័យប្រវត្តិ ហើយកាត់ស្តុក)

- `/setpayment` — ផ្ញើរូបភាព QR Code ទូទាត់ រួចវាយព័ត៌មានបន្ថែម (ឧ. ឈ្មោះ/លេខគណនី ABA) — QR នេះនឹងបង្ហាញឲ្យអតិថិជនឃើញរាល់ពេលទិញ
- `/showpayment` — មើល QR បច្ចុប្បន្នដែលកំណត់ទុក
- `/stats` — មើលចំនួនអ្នកប្រើប្រាស់សរុប, ចំនួនទំនិញ, និងចំនួន Order (pending/approved/rejected)
- `/users` — មើលបញ្ជីអ្នកប្រើប្រាស់ចុងក្រោយ ៣០នាក់ (username + Telegram ID + ចូលចុងក្រោយពេលណា)

**Multi-Admin/Seller (មានតែ Owner ប្រើបាន):**
- `/addseller <telegram_id>` — បន្ថែម Admin/អ្នកលក់ថ្មី ដែលអាចបន្ថែម/កែ/លុបទំនិញ និងអនុម័ត Order បាន
- `/removeseller <telegram_id>` — លុប Admin/អ្នកលក់
- `/sellers` — មើលបញ្ជី Owner + Admin ទាំងអស់

(Admin/Seller ដែលបន្ថែមតាមវិធីនេះ អាចប្រើ `/additem`, `/listitems`, `/orders` បានដូច Owner ដែរ តែមិនអាចបន្ថែម/លុប Admin ផ្សេងទៀតបានទេ)

## របៀបប្រើ — Store Bot (អតិថិជន)

- `/start` — មើលប្រភេទទំនិញ (Account / Fruit / Gamepass) + ប៊ូតុង 📞 ទាក់ទងម្ចាស់ហាង (បើកទៅ @noreakyout ដោយផ្ទាល់)
- `/support` — ប៊ូតុងទាក់ទងម្ចាស់ហាងផ្ទាល់
- `/codes` — Code Redeem ថ្មីៗ (ជួយអតិថិជនស្គាល់ Bot ច្រើនជាង)
- `/tierlist` — Fruit Tier List
- `/guide` — Video Guide (ឧ. របៀបយក Dough V4, God Human) ជ្រើសរើសពី List → Bot ផ្ញើ Link YouTube
- ជ្រើសរើសប្រភេទ → **Account**: បង្ហាញជា card រូបភាពដាច់ដោយឡែកម្នាក់ៗ (ព្រោះម្នាក់ៗមានតម្លៃ/ព័ត៌មានខុសគ្នា) — **Fruit/Gamepass**: បង្ហាញជាបញ្ជីស្តុករួម (Option 1, 2, 3...) ព្រមប៊ូតុងលេខសម្រាប់ជ្រើសទិញ
- Bot បង្ហាញ QR ទូទាត់ + តម្លៃស្វ័យប្រវត្តិ → អតិថិជនស្កេន QR ទូទាត់ → ចុច "✅ បញ្ជាក់" (ឬ "❌ បោះបង់")
- ពេលចុចបញ្ជាក់ → Bot សុំ Screenshot ទូទាត់ → ផ្ញើទៅ Admin/Seller គ្រប់រូបភ្លាមៗ

---

## សំខាន់! សម្រាប់អ្នកដែលធ្លាប់សាកល្បងរួច

ទំនិញ/QR ណាដែលអ្នកបានបន្ថែមពីមុន **មិនអាចប្រើបានទៀតទេ** ព្រោះវាផ្ទុក file_id ចាស់ដែលខូច។ សូម**លុបឯកសារ `store.db`** ចោល (Bot នឹងបង្កើតថ្មីស្វ័យប្រវត្តិ ទទេ) រួច `/additem` និង `/setpayment` សារជាថ្មី។

## ចំណាំ

- ទិន្នន័យទាំងអស់ (stock + orders + settings) ស្តុកនៅក្នុងឯកសារ `store.db` (SQLite) ដែលបង្កើតដោយស្វ័យប្រវត្តិ
- **រូបភាពទាំងអស់ (item, QR, payment screenshot) ត្រូវរក្សាទុកនៅ folder `media/`** ក្បែរ `store.db` — នេះចាំបាច់ព្រោះ Telegram file_id របស់ Bot មួយ **មិនអាចប្រើជាមួយ Bot មួយទៀតបានទេ** (Admin Bot និង Store Bot ជា Bot ខុសគ្នា) ដូច្នេះប្រព័ន្ធទាញយករូបភាពមកផ្ទុកលើ Server ផ្ទាល់ រួចផ្ញើពី disk វិញ
- ចង់ backup គ្រាន់តែចម្លងឯកសារ `store.db` **និង** folder `media/` ទាំងមូល
- មុននឹងដាក់ដំណើរការពិត សូមសាកល្បង Add item និង Buy flow ជាមួយ Account សាកល្បងសិន
- Bot នេះមិនមានប្រព័ន្ធទូទាត់ស្វ័យប្រវត្តិ (auto-payment) ទេ — វាពឹងផ្អែកលើ Admin ពិនិត្យ Screenshot ដោយផ្ទាល់ភ្នែក មុននឹងចុច Approve

## បើប៊ូតុងចុចមិនដំណើរការ (troubleshooting)

- ត្រូវប្រាកដថា **រត់តែ instance តែមួយ** របស់ Bot នីមួយៗ — បើអ្នករត់ `python main.py` ២ ដងក្នុងពេលតែមួយ (ឧ. ក្នុង terminal និងលើ server ជាមួយគ្នា) Telegram នឹងបោះ error `Conflict: terminated by other getUpdates request` ហើយប៊ូតុងនឹងឈប់ឆ្លើយតប
- ត្រូវប្រាកដថា `OWNER_IDS` ជាលេខ Telegram ID (លេខ) មិនមែន username (@xxx) ទេ — យកលេខពី @userinfobot
- Token របស់ Admin Bot និង Store Bot ត្រូវខុសគ្នា កុំច្រឡំដាក់បញ្ច្រាស់
