export type MemberTier = 'Member' | 'Gold' | 'Diamond' | 'Reseller';

export interface MemberRankInfo {
  tier: MemberTier;
  title: string;
  badgeLabel: string;
  badgeLabelKhmer: string;
  icon: string; // Emoji / Symbol
  autoDiscountPercent: number; // 0%, 5%, 10%, 20%
  gradient: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  chipClass: string;
  avatarBorder: string;
  currentSpent: number;
  nextTier?: MemberTier;
  nextTierThreshold?: number;
  amountNeededForNextTier?: number;
  progressPercent: number; // 0 to 100
  perks: {
    title: string;
    titleKhmer: string;
    description: string;
    descriptionKhmer: string;
    icon: string;
  }[];
}

export const MEMBER_THRESHOLDS = {
  MEMBER: 0,
  GOLD: 30,     // $30+ spent -> Gold (5% Auto Discount)
  DIAMOND: 50,  // $50+ spent -> Diamond (10% Auto Discount)
  RESELLER: 100, // $100+ spent -> Reseller (20% Auto Discount)
} as const;

export function getRankDiscountPercent(tier: MemberTier): number {
  switch (tier) {
    case 'Reseller':
      return 20;
    case 'Diamond':
      return 10;
    case 'Gold':
      return 5;
    case 'Member':
    default:
      return 0;
  }
}

export const VALID_RESELLER_CODES = [
  'RESELLER-VIP',
  'RESELLER2026',
  'UCHIRO-RESELLER',
  'VIP-RESELLER',
  'RESELLER',
  'ADMIN-RESELLER',
  'RESELLER-KH',
  'VIP-RESELLER-2026',
  'UCHIRO-VIP-RESELLER',
] as const;

export function verifyResellerCode(code: string): boolean {
  if (!code) return false;
  const cleanCode = code.trim().toUpperCase();
  return VALID_RESELLER_CODES.some((valid) => valid.toUpperCase() === cleanCode);
}

/**
 * Calculates member rank and progression metrics based on total USD spent or Reseller code unlock.
 * - Gold: $30+ (5% auto discount every order)
 * - Diamond: $50+ (10% auto discount every order)
 * - Reseller: $100+ or Redeemed VIP Code via Admin (20% auto discount every order)
 */
