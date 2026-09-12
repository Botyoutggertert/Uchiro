import React, { useState } from 'react';
import { StoreSettings, ActiveScreen } from '../types';
import { AccountLoginRulesModal } from './AccountLoginRulesModal';
import {
  Search,
  CreditCard,
  Gamepad2,
  ShieldAlert,
  Bug,
  Headphones,
  Send,
  MessageCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Zap,
  HelpCircle,
  Sparkles,
  RefreshCw,
  Clock,
} from 'lucide-react';

interface HelpSupportScreenProps {
  settings: StoreSettings;
  setActiveScreen?: (screen: ActiveScreen) => void;
  onGoHome: () => void;
  lang: 'KM' | 'EN';
}

interface FaqItem {
  id: string;
  category: 'payments' | 'gacha' | 'security' | 'technical';
  question: string;
  questionKhmer: string;
  answer: string;
  answerKhmer: string;
  tags: string[];
}

const FAQ_DATA: FaqItem[] = [
  // Payments & Billing
  {
    id: 'pay-1',
    category: 'payments',
    question: 'How do I pay with KHQR (Bakong / ABA / ACLEDA)?',
    questionKhmer: 'តើខ្ញុំត្រូវទូទាត់ប្រាក់តាម KHQR (Bakong / ABA / ACLEDA) យ៉ាងដូចម្តេច?',
    answer:
      'Simply select your item or top-up amount, choose KHQR as payment method, and generate your dynamic KHQR code. Scan the code with any banking app in Cambodia (ABA Mobile, ACLEDA, Wing, Canadia, Bakong). Your order or balance will update immediately.',
    answerKhmer:
      'គ្រាន់តែជ្រើសរើសទំនិញ ឬចំនួនទឹកប្រាក់ដែលចង់ Top-Up រួចជ្រើសរើសវិធីសាស្ត្រ KHQR ដើម្បីបង្កើតកូដ។ បន្ទាប់មក ស្កេនរូបភាព QR តាមកម្មវិធីធនាគារណាមួយនៅកម្ពុជា (ABA, ACLEDA, Wing, Canadia, Bakong)។ ប្រព័ន្ធនឹងផ្ទៀងផ្ទាត់ និងបញ្ជាក់ការបញ្ជាទិញភ្លាមៗ។',
    tags: ['khqr', 'payment', 'aba', 'bakong', 'bank', 'topup'],
  },
  {
    id: 'pay-2',
    category: 'payments',
    question: 'Are there any extra transaction fees for KHQR?',
    questionKhmer: 'តើមានការគិតថ្លៃសេវាបន្ថែមសម្រាប់ការទូទាត់ KHQR ដែរឬទេ?',
    answer:
      'No. All KHQR USD payments via the National Bank of Cambodia standard are 100% free of charge with zero extra processing fees.',
    answerKhmer:
      'គ្មានទេ! ការទូទាត់តាមប្រព័ន្ធស្ដង់ដារ KHQR របស់ធនាគារជាតិនៃកម្ពុជា គឺឥតគិតថ្លៃសេវា ១០០% មិនមានការកាត់លុយបន្ថែមឡើយ។',
    tags: ['fee', 'zero fees', 'bakong', 'cost'],
  },
  {
    id: 'pay-3',
    category: 'payments',
    question: 'My payment was deducted from bank, but order is still pending. What to do?',
    questionKhmer: 'ធនាគារកាត់លុយរួចហើយ តែ Order នៅ Pending តើត្រូវធ្វើដូចម្តេច?',
    answer:
      'If your payment was completed, you can upload your transaction screenshot slip directly on the order screen, or click the Telegram Support button below. Our support team verifies and completes orders within 5-15 minutes.',
    answerKhmer:
      'ប្រសិនបើធនាគារកាត់ប្រាក់រួចរាល់ សូម Upload រូបភាពវិក្កយបត្រ (Slip) លើផ្ទាំង Order ឬទាក់ទងមកកាន់ Telegram Support របស់យើងភ្លាមៗ។ ក្រុមការងារនឹងពិនិត្យ និងអនុម័តជូនក្នុងរយៈពេល ៥-១៥ នាទី។',
    tags: ['pending', 'slip', 'support', 'verification'],
  },

  // Gacha & Item Mechanics
  {
    id: 'gacha-1',
    category: 'gacha',
    question: 'How does the Gift / Gamepass delivery work?',
    questionKhmer: 'តើការផ្ញើកាដូ Gamepass ឬ Fruit ដំណើរការយ៉ាងដូចម្តេច?',
    answer:
      'When purchasing a gift item (like 2x Mastery or Fruit Gamepass), enter and verify your Roblox Username during checkout. Once paid, our automated trade bot or admin dispatches the gift directly to your account in-game within 15-30 minutes.',
    answerKhmer:
      'នៅពេលទិញទំនិញប្រភេទ Gift (ដូចជា 2x Mastery ឬ Fruit Gamepass) សូមបញ្ចូល និងផ្ទៀងផ្ទាត់ Roblox Username របស់អ្នកឱ្យបានត្រឹមត្រូវ។ បន្ទាប់ពីទូទាត់រួច ប្រព័ន្ធ Bot ឬ Admin នឹងផ្ញើកាដូទៅកាន់គណនីរបស់អ្នកក្នុងហ្គេមក្នុងរយៈពេល ១៥-៣០ នាទី។',
    tags: ['gift', 'gamepass', 'delivery', 'fruit'],
  },
  {
    id: 'gacha-2',
    category: 'gacha',
    question: 'How do member rank discounts work?',
    questionKhmer: 'តើប្រព័ន្ធបញ្ចុះតម្លៃតាមកម្រិតសមាជិក (Member Rank) ដំណើរការយ៉ាងដូចម្តេច?',
    answer:
      'Your rank upgrades automatically based on lifetime USD spent: Bronze (0%), Silver ($50+ / 3% off), Gold ($150+ / 6% off), Platinum ($300+ / 10% off), Diamond ($600+ / 15% off), and Reseller VIP ($1,000+ or Special Code / 20% off). Discounts apply automatically at checkout.',
    answerKhmer:
      'កម្រិត Rank របស់អ្នកនឹងឡើងស្វ័យប្រវត្តតាមចំនួនទឹកប្រាក់ដែលបានទិញសរុប៖ Silver (បញ្ចុះ 3%), Gold (បញ្ចុះ 6%), Platinum (បញ្ចុះ 10%), Diamond (បញ្ចុះ 15%) និង VIP Reseller (បញ្ចុះ 20%)។ ការបញ្ចុះតម្លៃនឹងកាត់ដោយស្វ័យប្រវត្តក្នុង Checkout។',
    tags: ['rank', 'discount', 'reseller', 'vip', 'rewards'],
  },

  // Account Security
  {
    id: 'sec-1',
    category: 'security',
    question: 'How to safely bind and secure your Roblox account after purchase?',
    questionKhmer: 'របៀបការពារ និងភ្ជាប់ Email គណនី Roblox បន្ទាប់ពីទិញរួច?',
    answer:
      '1. Log into roblox.com using the Username and Password provided.\n2. Navigate to Settings > Account Info and add your personal verified Email and Phone Number.\n3. Change your password immediately.\n4. Enable Authenticator App (2-Step Verification) in Security Settings for 100% protection.',
    answerKhmer:
      '១. ចូលទៅកាន់ roblox.com ដោយប្រើ Username & Password ដែលទទួលបាន។\n២. ចូល Settings > Account Info រួចភ្ជាប់ Email និង Phone ផ្ទាល់ខ្លួនរបស់អ្នក។\n៣. ផ្លាស់ប្តូរលេខសម្ងាត់ថ្មីភ្លាមៗ។\n៤. បើក 2-Step Verification (Authenticator App) ក្នុង Security ដើម្បីសុវត្ថិភាពខ្ពស់បំផុត។',
    tags: ['security', 'password', '2fa', 'email', 'login'],
  },
  {
    id: 'sec-2',
    category: 'security',
    question: 'What is the 14-Day Warranty Policy?',
    questionKhmer: 'តើគោលការណ៍ធានារយៈពេល ១៤ ថ្ងៃមានអ្វីខ្លះ?',
    answer:
      'All verified account sales include a 14-day warranty covering login errors or recovery issues if the buyer followed all safety rules. We provide 100% replacement or refund for verified account defects.',
    answerKhmer:
      'រាល់ការទិញគណនីទទួលបានការធានា ១៤ ថ្ងៃពេញលេញ ប្រសិនបើមានបញ្ហា Login ឬការទាញយកគណនីត្រឡប់មកវិញដោយមិនមែនជាកំហុសរបស់អ្នកទិញ។ យើងនឹងប្តូរគណនីថ្មី ឬសងប្រាក់វិញ ១០០%។',
    tags: ['warranty', 'refund', 'guarantee', 'rules'],
  },

  // Technical Issues
  {
    id: 'tech-1',
    category: 'technical',
    question: 'How to use the live 2FA TOTP code generator on my order?',
    questionKhmer: 'របៀបប្រើប្រាស់លេខកូដ 2FA TOTP ស្វ័យប្រវត្តលើ Order?',
    answer:
      'If your purchased account has 2FA enabled, your Order Complete screen includes a live 6-digit TOTP code counter that refreshes every 30 seconds. Simply copy this 6-digit code when Roblox prompts for Authenticator app confirmation during login.',
    answerKhmer:
      'ប្រសិនបើគណនីដែលអ្នកបានទិញមានបើក 2FA នោះផ្ទាំង Order Complete មានបង្ហាញលេខកូដ ៦ ខ្ទង់ (TOTP) ដែលផ្លាស់ប្តូររៀងរាល់ ៣០ វិនាទី។ គ្រាន់តែ Copy លេខកូដនេះទៅបំពេញក្នុង Roblox ពេល Login។',
    tags: ['2fa', 'totp', 'code', 'technical', 'login'],
  },
  {
    id: 'tech-2',
    category: 'technical',
    question: 'Where can I contact human customer support?',
    questionKhmer: 'តើខ្ញុំអាចទាក់ទងក្រុមការងារ Support ផ្ទាល់តាមណា?',
    answer:
      'Our dedicated Telegram support is available 24/7. Click the Live Chat button or join our official Telegram channel for instant assistance with orders, top-ups, or custom requests.',
    answerKhmer:
      'ក្រុមការងារ Support របស់យើងប្រចាំការ ២៤ ម៉ោងលើ ២៤ ម៉ោង។ ចុចលើប៊ូតុង Live Chat ឬទាក់ទងតាម Telegram Channel ផ្លូវការ ដើម្បីទទួលបានការជួយសម្រួលរហ័ស។',
    tags: ['support', 'telegram', 'contact', 'admin', 'chat'],
  },
];

