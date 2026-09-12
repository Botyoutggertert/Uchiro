import React from 'react';
import { CategoryType, Product } from '../types';
import { Sparkles, Layers } from 'lucide-react';

interface CategoryGridProps {
  selectedCategory: CategoryType;
  onSelectCategory: (category: CategoryType) => void;
  lang: 'KM' | 'EN';
  products?: Product[];
}

interface CategoryItem {
  id: CategoryType;
  name: string;
  nameKhmer: string;
  emoji: string;
  secondaryEmoji?: string;
  accentColor: string;
  glowColor: string;
  badgeBg: string;
  borderColor: string;
  bgGradient: string;
}

const LINE_1_CATEGORIES: CategoryItem[] = [
  {
    id: 'all',
    name: 'All Items',
    nameKhmer: 'ទាំងអស់',
    emoji: '🌌',
    secondaryEmoji: '✨',
    accentColor: '#ffb230',
    glowColor: 'rgba(255, 178, 48, 0.25)',
    badgeBg: 'bg-gradient-to-br from-[#ffb230]/25 via-[#ff9500]/15 to-[#3ECF8E]/15',
    borderColor: 'border-[#ffb230]/50',
    bgGradient: 'from-[#241e16] to-[#151722]',
  },
  {
    id: 'account',
    name: 'Accounts',
    nameKhmer: 'គណនី',
    emoji: '👑',
    secondaryEmoji: '🛡️',
    accentColor: '#F59E0B',
    glowColor: 'rgba(245, 158, 11, 0.25)',
    badgeBg: 'bg-gradient-to-br from-[#F59E0B]/25 via-[#D97706]/15 to-[#8B5CF6]/15',
    borderColor: 'border-[#F59E0B]/50',
    bgGradient: 'from-[#272014] to-[#151724]',
  },
  {
    id: 'fruit',
    name: 'Blox Fruits',
    nameKhmer: 'ផ្លែឈើ',
    emoji: '🍇',
    secondaryEmoji: '🔥',
    accentColor: '#EC4899',
    glowColor: 'rgba(236, 72, 153, 0.25)',
    badgeBg: 'bg-gradient-to-br from-[#EC4899]/25 via-[#EF4444]/15 to-[#8B5CF6]/15',
    borderColor: 'border-[#EC4899]/50',
    bgGradient: 'from-[#261420] to-[#151724]',
  },
  {
    id: 'gamepass',
    name: 'Gamepasses',
    nameKhmer: 'Gamepass',
    emoji: '🎟️',
    secondaryEmoji: '⚡',
    accentColor: '#06B6D4',
    glowColor: 'rgba(6, 182, 212, 0.25)',
    badgeBg: 'bg-gradient-to-br from-[#06B6D4]/25 via-[#3ECF8E]/15 to-[#3B82F6]/15',
    borderColor: 'border-[#06B6D4]/50',
    bgGradient: 'from-[#102228] to-[#131624]',
  },
];