export function getMemberRankInfo(totalSpentUSD: number, isResellerUnlocked?: boolean): MemberRankInfo {
  const spent = Math.max(0, totalSpentUSD || 0);

  if (isResellerUnlocked || spent >= MEMBER_THRESHOLDS.RESELLER) {
    // Reseller Rank (either unlocked via Admin Code or >= $100 spent) -> 20% Auto Discount
    return {
      tier: 'Reseller',
      title: 'Reseller VIP',
      badgeLabel: 'RESELLER',
      badgeLabelKhmer: 'តំណាងចែកចាយ (RESELLER)',
      icon: '💼',
      autoDiscountPercent: 20,
      gradient: 'from-[#FF007A] via-[#9B51E0] to-[#00F0FF]',
      textColor: 'text-[#FF007A]',
      bgColor: 'bg-[#FF007A]/15',
      borderColor: 'border-[#FF007A]/50',
      glowColor: 'shadow-[0_0_20px_rgba(255,0,122,0.35)]',
      chipClass: 'bg-[#FF007A]/15 text-[#FF007A] border-[#FF007A]/40 shadow-[0_0_12px_rgba(255,0,122,0.25)]',
      avatarBorder: 'border-[#FF007A] shadow-[0_0_20px_rgba(255,0,122,0.4)]',
      currentSpent: spent,
      nextTier: undefined,
      nextTierThreshold: undefined,
      amountNeededForNextTier: 0,
      progressPercent: 100,
      perks: [
        {
          title: '20% Auto Discount on Every Order',
          titleKhmer: 'បញ្ចុះតម្លៃ ២០% ស្វ័យប្រវត្តិគ្រប់ការបញ្ជាទិញ',
          description: 'Automatic 20% discount applied immediately at checkout without coupon codes',
          descriptionKhmer: 'បញ្ចុះតម្លៃ ២០% ភ្លាមៗពេលទូទាត់ប្រាក់ដោយស្វ័យប្រវត្តិ',
          icon: '🔥',
        },
        {
          title: 'Wholesale Stock Reservation',
          titleKhmer: 'កក់ស្តុកគណនីបោះដុំ',
          description: 'Direct wholesale bulk account reservation and custom requests',
          descriptionKhmer: 'សិទ្ធិកក់ស្តុកគណនីបោះដុំ និងបញ្ជាទិញច្រើនក្នុងតម្លៃពិសេស',
          icon: '📦',
        },
        {
          title: 'Direct VIP Telegram / Hotline',
          titleKhmer: 'សេវាកម្មអាទិភាពខ្ពស់បំផុត',
          description: 'Direct 1-on-1 support line with the Store Founder & fast manual support',
          descriptionKhmer: 'ខ្សែទំនាក់ទំនងផ្ទាល់ជាមួយម្ចាស់ហាង និងដោះស្រាយរហ័សបំផុត',
          icon: '⚡',
        },
      ],
    };
  }

  if (spent >= MEMBER_THRESHOLDS.DIAMOND) {
    // Diamond Rank (>= $50 and < $100) -> 10% Auto Discount
    const needed = Math.max(0, MEMBER_THRESHOLDS.RESELLER - spent);
    const range = MEMBER_THRESHOLDS.RESELLER - MEMBER_THRESHOLDS.DIAMOND;
    const progress = Math.min(99, Math.max(5, ((spent - MEMBER_THRESHOLDS.DIAMOND) / range) * 100));

    return {
      tier: 'Diamond',
      title: 'Diamond Member',
      badgeLabel: 'DIAMOND',
      badgeLabelKhmer: 'ពេជ្រ (DIAMOND)',
      icon: '💎',
      autoDiscountPercent: 10,
      gradient: 'from-[#00F0FF] via-[#7000FF] to-[#00F0FF]',
      textColor: 'text-[#00F0FF]',
      bgColor: 'bg-[#00F0FF]/15',
      borderColor: 'border-[#00F0FF]/50',
      glowColor: 'shadow-[0_0_20px_rgba(0,240,255,0.35)]',
      chipClass: 'bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF]/40 shadow-[0_0_12px_rgba(0,240,255,0.25)]',
      avatarBorder: 'border-[#00F0FF] shadow-[0_0_20px_rgba(0,240,255,0.4)]',
      currentSpent: spent,
      nextTier: 'Reseller',
      nextTierThreshold: MEMBER_THRESHOLDS.RESELLER,
      amountNeededForNextTier: needed,
      progressPercent: progress,
      perks: [
        {
          title: '10% Auto Discount on Every Order',
          titleKhmer: 'បញ្ចុះតម្លៃ ១០% ស្វ័យប្រវត្តិគ្រប់ការបញ្ជាទិញ',
          description: 'Automatic 10% discount applied immediately on all Roblox accounts & items',
          descriptionKhmer: 'ទទួលបានការបញ្ចុះតម្លៃ ១០% ស្វ័យប្រវត្តិនឹងគ្រប់មុខទំនិញ',
          icon: '💎',
        },
        {
          title: 'Priority Instant Delivery',
          titleKhmer: 'ដឹកជញ្ជូនរហ័សអាទិភាព',
          description: 'Instant automated 2FA account access and fast fulfillment priority',
          descriptionKhmer: 'ទទួលបានគណនី និងកូដសុវត្ថិភាពភ្លាមៗដោយស្វ័យប្រវត្តិ',
          icon: '⚡',
        },
        {
          title: 'Lifetime 14-Day Warranty',
          titleKhmer: 'ការធានាការពារ ១៤ ថ្ងៃ',
          description: 'Extended account replacement guarantee on all purchases',
          descriptionKhmer: 'ធានាប្តូរគណនីថ្មីជូនភ្លាមៗរយៈពេល ១៤ ថ្ងៃពេញ',
          icon: '🛡️',
        },
      ],
    };
  }

  if (spent >= MEMBER_THRESHOLDS.GOLD) {
    // Gold Rank (>= $30 and < $50) -> 5% Auto Discount
    const needed = Math.max(0, MEMBER_THRESHOLDS.DIAMOND - spent);
    const range = MEMBER_THRESHOLDS.DIAMOND - MEMBER_THRESHOLDS.GOLD;
    const progress = Math.min(99, Math.max(5, ((spent - MEMBER_THRESHOLDS.GOLD) / range) * 100));

    return {
      tier: 'Gold',
      title: 'Gold Member',
      badgeLabel: 'GOLD',
      badgeLabelKhmer: 'មាស (GOLD)',
      icon: '👑',
      autoDiscountPercent: 5,
      gradient: 'from-[#ffd7a1] via-[#ffb230] to-[#ff9800]',
      textColor: 'text-[#ffb230]',
      bgColor: 'bg-[#ffb230]/15',
      borderColor: 'border-[#ffb230]/50',
      glowColor: 'shadow-[0_0_20px_rgba(255,178,48,0.35)]',
      chipClass: 'bg-[#ffb230]/20 text-[#ffb230] border-[#ffb230]/50 shadow-[0_0_12px_rgba(255,178,48,0.3)]',
      avatarBorder: 'border-[#ffb230] shadow-[0_0_20px_rgba(255,178,48,0.4)]',
      currentSpent: spent,
      nextTier: 'Diamond',
      nextTierThreshold: MEMBER_THRESHOLDS.DIAMOND,
      amountNeededForNextTier: needed,
      progressPercent: progress,
      perks: [
        {
          title: '5% Auto Discount on Every Order',
          titleKhmer: 'បញ្ចុះតម្លៃ ៥% ស្វ័យប្រវត្តិគ្រប់ការបញ្ជាទិញ',
          description: 'Automatic 5% discount applied immediately at checkout on every product',
          descriptionKhmer: 'បញ្ចុះតម្លៃ ៥% ដោយស្វ័យប្រវត្តិរាល់ពេលបញ្ជាទិញ',
          icon: '👑',
        },
        {
          title: 'Priority Order Queue',
          titleKhmer: 'ជួរដឹកជញ្ជូនរហ័ស',
          description: 'Your KHQR payment slips are verified with elevated priority',
          descriptionKhmer: 'វិក្កយបត្រ KHQR របស់អ្នកត្រូវបានពិនិត្យ និងបញ្ជាក់លឿនជាងមុន',
          icon: '🚀',
        },
        {
          title: 'Verified Gold Telegram Role',
          titleKhmer: 'តួនាទី Gold លើ Telegram',
          description: 'Verified Gold Member badge in our official Telegram community',
          descriptionKhmer: 'ទទួលបានសញ្ញាសម្គាល់ Gold Member ក្នុងសហគមន៍ Telegram',
          icon: '⭐',
        },
      ],
    };
  }

  // Standard Member Rank (< $30) -> 0% Auto Discount
  const needed = Math.max(0, MEMBER_THRESHOLDS.GOLD - spent);
  const progress = Math.min(99, Math.max(0, (spent / MEMBER_THRESHOLDS.GOLD) * 100));

  return {
    tier: 'Member',
    title: 'Standard Member',
    badgeLabel: 'MEMBER',
    badgeLabelKhmer: 'សមាជិក (MEMBER)',
    icon: '🛡️',
    autoDiscountPercent: 0,
    gradient: 'from-[#8B90A0] via-[#cac6bb] to-[#8B90A0]',
    textColor: 'text-[#cac6bb]',
    bgColor: 'bg-white/10',
    borderColor: 'border-white/20',
    glowColor: 'shadow-none',
    chipClass: 'bg-white/10 text-[#cac6bb] border-white/20',
    avatarBorder: 'border-[#8B90A0] shadow-sm',
    currentSpent: spent,
    nextTier: 'Gold',
    nextTierThreshold: MEMBER_THRESHOLDS.GOLD,
    amountNeededForNextTier: needed,
    progressPercent: progress,
    perks: [
      {
        title: 'Instant KHQR Checkout',
        titleKhmer: 'ទូទាត់រហ័សតាម KHQR',
        description: 'Scan & pay with Bakong, ABA, ACLEDA, Wing & all Cambodian banks',
        descriptionKhmer: 'ស្កេនទូទាត់ងាយស្រួលជាមួយគ្រប់ធនាគារក្នុងប្រទេសកម្ពុជា',
        icon: '💳',
      },
      {
        title: 'Auto 2FA Account Access',
        titleKhmer: 'ប្រព័ន្ធ TOTP 2FA ស្វ័យប្រវត្តិ',
        description: 'Live one-time security codes generated directly in your dashboard',
        descriptionKhmer: 'កូដសុវត្ថិភាព 2FA បង្កើតដោយស្វ័យប្រវត្តិក្នងផ្ទាំងបញ្ជា',
        icon: '🔐',
      },
      {
        title: '24/7 Telegram Support',
        titleKhmer: 'សេវាបម្រើអតិថិជន ២៤ ម៉ោង',
        description: 'Direct support from our Cambodian team via Telegram',
        descriptionKhmer: 'ជំនួយបច្ចេកទេស និងដោះស្រាយបញ្ហាគ្រប់ពេលវេលាតាម Telegram',
        icon: '💬',
      },
    ],
  };
}
