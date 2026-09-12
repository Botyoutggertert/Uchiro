# ដំណើរការ 24/7 ជាមួយ systemd (Ubuntu Server)

## 1. កែ Token ក្នុងឯកសារ `uchirobot.service`

បើកឯកសារ `uchirobot.service` ក្នុង folder នេះ ដាក់ Token និង Owner ID ពិតរបស់អ្នកជំនួស PUT_YOUR_...

## 2. Copy ទៅ systemd

```bash
sudo cp deploy/uchirobot.service /etc/systemd/system/uchirobot.service
sudo systemctl daemon-reload
sudo systemctl enable uchirobot
sudo systemctl start uchirobot
```

## 3. ពិនិត្យស្ថានភាព

```bash
sudo systemctl status uchirobot      # មើលថាកំពុងរត់ដែរឬទេ
journalctl -u uchirobot -f           # មើល log real-time (ដូច console log)
```

## 4. បើកែកូដ ឬ Update

```bash
sudo systemctl restart uchirobot
```

## តើនេះធ្វើឲ្យអ្វីខ្លះ?

- `Restart=always` — បើ Bot crash ដោយហេតុផលអ្វីមួយ វានឹង restart ខ្លួនឯងស្វ័យប្រវត្តិ
- `WantedBy=multi-user.target` — Bot ចាប់ផ្តើមដំណើរការស្វ័យប្រវត្តិពេល Server reboot (ឧ. Oracle restart maintenance)
- មិនចាំបាច់បើក terminal ទុកទេ — Bot រត់ក្នុង background ជានិច្ច
- ទិន្នន័យ (`store.db`, `media/`) នៅជាប់លើ Disk របស់ Server ដដែល **មិនបាត់** ទោះ Bot restart ប៉ុន្មានដងក៏ដោយ

## Backup ជាទម្លាប់ (ណែនាំ)

```bash
# រត់ដោយដៃម្តងម្កាល ឬដាក់ cron job រាល់ថ្ងៃ
cp store.db ~/backup_store_$(date +%F).db
tar -czf ~/backup_media_$(date +%F).tar.gz media/
```
