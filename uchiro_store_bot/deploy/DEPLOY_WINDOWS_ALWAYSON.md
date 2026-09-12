# ដំណើរការ 24/7 លើកុំព្យូទ័រផ្ទាល់ខ្លួន (Windows) — ឥតគិតថ្លៃ 100%, គ្មាន Card, គ្មានកម្រិត

## ១. បិទ Sleep Mode (សំខាន់បំផុត!)

បើកុំព្យូទ័រចូល Sleep, Bot នឹងឈប់ដំណើរការ។ ត្រូវបិទវា៖

1. ចុច **Start** → វាយ "Power & sleep settings" → Enter
2. ក្រោម **"Screen"** និង **"Sleep"** ជ្រើសរើស **"Never"** ទាំង ២ (ពេលដោត Charger និងពេលប្រើ Battery)
3. បើប្រើ Laptop បន្ថែម: Control Panel → Power Options → "Choose what closing the lid does" → ជ្រើសរើស **"Do nothing"** ពេលបិទបាំង

## ២. កែ Token ក្នុងឯកសារ `run_bot_windows.bat`

បើកឯកសារ `deploy/run_bot_windows.bat` ដោយ Notepad (ចុចខាងស្តាំ → Edit ឬ Open with Notepad) ដាក់ Token ពិតជំនួស PUT_YOUR_...

```
set ADMIN_BOT_TOKEN=123456:AAA-your-real-token
set STORE_BOT_TOKEN=789012:BBB-your-real-token
set OWNER_IDS=123456789
```

រក្សាទុក (Save)

## ៣. សាកល្បង Run ដោយដៃម្តងសិន

Double-click លើឯកសារ `run_bot_windows.bat` ក្នុង folder `deploy/`។ Terminal (Command Prompt) ត្រូវបើកឡើង ព្រម Bot ចាប់ផ្តើមរត់។ បើ Bot crash ដោយហេតុផលអ្វីមួយ វានឹង **restart ខ្លួនឯងស្វ័យប្រវត្តិក្នុង ៥ វិនាទី** (Loop ក្នុងឯកសារ .bat)។

ទុក Terminal នេះបើកចោល កុំបិទ។

## ៤. ធ្វើឲ្យចាប់ផ្តើមស្វ័យប្រវត្តិពេល Windows Start (Task Scheduler)

ដើម្បីមិនចាំបាច់ double-click ដោយដៃរាល់ពេលបើកកុំព្យូទ័រ៖

1. ចុច **Start** → វាយ "Task Scheduler" → Enter
2. ចុចស្តាំលើ **"Task Scheduler Library"** (ឬ menu ខាងស្តាំ) → **Create Task...** (មិនមែន "Create Basic Task")
3. Tab **General**:
   - Name: `Uchiro Store Bot`
   - ជ្រើសរើស **"Run whether user is logged on or not"**
   - ជ្រើសរើស **"Run with highest privileges"**
4. Tab **Triggers** → **New...** → Begin the task: **"At startup"** → OK
5. Tab **Actions** → **New...** → Action: "Start a program" → Program/script: ចុច **Browse** ជ្រើសរើសឯកសារ `run_bot_windows.bat` → OK
6. Tab **Conditions** → **មិនធីក** "Start the task only if the computer is on AC power" (បើប្រើ Laptop ចង់ឲ្យវារត់ទោះជា Battery)
7. ចុច **OK** → វាយ Password គណនី Windows របស់អ្នកបញ្ជាក់

## ៥. សាកល្បង

Restart កុំព្យូទ័រ ១ដង។ ក្រោយពី Windows ចាប់ផ្តើមឡើងវិញ Bot គួរតែចាប់ផ្តើមដំណើរការស្វ័យប្រវត្តិដោយមិនចាំបាច់ Login ក៏បាន (ដោយសារ "Run whether user is logged on or not")។ សាកល្បងវាយ `/start` លើ Telegram ២ Bot មើលថាឆ្លើយតបដែរឬអត់។

---

## ចំណាំសំខាន់

- **កុំព្យូទ័រត្រូវបើកចោលជានិច្ច** — បើបិទ ឬអគ្គិសនីដាច់ Bot នឹងឈប់ដំណើរការរហូតដល់បើកឡើងវិញ
- **Internet ត្រូវតភ្ជាប់ជានិច្ច** — បើ Wifi/Internet ដាច់ Bot នឹងមិនអាចទាក់ទង Telegram Server បាន
- ទិន្នន័យ (`store.db`, `media/`) ស្តុកនៅក្នុង folder លើ Harddisk កុំព្យូទ័រ **មិនបាត់ទេ** ទោះ Restart ប៉ុន្មានដងក៏ដោយ
- ចង់ backup ដោយដៃ គ្រាន់តែចម្លងឯកសារ `store.db` ទៅ USB ឬ Google Drive ម្តងម្កាល
