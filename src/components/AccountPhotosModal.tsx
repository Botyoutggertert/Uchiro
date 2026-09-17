import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Shield, ShieldCheck, Zap, Image as ImageIcon } from 'lucide-react';

interface AccountPhotosModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onBuyNow?: (product: Product) => void;
  lang: 'KM' | 'EN';
}

export const AccountPhotosModal: React.FC<AccountPhotosModalProps> = ({
  product,
  isOpen,
  onClose,
  onBuyNow,
  lang,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  // Collect all photos: product.image + (product.galleryImages || [])
  const photos: string[] = React.useMemo(() => {
    if (!product) return [];
    const list: string[] = [];
    if (product.image) list.push(product.image);
    if (product.galleryImages && Array.isArray(product.galleryImages)) {
      product.galleryImages.forEach((img) => {
        if (img && !list.includes(img)) list.push(img);
      });
    }
    // If only 1 image exists, provide standard high-res account views for game detail showcase
    if (list.length === 1 && (product.category === 'account' || product.fulfillmentType === 'account')) {
      list.push(
        'https://lh3.googleusercontent.com/aida-public/AB6AXuD9DF2r82If6k-o9Qy6hKhyEHQ3NPbNIgYk-T7uQuAdBVMIBUCMwooA0nSI9h4M7OvdHv8fiVIVoaYKp9Y9QCCW7q1NENUTjAI_H2tRCKvW2wTwMAjOTaQVTZ-VmPi_8yukjjb1PLAGKOiVWbA0QAXzfXX6e47NWWx00S6sI_JS2eCerJIX5hJsgb0oHTfekOKXNh60Bs1LUd852ku8qCaQYOTSfUhV-eBXOtc93-Zp3lDiADWfzOnh',
        'https://lh3.googleusercontent.com/aida-public/AB6AXuALQbCc50G6KLs92tN0eELonrjHJe-8u9EWsQqEFRatRZt7TkO-e0PvcOaTFQelO1uzme9TRCMCHWBDZlmiVtN-fZRijhhKA5PJ-BN1-Xi2HQIlzD5s7AU_tE7dn4vZqd_m9YhDvt7WU3vSdKferzlCo2crER8gHVSNillopH9LxGW74r3Amn1LcJ6gWeBoJC-vhasU5J7d-B9MoEUs0We5i5FQdWnSiQuQ92PMWG3iH-Jh9Q6QHcwm'
      );
    }
    return list;
  }, [product]);

  useEffect(() => {
    setCurrentIndex(0);
    setIsZoomed(false);
  }, [product, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, photos.length]);

  if (!isOpen || !product) return null;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
    setIsZoomed(false);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    setIsZoomed(false);
  };

  const warrantyDays = product.warrantyDays || 14;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/90 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
      {/* Background click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-4xl bg-[#14161D] border border-white/10 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 bg-[#1C1F29]/95 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="p-1.5 rounded-lg bg-[#ffb230]/15 text-[#ffb230] shrink-0">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-khmer text-sm md:text-base font-bold text-[#ffd7a1] truncate">
                {lang === 'KM' ? product.titleKhmer : product.title}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-price text-[11px] text-[#3ECF8E] font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{warrantyDays}D Official Warranty</span>
                </span>
                <span className="text-[#8B90A0] text-[10px]">•</span>
                <span className="font-price text-[11px] text-[#ffd7a1] font-extrabold">
                  ${(product.price ?? 0).toFixed(2)} USD
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Zoom Toggle */}
            <button
              onClick={() => setIsZoomed(!isZoomed)}
              className="p-2 rounded-xl bg-[#282a31] hover:bg-[#343742] text-[#d6c4ae] hover:text-[#ffb230] transition-colors border border-white/5"
              title={isZoomed ? 'Zoom Out' : 'Zoom In'}
            >
              {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#282a31] hover:bg-[#E8433F] text-[#8B90A0] hover:text-white transition-colors border border-white/5"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Photo Viewport */}
        <div className="relative flex-1 bg-[#090a0f] flex items-center justify-center overflow-hidden min-h-[300px] sm:min-h-[420px] max-h-[65vh]">
          {photos.length > 0 ? (
            <img
              src={photos[currentIndex]}
              alt={`Account screenshot ${currentIndex + 1}`}
              className={`max-w-full max-h-[65vh] object-contain transition-transform duration-300 select-none ${
                isZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'
              }`}
              onClick={() => setIsZoomed(!isZoomed)}
            />
          ) : (
            <div className="text-center p-8 text-[#8B90A0]">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p>{lang === 'KM' ? 'មិនមានរូបភាពបន្ថែម' : 'No photos available'}</p>
            </div>
          )}

          {/* Navigation Arrows */}
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#1C1F29]/80 hover:bg-[#ffb230] hover:text-[#291800] text-white border border-white/20 backdrop-blur-md flex items-center justify-center transition-all shadow-xl active:scale-95"
                title="Previous photo"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#1C1F29]/80 hover:bg-[#ffb230] hover:text-[#291800] text-white border border-white/20 backdrop-blur-md flex items-center justify-center transition-all shadow-xl active:scale-95"
                title="Next photo"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Photo Counter Pill */}
          {photos.length > 1 && (
            <div className="absolute top-3 left-3 bg-[#0A0B0E]/85 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 font-price text-xs text-[#ffd7a1] font-bold shadow-lg">
              {lang === 'KM' ? `រូបភាព ${currentIndex + 1} / ${photos.length}` : `Photo ${currentIndex + 1} of ${photos.length}`}
            </div>
          )}
        </div>

        {/* Thumbnails Row & Action Bar */}
        <div className="p-3 sm:p-4 bg-[#14161D] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Thumbnails List */}
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none">
            {photos.map((img, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx);
                  setIsZoomed(false);
                }}
                className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 bg-[#0A0B0E] ${
                  currentIndex === idx
                    ? 'border-[#ffb230] shadow-[0_0_12px_rgba(255,178,48,0.5)] scale-105'
                    : 'border-white/10 opacity-60 hover:opacity-100 hover:border-white/30'
                }`}
              >
                <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          {/* Account Detail Highlights Bar */}
          <div className="mx-3 sm:mx-6 my-2 p-2.5 rounded-xl bg-[#1C1F29]/90 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs font-price">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[#ffd7a1] font-bold">⚡ Max Level (2550)</span>
              <span className="text-[#8B90A0]">•</span>
              <span className="text-[#3ECF8E] font-bold">Godhuman / V4</span>
              <span className="text-[#8B90A0]">•</span>
              <span className="text-[#3ECF8E] font-medium">Unlinked Clean Email</span>
              <span className="text-[#8B90A0]">•</span>
              <span className="text-[#ffb230] font-bold">{warrantyDays}-Day Warranty</span>
            </div>
            <div className="text-[11px] text-[#8B90A0]">
              Instant Auto Delivery
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#282a31] hover:bg-[#343742] text-[#e2e2ec] font-headline text-xs uppercase tracking-wider transition-colors"
            >
              {lang === 'KM' ? 'បិទ (Close)' : 'Close'}
            </button>
            {onBuyNow && !product.isSold && product.stock > 0 && (
              <button
                onClick={() => {
                  onClose();
                  onBuyNow(product);
                }}
                className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] font-headline text-xs font-extrabold uppercase tracking-wider shadow-[0_0_15px_rgba(255,178,48,0.4)] flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>
                  {lang === 'KM'
                    ? `ទិញឥឡូវ — $${(product.price ?? 0).toFixed(2)}`
                    : `BUY NOW — $${(product.price ?? 0).toFixed(2)}`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