const LINE_2_CATEGORIES: CategoryItem[] = [
  {
    id: 'evade',
    name: 'Evade',
    nameKhmer: 'Evade',
    emoji: '🏃‍♂️',
    secondaryEmoji: '💨',
    accentColor: '#F97316',
    glowColor: 'rgba(249, 115, 22, 0.25)',
    badgeBg: 'bg-gradient-to-br from-[#F97316]/25 via-[#EAB308]/15 to-[#EF4444]/15',
    borderColor: 'border-[#F97316]/50',
    bgGradient: 'from-[#271a13] to-[#151724]',
  },
  {
    id: 'mm2',
    name: 'MM2',
    nameKhmer: 'MM2 Godly',
    emoji: '🗡️',
    secondaryEmoji: '🩸',
    accentColor: '#E11D48',
    glowColor: 'rgba(225, 29, 72, 0.25)',
    badgeBg: 'bg-gradient-to-br from-[#E11D48]/25 via-[#BE123C]/15 to-[#881337]/20',
    borderColor: 'border-[#E11D48]/50',
    bgGradient: 'from-[#271218] to-[#151520]',
  },
  {
    id: 'blade-ball',
    name: 'Blade Ball',
    nameKhmer: 'Blade Ball',
    emoji: '⚔️',
    secondaryEmoji: '💥',
    accentColor: '#8B5CF6',
    glowColor: 'rgba(139, 92, 246, 0.25)',
    badgeBg: 'bg-gradient-to-br from-[#8B5CF6]/25 via-[#6366F1]/15 to-[#EC4899]/15',
    borderColor: 'border-[#8B5CF6]/50',
    bgGradient: 'from-[#1e162b] to-[#131524]',
  },
];

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  selectedCategory,
  onSelectCategory,
  lang,
  products = [],
}) => {
  // Compute counts per category
  const getCategoryCount = (id: CategoryType) => {
    if (products.length === 0) return 0;
    const availableProducts = products.filter((p) => !p.isDraft);

    if (id === 'all') {
      return availableProducts.length;
    }
    return availableProducts.filter((p) => p.category === id).length;
  };

  const renderCategoryButton = (cat: CategoryItem) => {
    const isSelected = selectedCategory === cat.id;
    const count = getCategoryCount(cat.id);

    return (
      <button
        key={cat.id}
        onClick={() => onSelectCategory(cat.id)}
        className={`group relative rounded-xl p-1.5 sm:px-3 sm:py-2.5 flex items-center justify-start sm:justify-center gap-1.5 sm:gap-2 text-left transition-all duration-200 cursor-pointer overflow-hidden active:scale-95 border min-w-0 ${
          isSelected
            ? `bg-gradient-to-b ${cat.bgGradient} ${cat.borderColor} shadow-[0_0_12px_${cat.glowColor}] ring-1 ring-${cat.accentColor}/40`
            : 'bg-[#151722]/90 hover:bg-[#1A1D2B] border-white/5 hover:border-white/15'
        }`}
        style={{
          borderColor: isSelected ? cat.accentColor : undefined,
          boxShadow: isSelected ? `0 0 12px ${cat.glowColor}` : undefined,
        }}
      >
        {/* Ambient hover glow */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${cat.glowColor}, transparent 70%)`,
          }}
        />

        {/* Small Crisp Emoji Icon Badge */}
        <div
          className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg ${cat.badgeBg} border ${
            isSelected ? 'border-white/30' : 'border-white/10 group-hover:border-white/20'
          } flex items-center justify-center relative shrink-0 transition-transform duration-200 group-hover:scale-110 shadow-sm`}
        >
          <span className="text-xs sm:text-base select-none filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
            {cat.emoji}
          </span>
          {cat.secondaryEmoji && (
            <span className="absolute -bottom-1 -right-1 text-[8px] sm:text-[10px] select-none">
              {cat.secondaryEmoji}
            </span>
          )}
        </div>

        {/* Text Container: Title & Count */}
        <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
          <span
            className={`font-user text-[11px] sm:text-sm font-bold truncate leading-tight transition-colors ${
              isSelected ? 'text-white' : 'text-[#d6c4ae] group-hover:text-white'
            }`}
          >
            {lang === 'KM' ? cat.nameKhmer : cat.name}
          </span>

          {count !== null && (
            <span
              className="font-price text-[8px] sm:text-[10px] leading-none mt-0.5 transition-colors font-medium truncate"
              style={{
                color: isSelected ? cat.accentColor : '#8B90A0',
              }}
            >
              {count} {lang === 'KM' ? 'មុខ' : 'items'}
            </span>
          )}
        </div>

        {/* Active subtle indicator dot */}
        {isSelected && (
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse hidden xs:block"
            style={{ backgroundColor: cat.accentColor }}
          />
        )}
      </button>
    );
  };

  return (
    <section className="mt-4 md:mt-5 mb-2">
      {/* Sleek Compact Header */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-[#ffb230]/15 border border-[#ffb230]/30 flex items-center justify-center text-[#ffb230]">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <h2 className="font-user font-bold text-xs sm:text-sm text-[#ffd7a1] uppercase tracking-wider">
            {lang === 'KM' ? 'ប្រភេទមុខទំនិញ' : 'Categories'}
          </h2>
        </div>

        <div className="flex items-center gap-1 font-price text-[10px] text-[#8B90A0]">
          <Sparkles className="w-3 h-3 text-[#ffb230]" />
          <span>7 {lang === 'KM' ? 'ប្រភេទ' : 'Categories'}</span>
        </div>
      </div>

      {/* 2-Line Category Grid System */}
      <div className="flex flex-col gap-1.5 sm:gap-2">
        {/* Line 1: 4 Main Categories (All, Accounts, Blox Fruits, Gamepasses) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
          {LINE_1_CATEGORIES.map(renderCategoryButton)}
        </div>

        {/* Line 2: 3 Specialized Game Categories (Evade, MM2, Blade Ball) */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {LINE_2_CATEGORIES.map(renderCategoryButton)}
        </div>
      </div>
    </section>
  );
};
