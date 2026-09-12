import React, { useState, useRef, useEffect } from 'react';
import { ProductSortOption } from '../types';
import { ArrowUpDown, ArrowUp, ArrowDown, Sparkles, Check, ChevronDown } from 'lucide-react';

interface ProductSortDropdownProps {
  sortBy: ProductSortOption;
  onSortChange: (option: ProductSortOption) => void;
  lang?: 'KM' | 'EN';
  className?: string;
}

interface SortOptionConfig {
  id: ProductSortOption;
  label: string;
  labelKhmer: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeText?: string;
}

const SORT_OPTIONS: SortOptionConfig[] = [
  {
    id: 'newest',
    label: 'Newest First',
    labelKhmer: 'ទំនិញថ្មីៗមុនគេ',
    icon: Sparkles,
  },
  {
    id: 'price-asc',
    label: 'Price: Low to High',
    labelKhmer: 'តម្លៃ៖ ទាប ទៅ ខ្ពស់',
    icon: ArrowUp,
  },
  {
    id: 'price-desc',
    label: 'Price: High to Low',
    labelKhmer: 'តម្លៃ៖ ខ្ពស់ ទៅ ទាប',
    icon: ArrowDown,
  },
];

export const ProductSortDropdown: React.FC<ProductSortDropdownProps> = ({
  sortBy,
  onSortChange,
  lang = 'EN',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = SORT_OPTIONS.find((opt) => opt.id === sortBy) || SORT_OPTIONS[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (optionId: ProductSortOption) => {
    onSortChange(optionId);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`} id="product-sorting-container">
      {/* Trigger Button */}
      <button
        id="product-sort-dropdown-trigger"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="h-10 sm:h-[38px] px-3.5 bg-[#1C1F29] hover:bg-[#232733] border border-white/10 hover:border-[#ffb230]/50 rounded-xl text-[#e2e2ec] font-price text-xs sm:text-sm flex items-center justify-between gap-2.5 shadow-md transition-all active:scale-98 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#ffb230]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ArrowUpDown className="w-3.5 h-3.5 text-[#ffb230] shrink-0" />
          <span className="text-[#8B90A0] text-xs hidden xs:inline">
            {lang === 'KM' ? 'តម្រៀប:' : 'Sort:'}
          </span>
          <span className="font-bold text-[#ffd7a1] truncate">
            {lang === 'KM' ? currentOption.labelKhmer : currentOption.label}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#8B90A0] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#ffd7a1]' : ''
          }`}
        />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div
          id="product-sort-dropdown-menu"
          role="listbox"
          aria-label="Sort products"
          className="absolute right-0 top-full mt-2 z-40 w-56 sm:w-64 bg-[#1C1F29]/95 backdrop-blur-md border border-[#ffb230]/30 rounded-2xl p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.6)] animate-fade-in divide-y divide-white/5"
        >
          <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-[#8B90A0] font-price flex items-center justify-between">
            <span>{lang === 'KM' ? 'ជម្រើសតម្រៀប' : 'Sort Products By'}</span>
            <span className="text-[#ffb230]">3 options</span>
          </div>

          <div className="py-1 space-y-1">
            {SORT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = option.id === sortBy;

              return (
                <button
                  key={option.id}
                  id={`sort-option-${option.id}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-price text-xs sm:text-sm transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#ffb230]/15 text-[#ffd7a1] font-bold border border-[#ffb230]/30 shadow-sm'
                      : 'text-[#c2c5d6] hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-[#ffb230] text-[#291800]' : 'bg-[#11131a] text-[#8B90A0]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="truncate font-semibold">{option.label}</div>
                      {lang === 'KM' && (
                        <div className="text-[10px] text-[#8B90A0] truncate">{option.labelKhmer}</div>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-[#ffb230]/20 flex items-center justify-center shrink-0 ml-2">
                      <Check className="w-3.5 h-3.5 text-[#ffb230]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