export const HelpSupportScreen: React.FC<HelpSupportScreenProps> = ({
  settings,
  setActiveScreen,
  onGoHome,
  lang,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'payments' | 'gacha' | 'security' | 'technical'
  >('all');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('pay-1');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [selectedArticleModal, setSelectedArticleModal] = useState<{
    title: string;
    content: string;
  } | null>(null);

  // Filter FAQs based on category & search
  const filteredFaqs = FAQ_DATA.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesCategory;

    const matchesSearch =
      item.question.toLowerCase().includes(q) ||
      item.questionKhmer.toLowerCase().includes(q) ||
      item.answer.toLowerCase().includes(q) ||
      item.answerKhmer.toLowerCase().includes(q) ||
      item.tags.some((t) => t.toLowerCase().includes(q));

    return matchesCategory && matchesSearch;
  });

  const handleOpenLiveChat = () => {
    if (settings.telegramUrl) {
      window.open(settings.telegramUrl, '_blank');
    } else {
      window.open('https://t.me/uchirostore', '_blank');
    }
  };

  const handleArticleClick = (type: 'bind' | 'pity' | 'refund') => {
    if (type === 'bind') {
      setSelectedArticleModal({
        title: lang === 'KM' ? 'របៀបភ្ជាប់ និងការពារគណនី Roblox ដោយសុវត្ថិភាព' : 'How to bind your Roblox account safely',
        content:
          lang === 'KM'
            ? `១. ចូលទៅកាន់ roblox.com ហើយ Login ដោយប្រើ Credentials លើ Order របស់អ្នក។\n២. ចូលទៅ Settings > Account Info រួចបញ្ចូល Email & Phone ពិតប្រាកដរបស់អ្នក។\n៣. ប្តូរ Password ភ្លាមៗ និងកុំចែករំលែកទៅកាន់អ្នកដទៃ។\n៤. បើក 2-Step Verification ក្នុងផ្ទាំង Security ដើម្បីធានាថាមិនមាននរណាម្នាក់អាចចូលបានឡើយ។`
            : `1. Log into roblox.com using the verified credentials provided on your order page.\n2. Navigate to Settings > Account Info and verify your personal email and phone number.\n3. Change the account password immediately.\n4. Enable 2-Step Verification (Authenticator App) in Security settings to ensure 100% ownership.`,
      });
    } else if (type === 'pity') {
      setSelectedArticleModal({
        title: lang === 'KM' ? 'ការយល់ដឹងពីប្រព័ន្ធបញ្ចុះតម្លៃ & Member Rank' : 'Understanding the Member Rank & VIP System',
        content:
          lang === 'KM'
            ? `ប្រព័ន្ធ Uchiro VIP Rank ផ្តល់ការបញ្ចុះតម្លៃស្វ័យប្រវត្តលើគ្រប់មុខទំនិញ៖\n• Bronze: 0% Discount\n• Silver: $50+ Spent (3% Auto Discount)\n• Gold: $150+ Spent (6% Auto Discount)\n• Platinum: $300+ Spent (10% Auto Discount)\n• Diamond: $600+ Spent (15% Auto Discount)\n• Reseller VIP: $1,000+ Spent ឬប្រើកូដ Reseller Code (20% Auto Discount)`
            : `Uchiro Member Ranks provide automatic discount perks on every checkout:\n• Bronze: 0% Discount (Starter)\n• Silver: $50+ Spent (3% Discount)\n• Gold: $150+ Spent (6% Discount)\n• Platinum: $300+ Spent (10% Discount)\n• Diamond: $600+ Spent (15% Discount)\n• Reseller VIP: $1,000+ Spent or Verified Reseller Pass (20% Lifetime Discount)`,
      });
    } else {
      setShowRulesModal(true);
    }
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-32 px-3 sm:px-6 md:px-8 max-w-[1280px] mx-auto w-full relative overflow-hidden">
      {/* Top Breadcrumb Bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          onClick={onGoHome}
          className="flex items-center gap-2 bg-[#1C1F29] hover:bg-[#282a31] text-[#ffd7a1] border border-white/10 px-4 py-2 rounded-xl font-headline text-xs uppercase tracking-wider transition-all active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{lang === 'KM' ? 'ត្រឡប់ទៅហាង' : 'Back to Store'}</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="bg-[#3ECF8E]/20 text-[#3ECF8E] border border-[#3ECF8E]/40 text-xs font-price px-3 py-1 rounded-full font-bold uppercase flex items-center gap-1.5 shadow-[0_0_12px_rgba(62,207,142,0.2)]">
            <Clock className="w-3.5 h-3.5" />
            <span>24/7 SUPPORT ONLINE</span>
          </span>
        </div>
      </div>

      {/* Header & Search */}
      <header className="text-center flex flex-col items-center gap-4 mb-10">
        <h1 className="font-headline text-3xl sm:text-5xl md:text-6xl text-[#ffd7a1] uppercase tracking-wider">
          {lang === 'KM' ? 'មជ្ឈមណ្ឌលជំនួយ & SUPPORT' : 'HELP & SUPPORT'}
        </h1>
        <p className="font-body-md text-xs sm:text-sm md:text-base text-[#8B90A0] max-w-xl text-center leading-relaxed">
          {lang === 'KM'
            ? 'ត្រូវការជំនួយក្នុងការទិញទំនិញ បញ្ចូលលុយ ឬសុវត្ថិភាពគណនី? ស្វែងរកចម្លើយនៅទីនេះ ឬទាក់ទងមកក្រុមការងាររបស់យើង។'
            : 'Need assistance with your Uchiro Store experience? Search our knowledge base or contact our customer support team below.'}
        </p>

        {/* Search Input Bar */}
        <div className="relative w-full max-w-xl mt-2">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#8B90A0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === 'KM' ? 'ស្វែងរកសំណួរ ឬបញ្ហា... (KHQR, 2FA, Login, Warranty)' : 'Search for answers...'
            }
            className="w-full bg-[#1C1F29] border border-white/20 rounded-2xl py-3.5 pl-12 pr-4 font-price text-sm text-[#e2e2ec] focus:outline-none focus:border-[#ffb230] focus:ring-1 focus:ring-[#ffb230]/50 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.5)] placeholder:text-[#8B90A0]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-price text-[#8B90A0] hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </header>

      {/* Bento Grid Layout (Left: FAQ Categories & Items, Right: Contact & Articles) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* FAQ Categories & List (Left Column) */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-lg sm:text-xl text-[#ffd7a1] uppercase tracking-wider flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#ffb230]" />
              <span>{lang === 'KM' ? 'ផ្នែកសំណួរពេញនិយម (FAQ CATEGORIES)' : 'FAQ CATEGORIES'}</span>
            </h2>
            {selectedCategory !== 'all' && (
              <button
                onClick={() => setSelectedCategory('all')}
                className="text-xs font-price text-[#ffb230] hover:underline"
              >
                Show All
              </button>
            )}
          </div>

          {/* 4 Category Filter Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category Card 1: Payments */}
            <div
              onClick={() => setSelectedCategory(selectedCategory === 'payments' ? 'all' : 'payments')}
              className={`rounded-2xl p-5 border transition-all cursor-pointer group flex flex-col gap-3 ${
                selectedCategory === 'payments'
                  ? 'bg-[#1C1F29] border-[#ffb230] shadow-[0_0_15px_rgba(255,178,48,0.2)]'
                  : 'bg-[#1C1F29]/80 border-white/10 hover:border-[#ffb230]/50'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-[#282a31] flex items-center justify-center text-[#ffb230] group-hover:scale-110 transition-transform">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-headline text-base text-[#e2e2ec] group-hover:text-[#ffd7a1] transition-colors">
                  {lang === 'KM' ? 'ការទូទាត់ & KHQR' : 'Payments & Billing'}
                </h3>
                <p className="font-price text-xs text-[#8B90A0] mt-1">
                  {lang === 'KM'
                    ? 'បញ្ហាប្រតិបត្តិការ, ការបញ្ចូលលុយ និងវិធីសាស្ត្រទូទាត់'
                    : 'Issues with transactions, KHQR top-ups, and payment methods.'}
                </p>
              </div>
            </div>

            {/* Category Card 2: Gacha & Gamepass */}
            <div
              onClick={() => setSelectedCategory(selectedCategory === 'gacha' ? 'all' : 'gacha')}
              className={`rounded-2xl p-5 border transition-all cursor-pointer group flex flex-col gap-3 ${
                selectedCategory === 'gacha'
                  ? 'bg-[#1C1F29] border-[#ffb230] shadow-[0_0_15px_rgba(255,178,48,0.2)]'
                  : 'bg-[#1C1F29]/80 border-white/10 hover:border-[#ffb230]/50'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-[#282a31] flex items-center justify-center text-[#3ECF8E] group-hover:scale-110 transition-transform">
                <Gamepad2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-headline text-base text-[#e2e2ec] group-hover:text-[#ffd7a1] transition-colors">
                  {lang === 'KM' ? 'ការផ្ញើ Gamepass & កាដូ' : 'Gift & Gamepass Mechanics'}
                </h3>
                <p className="font-price text-xs text-[#8B90A0] mt-1">
                  {lang === 'KM'
                    ? 'របៀបទទួលកាដូក្នុងហ្គេម, ការផ្ទៀងផ្ទាត់ Username'
                    : 'Gift mechanics, username checks, and delivery timeline.'}
                </p>
              </div>
            </div>

            {/* Category Card 3: Account Security */}
            <div
              onClick={() => setSelectedCategory(selectedCategory === 'security' ? 'all' : 'security')}
              className={`rounded-2xl p-5 border transition-all cursor-pointer group flex flex-col gap-3 ${
                selectedCategory === 'security'
                  ? 'bg-[#1C1F29] border-[#ffb230] shadow-[0_0_15px_rgba(255,178,48,0.2)]'
                  : 'bg-[#1C1F29]/80 border-white/10 hover:border-[#ffb230]/50'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-[#282a31] flex items-center justify-center text-[#d6b2fc] group-hover:scale-110 transition-transform">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-headline text-base text-[#e2e2ec] group-hover:text-[#ffd7a1] transition-colors">
                  {lang === 'KM' ? 'សុវត្ថិភាពគណនី & 2FA' : 'Account Security'}
                </h3>
                <p className="font-price text-xs text-[#8B90A0] mt-1">
                  {lang === 'KM'
                    ? 'ការផ្លាស់ប្តូរលេខសម្ងាត់, ការដាក់ 2FA និងការធានា'
                    : 'Passwords, 2FA setup, email binding, and recovery rules.'}
                </p>
              </div>
            </div>

            {/* Category Card 4: Technical Support */}
            <div
              onClick={() => setSelectedCategory(selectedCategory === 'technical' ? 'all' : 'technical')}
              className={`rounded-2xl p-5 border transition-all cursor-pointer group flex flex-col gap-3 ${
                selectedCategory === 'technical'
                  ? 'bg-[#1C1F29] border-[#ffb230] shadow-[0_0_15px_rgba(255,178,48,0.2)]'
                  : 'bg-[#1C1F29]/80 border-white/10 hover:border-[#ffb230]/50'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-[#282a31] flex items-center justify-center text-[#E8433F] group-hover:scale-110 transition-transform">
                <Bug className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-headline text-base text-[#e2e2ec] group-hover:text-[#ffd7a1] transition-colors">
                  {lang === 'KM' ? 'បញ្ហាបច្ចេកទេស & TOTP' : 'Technical Issues'}
                </h3>
                <p className="font-price text-xs text-[#8B90A0] mt-1">
                  {lang === 'KM'
                    ? 'បញ្ហា TOTP Generator, Slip Upload និង Support'
                    : 'Bug reports, live TOTP code generator, and connection.'}
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Accordion FAQ List */}
          <div className="space-y-3 mt-2">
            <h3 className="font-headline text-base text-[#e2e2ec] uppercase tracking-wider">
              {lang === 'KM' ? 'សំណួរ & ចម្លើយលម្អិត' : 'Frequently Asked Questions'} ({filteredFaqs.length})
            </h3>

            {filteredFaqs.length === 0 ? (
              <div className="bg-[#14161D] rounded-2xl p-8 text-center text-[#8B90A0] border border-white/5 space-y-2">
                <p className="text-sm font-price">No matching answers found for "{searchQuery}"</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="text-xs font-price text-[#ffb230] underline"
                >
                  Clear search filters
                </button>
              </div>
            ) : (
              filteredFaqs.map((faq) => {
                const isExpanded = expandedFaqId === faq.id;
                return (
                  <div
                    key={faq.id}
                    className="bg-[#141622] rounded-2xl border border-white/10 overflow-hidden transition-all shadow-md"
                  >
                    <button
                      onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                      className="w-full p-4.5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-[#ffb230] shrink-0" />
                        <span className="font-headline text-sm text-[#e2e2ec] font-bold">
                          {lang === 'KM' ? faq.questionKhmer : faq.question}
                        </span>
                      </div>
                      <div className="text-[#8B90A0] shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 text-xs font-price text-[#cac6bb] border-t border-white/5 bg-black/20 space-y-2 leading-relaxed animate-fade-in whitespace-pre-line">
                        <p>{lang === 'KM' ? faq.answerKhmer : faq.answer}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Contact & Helpful Articles (Right Column) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Contact Us Card */}
          <section className="bg-[#1C1F29] rounded-2xl p-6 border border-white/10 shadow-xl flex flex-col gap-5 relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ffb230]/20 flex items-center justify-center text-[#ffb230]">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-headline text-base text-[#ffd7a1] uppercase tracking-wide">
                  {lang === 'KM' ? 'ទាក់ទងជំនួយ (CONTACT US)' : 'CONTACT SUPPORT'}
                </h2>
                <span className="text-[11px] font-price text-[#3ECF8E] flex items-center gap-1 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E] animate-pulse" />
                  Staff Online Now
                </span>
              </div>
            </div>

            <p className="font-price text-xs text-[#8B90A0] leading-relaxed">
              {lang === 'KM'
                ? 'មិនឃើញចម្លើយដែលអ្នកត្រូវការ? ក្រុមការងារ Support របស់យើងត្រៀមជួយសម្រួលជូនអ្នកផ្ទាល់ ២៤/៧។'
                : "Can't find what you're looking for? Our support team is ready to assist you directly."}
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleOpenLiveChat}
                className="w-full bg-[#ffb230] hover:bg-[#ffc259] text-[#291800] font-headline text-xs sm:text-sm py-3.5 rounded-xl uppercase tracking-wider font-bold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-[#ffb230]/20"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{lang === 'KM' ? 'ឆាតផ្ទាល់ (Live Chat)' : 'Live Chat (Telegram)'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleArticleClick('refund')}
                className="w-full bg-[#282a31] hover:bg-[#33343c] text-[#ffd7a1] border border-white/10 font-headline text-xs py-3 rounded-xl uppercase tracking-wider font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4 text-[#ffb230]" />
                <span>{lang === 'KM' ? 'ច្បាប់ធានា ១៤ ថ្ងៃ (Warranty Rules)' : '14-Day Warranty Rules'}</span>
              </button>

              <a
                href="https://t.me/Noreakyout"
                target="_blank"
                rel="noreferrer"
                className="w-full bg-white/5 hover:bg-white/10 text-[#ffd7a1] hover:text-[#3ECF8E] border border-white/10 font-price text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors text-center"
              >
                <Send className="w-3.5 h-3.5 text-[#229ED9]" />
                <span>Contact Admin @Noreakyout</span>
              </a>
            </div>
          </section>

          {/* Helpful Articles Card */}
          <section className="bg-[#1C1F29]/70 rounded-2xl p-6 border border-white/10 flex flex-col gap-4 shadow-lg">
            <h3 className="font-headline text-sm text-[#e2e2ec] uppercase border-b border-white/10 pb-3 flex items-center justify-between">
              <span>{lang === 'KM' ? 'អត្ថបទមានប្រយោជន៍' : 'HELPFUL ARTICLES'}</span>
              <Sparkles className="w-4 h-4 text-[#ffb230]" />
            </h3>

            <ul className="flex flex-col gap-3">
              <li
                onClick={() => handleArticleClick('bind')}
                className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
              >
                <FileText className="w-4 h-4 text-[#ffb230] mt-0.5 shrink-0" />
                <div>
                  <span className="font-headline text-xs text-[#e2e2ec] group-hover:text-[#ffd7a1] transition-colors block">
                    {lang === 'KM' ? 'របៀបភ្ជាប់ និងការពារគណនី Roblox' : 'How to bind your Roblox account safely'}
                  </span>
                  <span className="text-[10px] font-price text-[#8B90A0]">Security & 2FA Guide</span>
                </div>
              </li>

              <li
                onClick={() => handleArticleClick('pity')}
                className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
              >
                <FileText className="w-4 h-4 text-[#3ECF8E] mt-0.5 shrink-0" />
                <div>
                  <span className="font-headline text-xs text-[#e2e2ec] group-hover:text-[#ffd7a1] transition-colors block">
                    {lang === 'KM' ? 'ការយល់ដឹងពី Member Rank & VIP' : 'Understanding Member Ranks & VIP'}
                  </span>
                  <span className="text-[10px] font-price text-[#8B90A0]">Discounts & Cashback system</span>
                </div>
              </li>

              <li
                onClick={() => handleArticleClick('refund')}
                className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
              >
                <FileText className="w-4 h-4 text-[#d6b2fc] mt-0.5 shrink-0" />
                <div>
                  <span className="font-headline text-xs text-[#e2e2ec] group-hover:text-[#ffd7a1] transition-colors block">
                    {lang === 'KM' ? 'គោលការណ៍ធានា និងដោះដូរ ១៤ ថ្ងៃ' : '14-Day Warranty & Refund Policy'}
                  </span>
                  <span className="text-[10px] font-price text-[#8B90A0]">Buyer protection guarantee</span>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </div>

      {/* Account Login Rules Modal */}
      <AccountLoginRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        lang={lang}
      />

      {/* Article Detail Modal */}
      {selectedArticleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1C1F29] border border-[#ffb230]/40 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-scale-in">
            <h3 className="font-headline text-lg text-[#ffd7a1] uppercase">
              {selectedArticleModal.title}
            </h3>
            <div className="text-xs font-price text-[#e2e2ec] leading-relaxed whitespace-pre-line bg-[#10121A] p-4 rounded-2xl border border-white/10">
              {selectedArticleModal.content}
            </div>
            <button
              onClick={() => setSelectedArticleModal(null)}
              className="w-full bg-[#ffb230] hover:bg-[#ffc259] text-[#291800] font-headline text-xs py-3 rounded-xl uppercase font-bold transition-colors"
            >
              {lang === 'KM' ? 'យល់ព្រម (Close)' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
