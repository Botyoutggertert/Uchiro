import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import {
  Shield,
  Zap,
  X,
  ZoomIn,
  ShoppingCart,
  Gift,
  Users,
  Send,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Ban,
  Lock,
  Image as ImageIcon,
  CheckCircle2,
  Key,
  Award,
  Sparkles,
  ShieldCheck,
  Share2,
  Check,
  Globe,
} from 'lucide-react';
import { AccountLoginRulesModal } from './AccountLoginRulesModal';
import { updateProductSeo, getProductShareUrl } from '../utils/seo';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onProceedToCheckout: (product: Product) => void;
  onViewPhotos?: (product: Product) => void;
  lang: 'KM' | 'EN';
  isLoggedIn?: boolean;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onProceedToCheckout,
  onViewPhotos,
  lang,
  isLoggedIn = false,
}) => {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Dynamically update document Open Graph / Twitter card tags for the currently viewed product
  useEffect(() => {
    if (product) {
      updateProductSeo(product);
    }
  }, [product]);

  const shareUrl = product ? getProductShareUrl(product.id) : '';

  const handleShare = async () => {
    if (!product) return;
    const price = typeof product.priceUSD === 'number' ? product.priceUSD : (product.price || 0);
    const shareData = {
      title: `${product.title} - $${price.toFixed(2)} | Uchiro Store`,
      text: product.descriptionKhmer || product.description || 'Check out this gaming item on Uchiro Store!',
      url: shareUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    // Fallback: Copy link to clipboard
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Collect all photos: product.image + (product.galleryImages || []) + sample detail views
  const photos: string[] = React.useMemo(() => {
    if (!product) return [];
    const list: string[] = [];
    if (product.image) list.push(product.image);
    if (product.galleryImages && Array.isArray(product.galleryImages)) {
      product.galleryImages.forEach((img) => {
        if (img && !list.includes(img)) list.push(img);
      });
    }
    // High-res account detail showcase images for accounts
    if (list.length === 1 && (product.category === 'account' || product.fulfillmentType === 'account')) {
      list.push(
        'https://lh3.googleusercontent.com/aida-public/AB6AXuD9DF2r82If6k-o9Qy6hKhyEHQ3NPbNIgYk-T7uQuAdBVMIBUCMwooA0nSI9h4M7OvdHv8fiVIVoaYKp9Y9QCCW7q1NENUTjAI_H2tRCKvW2wTwMAjOTaQVTZ-VmPi_8yukjjb1PLAGKOiVWbA0QAXzfXX6e47NWWx00S6sI_JS2eCerJIX5hJsgb0oHTfekOKXNh60Bs1LUd852ku8qCaQYOTSfUhV-eBXOtc93-Zp3lDiADWfzOnh',
        'https://lh3.googleusercontent.com/aida-public/AB6AXuALQbCc50G6KLs92tN0eELonrjHJe-8u9EWsQqEFRatRZt7TkO-e0PvcOaTFQelO1uzme9TRCMCHWBDZlmiVtN-fZRijhhKA5PJ-BN1-Xi2HQIlzD5s7AU_tE7dn4vZqd_m9YhDvt7WU3vSdKferzlCo2crER8gHVSNillopH9LxGW74r3Amn1LcJ6gWeBoJC-vhasU5J7d-B9MoEUs0We5i5FQdWnSiQuQ92PMWG3iH-Jh9Q6QHcwm'
      );
    }
    return list;
  }, [product]);

  if (!product) return null;

  const isSoldOut = product.isSold || product.stock <= 0;
  const isFruit = product.category === 'fruit';
  const isAccount = product.fulfillmentType === 'account' || product.category === 'account';
  const isGamepassOrPerm =
    product.category === 'gamepass' ||
    product.title.toLowerCase().includes('gamepass') ||
    product.title.toLowerCase().includes('perm') ||
    product.category === 'fruit';
  const isGift = product.fulfillmentType === 'gift' || product.category === 'gamepass';
  const isTrade = product.fulfillmentType === 'trade' || (!isAccount && !isGift);
  const warrantyDays = product.warrantyDays || 14;

  const currentImg = photos[photoIndex] || product.image;

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev + 1) % photos.length);
    setIsZoomed(false);
  };

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
    setIsZoomed(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col justify-end items-center sm:p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal Card / Bottom Sheet on Mobile */}
        <div className="relative w-full max-w-lg bg-[#14161D] border border-white/10 rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col z-10 animate-slide-up">
          {/* Drag Handle & Header Actions */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="w-12 h-1.5 bg-[#33343c] rounded-full mx-auto" />
            <div className="absolute right-4 top-3.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="w-8 h-8 rounded-full bg-[#1C1F29] border border-white/15 text-[#ffd7a1] hover:text-[#ffb230] hover:border-[#ffb230]/50 flex items-center justify-center transition-all shadow-md active:scale-90 cursor-pointer"
                title={lang === 'KM' ? 'ចែករំលែកតំណភ្ជាប់ទំនិញ' : 'Share Product Link'}
              >
                {copied ? <Check className="w-4 h-4 text-[#3ECF8E]" /> : <Share2 className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#1C1F29] border border-white/10 text-[#8B90A0] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto px-5 md:px-6 pb-6 pb-safe mobile-scroll-container flex flex-col gap-4">
            {/* Media Gallery Header */}
            <div className="flex flex-col gap-2">
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 group bg-[#0A0B0E]">
                <img
                  src={currentImg}
                  alt={`${product.title} view ${photoIndex + 1}`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAJbPmK_4tXbPo7csvq5Th9P3jTxJ0832ZJXjTEiILWmnuAzoW1cThcH0p1D2Er4LY0IgbfX0j5zzK5XO26Ej73VWHE9q3JXLYadZTOJdYu9tOtAX3vKWuuA1SA8xJA_w9FyaBAERQu816-BlDrGtKKhocghmuzg37LdL7w50CkOyb9f468g3emhq45yCP_vgOhUNTOa_3i5RhaG75oQop7T6CoQMJxn39S1XxyclZ7BACOn4MgqXrE';
                  }}
                  className={`w-full h-full object-cover transition-transform duration-300 ${
                    isZoomed ? 'scale-125' : 'scale-100'
                  }`}
                />

                {/* Left / Right Carousel Navigation Controls */}
                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrevPhoto}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-[#ffb230] hover:text-[#291800] text-white border border-white/20 backdrop-blur-md flex items-center justify-center transition-all z-20 shadow-md"
                      title="Previous detail image"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextPhoto}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-[#ffb230] hover:text-[#291800] text-white border border-white/20 backdrop-blur-md flex items-center justify-center transition-all z-20 shadow-md"
                      title="Next detail image"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* Zoom button */}
                <button
                  onClick={() => setIsZoomed(!isZoomed)}
                  className="absolute bottom-3 right-3 bg-[#1C1F29]/80 backdrop-blur-md text-[#e2e2ec] hover:text-[#ffb230] p-2 rounded-full border border-white/15 shadow-lg transition-all z-10"
                  title="Toggle Zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                {/* Photo counter badge */}
                {photos.length > 1 && (
                  <div className="absolute bottom-3 left-3 bg-[#0A0B0E]/85 backdrop-blur-md text-[#ffd7a1] px-2.5 py-1 rounded-full text-[11px] font-price font-bold border border-white/15 flex items-center gap-1 z-10 shadow">
                    <ImageIcon className="w-3 h-3 text-[#ffb230]" />
                    <span>{photoIndex + 1} / {photos.length}</span>
                  </div>
                )}

                {/* Badge overlay - Warranty strictly for accounts */}
                {isAccount && (
                  <div className="absolute top-3 left-3 bg-[#ffb230] text-[#291800] font-price text-xs font-black px-3 py-1 rounded-full shadow-lg flex items-center gap-1 z-10">
                    <span>🛡️</span>
                    <span>{warrantyDays}-Day Official Warranty</span>
                  </div>
                )}
                {!isAccount && isGift && (
                  <div className="absolute top-3 left-3 bg-[#E8433F] text-white font-price text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1 z-10">
                    <Gift className="w-3.5 h-3.5" />
                    <span>Gift (15-30 mins delivery)</span>
                  </div>
                )}
                {!isAccount && isTrade && (
                  <div className="absolute top-3 left-3 bg-[#1C1F29] border border-white/20 text-[#ffd7a1] font-price text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1 z-10">
                    <Users className="w-3.5 h-3.5 text-[#ffb230]" />
                    <span>In-Game Trade with Admin</span>
                  </div>
                )}
              </div>

              {/* Detail Image Thumbnails Strip */}
              {photos.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 scrollbar-none">
                  {photos.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setPhotoIndex(idx);
                        setIsZoomed(false);
                      }}
                      className={`relative w-14 h-12 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                        photoIndex === idx
                          ? 'border-[#ffb230] shadow-[0_0_10px_rgba(255,178,48,0.4)] scale-105'
                          : 'border-white/10 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                  {isAccount && onViewPhotos && (
                    <button
                      type="button"
                      onClick={() => onViewPhotos(product)}
                      className="shrink-0 px-2.5 py-1.5 rounded-xl bg-[#1C1F29] hover:bg-[#ffb230] text-[#ffd7a1] hover:text-[#291800] border border-white/10 text-[10px] font-price font-bold flex items-center gap-1 transition-all"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{lang === 'KM' ? 'ពង្រីកធំ' : 'Expand'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Title & Description */}
            <div className="flex flex-col gap-1 mt-1">
              <h2 className="font-headline text-2xl md:text-3xl text-[#e2e2ec] leading-tight uppercase tracking-wide">
                {product.title}
              </h2>
              <p className="font-khmer text-sm text-[#ffd7a1] leading-relaxed mt-1">
                {product.descriptionKhmer}
              </p>
              <p className="text-xs text-[#8B90A0] font-sans">
                {product.description}
              </p>
            </div>

            {/* Social Share & Deep Link Toolbar */}
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-[#1C1F29]/70 border border-white/10 mt-0.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShare}
                  className="px-3 py-1.5 rounded-xl bg-[#ffb230]/15 hover:bg-[#ffb230]/25 text-[#ffd7a1] hover:text-white border border-[#ffb230]/30 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#3ECF8E]" />
                      <span className="text-[#3ECF8E] font-bold">{lang === 'KM' ? 'បានចម្លងតំណ!' : 'Link Copied!'}</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5 text-[#ffb230]" />
                      <span className="font-khmer">{lang === 'KM' ? 'ចែករំលែក (Share)' : 'Share Product'}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Telegram Share Button */}
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(
                    `${product.title} - $${(product.price || 0).toFixed(2)} USD via Uchiro Store Cambodia`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-xl bg-[#229ED9]/15 hover:bg-[#229ED9]/25 text-[#229ED9] border border-[#229ED9]/30 text-xs font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                  title="Share to Telegram"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Telegram</span>
                </a>

                {/* Facebook Share Button */}
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-xl bg-[#1877F2]/15 hover:bg-[#1877F2]/25 text-[#1877F2] border border-[#1877F2]/30 text-xs font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                  title="Share to Facebook"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Facebook</span>
                </a>
              </div>
            </div>

            {/* Full Account Detail Specifications Grid (For Accounts) */}
            {isAccount && (
              <div className="bg-[#1C1F29]/90 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#ffb230]" />
                    <span className="font-headline text-xs font-bold text-[#ffd7a1] uppercase tracking-wider">
                      {lang === 'KM' ? 'ព័ត៌មានលម្អិតគណនី (ACCOUNT DETAILS)' : 'ACCOUNT SPECIFICATIONS'}
                    </span>
                  </div>
                  <span className="bg-[#3ECF8E]/20 text-[#3ECF8E] text-[10px] font-price font-bold px-2 py-0.5 rounded-full border border-[#3ECF8E]/30">
                    100% VERIFIED
                  </span>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs font-price">
                  <div className="bg-[#11131a] p-2.5 rounded-xl border border-white/5 space-y-0.5">
                    <span className="text-[10px] text-[#8B90A0] uppercase block">Level / Rank</span>
                    <span className="text-[#ffd7a1] font-bold text-sm">
                      {product.accountSpecs?.levelRank || 'Max Level (2550)'}
                    </span>
                  </div>
                  <div className="bg-[#11131a] p-2.5 rounded-xl border border-white/5 space-y-0.5">
                    <span className="text-[10px] text-[#8B90A0] uppercase block">Melee & Skills</span>
                    <span className="text-[#3ECF8E] font-bold text-sm">
                      {product.accountSpecs?.meleeSkills || 'Godhuman / V4 Gear'}
                    </span>
                  </div>
                  <div className="bg-[#11131a] p-2.5 rounded-xl border border-white/5 space-y-0.5">
                    <span className="text-[10px] text-[#8B90A0] uppercase block">Email Security</span>
                    <span className="text-[#3ECF8E] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{product.accountSpecs?.emailSecurity || 'Unlinked (Clean)'}</span>
                    </span>
                  </div>
                  <div className="bg-[#11131a] p-2.5 rounded-xl border border-white/5 space-y-0.5">
                    <span className="text-[10px] text-[#8B90A0] uppercase block">Phone / Pin</span>
                    <span className="text-[#3ECF8E] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{product.accountSpecs?.phonePin || 'No Pin / No Phone'}</span>
                    </span>
                  </div>
                </div>

                {/* Instant Delivery Feature Callout */}
                <div className="bg-[#11131a] p-2.5 rounded-xl border border-[#ffb230]/20 flex items-start gap-2.5">
                  <Key className="w-4 h-4 text-[#ffb230] shrink-0 mt-0.5" />
                  <div className="text-[11px] font-sans text-[#d1d5db] space-y-0.5">
                    <span className="font-bold text-white block">
                      {lang === 'KM' ? 'ផ្ញើស្វ័យប្រវត្តិ ២៤ ម៉ោង (Instant Delivery)' : 'Instant Automated 24/7 Delivery'}
                    </span>
                    <p className="text-[#8B90A0] text-[10px] font-khmer">
                      {product.autoDeliveryPayload?.instructionsKhmer ||
                        (lang === 'KM'
                          ? 'ទទួលបាន Username, Password និងកូដ Live 2FA ភ្លាមៗលើអេក្រង់បន្ទាប់ពីស្កេនទូទាត់រួច។'
                          : 'Credentials and live authenticator 2FA key are revealed immediately on screen upon payment.')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Delivery Specific Notice Box */}
            {isAccount && (
              <div className="flex flex-col gap-2.5">
                <div className="bg-[#1C1F29] border border-[#ffb230]/30 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-[#ffb230]/10 text-[#ffb230] shrink-0 mt-0.5">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 text-xs">
                    <h4 className="font-price font-bold text-[#ffd7a1] uppercase">
                      {lang === 'KM' ? `ធានាគណនី ${warrantyDays} ថ្ងៃ + ផ្ញើស្វ័យប្រវត្តិ` : `${warrantyDays}-Day Account Warranty + Instant Delivery`}
                    </h4>
                    <p className="font-khmer text-[#8B90A0] text-[11px] leading-relaxed">
                      {lang === 'KM'
                        ? 'ធានាសុវត្ថិភាព ១០០% លើការលុប ឬចាក់សោរក្នុងរយៈពេល ១៤ ថ្ងៃ។ អាចប្តូរលេខសម្ងាត់ និងចង Email ផ្ទាល់ខ្លួនបានភ្លាមៗ។'
                        : '100% store replacement guarantee within 14 days against lock or rollback. Free to link personal email immediately.'}
                    </p>
                  </div>
                </div>

                {/* Warranty & No-Refund Quick Button */}
                <button
                  type="button"
                  onClick={() => setShowRulesModal(true)}
                  className="bg-[#1C1F29] hover:bg-[#282a31] border border-white/10 rounded-2xl p-3 flex items-center justify-between transition-colors text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#ffb230]" />
                    <span className="font-khmer text-xs text-[#ffd7a1] font-bold">
                      {lang === 'KM' ? 'ច្បាប់ធានា ១៤ ថ្ងៃ & របៀប Login (ចុចមើល)' : '14-Day Warranty Rules & Login Guide (Click)'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8B90A0] group-hover:text-[#ffb230] transition-colors" />
                </button>
              </div>
            )}

            {isGift && (
              <div className="bg-[#1C1F29] border border-[#E8433F]/30 rounded-2xl p-3.5 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-[#E8433F]/10 text-[#E8433F] shrink-0 mt-0.5">
                  <Gift className="w-5 h-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <h4 className="font-price font-bold text-[#ffd7a1] uppercase">
                    {lang === 'KM' ? 'ផ្ញើកាដូ (Gift) • រង់ចាំ ១៥-៣០ នាទី' : 'Gift Delivery • 15-30 Minutes Wait'}
                  </h4>
                  <p className="font-khmer text-[#8B90A0] text-[11px] leading-relaxed">
                    {lang === 'KM'
                      ? 'សូមបញ្ចូល Roblox Username របស់អ្នកនៅពេលទូទាត់។ Admin នឹងផ្ញើ Gift ត្រង់ទៅគណនីរបស់អ្នកក្នុងរយៈពេល ១៥-៣០ នាទី។ មិនបង្វិលប្រាក់វិញ (No Refund)។'
                      : 'Enter your Roblox Username during checkout. Admin will send the gamepass/item directly within 15-30 mins. Strictly No Refund.'}
                  </p>
                </div>
              </div>
            )}

            {isTrade && (
              <div className="bg-[#1C1F29] border border-[#60a5fa]/30 rounded-2xl p-3.5 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-[#60a5fa]/10 text-[#60a5fa] shrink-0 mt-0.5">
                  <Users className="w-5 h-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <h4 className="font-price font-bold text-[#ffd7a1] uppercase">
                    {lang === 'KM' ? 'Trade ក្នុងហ្គេម • ទាក់ទង Admin Telegram' : 'In-Game Item Trade • Contact Admin'}
                  </h4>
                  <p className="font-khmer text-[#8B90A0] text-[11px] leading-relaxed">
                    {lang === 'KM'
                      ? 'បន្ទាប់ពីទូទាត់រួច សូមទាក់ទង Admin តាម Telegram (@Noreakyout) ដើម្បីចូល Private Server ធ្វើការ Trade ផ្លែឈើ ឬអាវុធ MM2/Blade Ball។ មិនបង្វិលប្រាក់ (No Refund)។'
                      : 'After payment, contact Admin on Telegram (@Noreakyout) with your Order ID to join private server for in-game trade. Strictly No Refund.'}
                  </p>
                </div>
              </div>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="bg-[#1C1F29] border border-white/10 text-[#d6c4ae] rounded-full px-3 py-1 text-xs font-price uppercase font-semibold">
                Category: {product.category}
              </span>
              {isSoldOut ? (
                <div className="bg-[#E8433F]/15 border border-[#E8433F]/40 rounded-full px-3 py-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#E8433F] animate-ping" />
                  <span className="font-price text-xs text-[#E8433F] font-bold">SOLD OUT (0 Stock)</span>
                </div>
              ) : isAccount ? (
                <div className="bg-[#ffb230]/15 border border-[#ffb230]/40 rounded-full px-3 py-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#ffb230]" />
                  <span className="font-price text-xs text-[#ffb230] font-bold">{warrantyDays}-day warranty</span>
                </div>
              ) : (
                <span className="bg-[#3ECF8E]/15 border border-[#3ECF8E]/40 text-[#3ECF8E] rounded-full px-3 py-1 text-xs font-price font-bold">
                  In Stock ({product.stock})
                </span>
              )}
            </div>

            {/* Pricing Row */}
            <div className="flex justify-between items-end mt-2 pt-4 border-t border-[#33343c]">
              <div className="flex flex-col">
                <span className="font-khmer text-xs text-[#8B90A0] font-medium">
                  {lang === 'KM' ? 'តម្លៃសរុប (USD)' : 'Total Price (USD)'}
                </span>
                <span className={`font-price text-3xl font-bold ${
                  isSoldOut ? 'text-[#8B90A0] line-through' : 'text-[#ffb94d] drop-shadow-[0_0_12px_rgba(255,178,48,0.4)]'
                }`}>
                  ${(product?.price ?? 0).toFixed(2)}
                </span>
                <span className="text-[11px] font-price text-[#8B90A0]">
                  ≈ {((product?.price ?? 0) * 4100).toLocaleString()} KHR
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-[#282a31] border border-white/10 rounded-full px-3 py-1.5">
                {isSoldOut ? (
                  <span className="font-price text-xs text-[#E8433F] font-medium">Closed / Sold Out</span>
                ) : isAccount ? (
                  <>
                    <Zap className="w-3.5 h-3.5 text-[#3ECF8E]" />
                    <span className="font-price text-xs text-[#3ECF8E] font-medium">Auto Delivery</span>
                  </>
                ) : isGift ? (
                  <>
                    <Gift className="w-3.5 h-3.5 text-[#ffb230]" />
                    <span className="font-price text-xs text-[#ffb230] font-medium">Gift Delivery (15-30m)</span>
                  </>
                ) : (
                  <>
                    <Users className="w-3.5 h-3.5 text-[#60a5fa]" />
                    <span className="font-price text-xs text-[#60a5fa] font-medium">Admin Trade</span>
                  </>
                )}
              </div>
            </div>

            {/* Action CTA Button */}
            {isSoldOut ? (
              <button
                disabled
                className="w-full bg-[#1e2029] border border-[#E8433F]/30 text-[#8B90A0] font-headline text-lg py-4 rounded-xl mt-2 flex items-center justify-center gap-2 uppercase tracking-wider cursor-not-allowed"
              >
                <span className="font-khmer font-bold text-[#E8433F]">
                  {isFruit
                    ? lang === 'KM' ? 'ដាច់ស្តុក (NO STOCK)' : 'OUT OF STOCK • NO STOCK'
                    : lang === 'KM' ? 'ទំនិញនេះលក់អស់ហើយ (SOLD OUT)' : 'ITEM SOLD OUT • OUT OF STOCK'}
                </span>
              </button>
            ) : !isLoggedIn ? (
              <button
                type="button"
                onClick={() => {
                  onProceedToCheckout(product);
                }}
                className="w-full bg-gradient-to-r from-[#ffb230] to-[#ff9e00] hover:from-[#ffbe4d] hover:to-[#ffb230] text-[#291800] font-headline text-lg sm:text-xl py-4 rounded-xl shadow-[0_0_20px_rgba(255,178,48,0.35)] mt-2 flex items-center justify-center gap-2 uppercase tracking-wider active:scale-[0.99] transition-all cursor-pointer"
              >
                <Lock className="w-5 h-5 text-[#291800]" />
                <span className="font-khmer font-bold">
                  {lang === 'KM' ? `ចូលគណនីដើម្បីទិញ — $${(product?.price ?? 0).toFixed(2)}` : `SIGN IN TO BUY — $${(product?.price ?? 0).toFixed(2)}`}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onProceedToCheckout(product);
                }}
                className="w-full bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] font-headline text-xl py-4 rounded-xl chunky-btn-gold mt-2 flex items-center justify-center gap-2 uppercase tracking-wider active:scale-[0.99] transition-all cursor-pointer"
              >
                <ShoppingCart className="w-5 h-5" />
                <span className="font-khmer font-bold">
                  {lang === 'KM' ? `ទិញឥឡូវ — $${(product?.price ?? 0).toFixed(2)}` : `BUY NOW — $${(product?.price ?? 0).toFixed(2)}`}
                </span>
              </button>
            )}

            <p className="text-center font-price text-xs text-[#8B90A0] mt-1 flex items-center justify-center gap-1.5">
              {!isLoggedIn ? (
                <span className="text-[#ffd7a1] font-semibold">
                  {lang === 'KM' ? '🔒 តម្រូវឱ្យមានគណនីមុនពេលទិញ (Sign In Required)' : '🔒 Sign in or create an account to purchase'}
                </span>
              ) : (
                <span>🔒 100% Verified KHQR Instant Settlement</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Rules Modal */}
      <AccountLoginRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        lang={lang}
        initialTab="rules"
      />
    </>
  );
};
