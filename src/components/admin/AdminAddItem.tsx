import React, { useState } from 'react';
import { Product, CategoryType, FulfillmentType } from '../../types';
import { ArrowLeft, Image as ImageIcon, Zap, Shield, Sparkles, Check, Upload, Gift, Users } from 'lucide-react';

interface AdminAddItemProps {
  onAddProduct: (product: Product) => void;
  onBack: () => void;
  lang: 'KM' | 'EN';
}

const SAMPLE_IMAGES = [
  { name: 'Max Account', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAJbPmK_4tXbPo7csvq5Th9P3jTxJ0832ZJXjTEiILWmnuAzoW1cThcH0p1D2Er4LY0IgbfX0j5zzK5XO26Ej73VWHE9q3JXLYadZTOJdYu9tOtAX3vKWuuA1SA8xJA_w9FyaBAERQu816-BlDrGtKKhocghmuzg37LdL7w50CkOyb9f468g3emhq45yCP_vgOhUNTOa_3i5RhaG75oQop7T6CoQMJxn39S1XxyclZ7BACOn4MgqXrE' },
  { name: 'Leopard Fruit', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbbccVkFoYTRBy07fHGrIaMagjGi5El0SyPjKrpPYeLc5at8W5WiPLmn6rQQdWtFS0LV-h4Wm_pmxKwM7kdiLLcXbtBvF6VJ_DXOvcLU9gwalqShkQMrwqW9Cb_H-VeUe5q9Dm8tfolOSzlslR3PSVu00L4fZwQsknLVYeiReneN8M2PvRfThFI_5aThXM7yfCw9miqJQ7dDbAqegvv7gvzMxv9v-WaeNohociSiaWpgwcvBqN19eK' },
  { name: 'Kitsune', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuALQbCc50G6KLs92tN0eELonrjHJe-8u9EWsQqEFRatRZt7TkO-e0PvcOaTFQelO1uzme9TRCMCHWBDZlmiVtN-fZRijhhKA5PJ-BN1-Xi2HQIlzD5s7AU_tE7dn4vZqd_m9YhDvt7WU3vSdKferzlCo2crER8gHVSNillopH9LxGW74r3Amn1LcJ6gWeBoJC-vhasU5J7d-B9MoEUs0We5i5FQdWnSiQuQ92PMWG3iH-Jh9Q6QHcwm' },
  { name: 'Radiant Sunblade', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBxR1n1Wzmx22p9_PgV5QnvmwUrPlHrCuvdg6qkuwIrCj3esoKTVfwL-Lt97LsNv7R3fnS1qkikwCoLXEE8pMTRwqpJC2fI_5yES_ARfMhcU1PDR37T0huBBUbZ7-KDh5UnoSrfOLtgAsPYJNIidM3zDFfVCED-KYF5LTr9CvC0R8qYSbaYAvIt-uUyGblsgPkH50OLzrPhJPra60L-zGR-nKfq1yhOiaemEDOHv06oma5xQCJZbTjX' },
];

export const AdminAddItem: React.FC<AdminAddItemProps> = ({
  onAddProduct,
  onBack,
  lang,
}) => {
  const [title, setTitle] = useState('');
  const [titleKhmer, setTitleKhmer] = useState('');
  const [category, setCategory] = useState<CategoryType>('account');
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('account');
  const [priceUSD, setPriceUSD] = useState('15.00');
  const [stock, setStock] = useState('1');
  const [warrantyDays, setWarrantyDays] = useState(14);
  const [imageUrl, setImageUrl] = useState(SAMPLE_IMAGES[0].url);
  const [badge, setBadge] = useState<'14D' | 'NEW' | 'LEGENDARY' | null>('14D');
  const [isShimmer, setIsShimmer] = useState(true);
  const [description, setDescription] = useState('High-level account with full access.');
  const [descriptionKhmer, setDescriptionKhmer] = useState('គណនីមានធានា ១៤ ថ្ងៃ សុវត្ថិភាព ១០០%');
  const [username, setUsername] = useState('NewPlayer_VIP');
  const [password, setPassword] = useState('Secret#Pass2026');
  const [authKey, setAuthKey] = useState('JBSWY3DPEHPK3PXP');
  const [tradeInstructions, setTradeInstructions] = useState('ទាក់ទង Admin Telegram @Noreakyout ដើម្បី Trade ក្នុងហ្គេម');
  
  // Store Account Specifications
  const [levelRank, setLevelRank] = useState('Max Level (2550)');
  const [meleeSkills, setMeleeSkills] = useState('Godhuman / V4 Gear');
  const [emailSecurity, setEmailSecurity] = useState('Unlinked (Clean)');
  const [phonePin, setPhonePin] = useState('No Pin / No Phone');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');

  const handleGalleryFileUpload = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      if (!base64) return;
      setGalleryImages((prev) => {
        const next = [...prev];
        next[index] = base64;
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64 = uploadEvent.target?.result as string;
        if (base64) {
          setImageUrl(base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCategoryChange = (newCat: CategoryType) => {
    setCategory(newCat);
    if (newCat === 'account') {
      setFulfillmentType('account');
      setBadge('14D');
    } else if (newCat === 'gamepass') {
      setFulfillmentType('gift');
      setBadge('NEW');
    } else {
      setFulfillmentType('trade');
      setBadge('LEGENDARY');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      title: title.trim(),
      titleKhmer: titleKhmer.trim() || title.trim(),
      category: category,
      fulfillmentType: fulfillmentType,
      warrantyDays: fulfillmentType === 'account' ? warrantyDays : undefined,
      price: parseFloat(priceUSD) || 10.0,
      stock: fulfillmentType === 'account' ? 1 : (parseInt(stock, 10) || 1),
      image: imageUrl || SAMPLE_IMAGES[0].url,
      badge: fulfillmentType === 'account' ? `${warrantyDays}D` as any : badge,
      isShimmer: isShimmer,
      description: description,
      descriptionKhmer: descriptionKhmer,
      deliveryType: fulfillmentType === 'account' ? 'automatic' : 'manual',
      autoDeliveryPayload: fulfillmentType === 'account' ? {
        username: username,
        password: password,
        authenticatorKey: authKey,
        instructionsKhmer: 'សូមផ្លាស់ប្តូរលេខសម្ងាត់បន្ទាប់ពីទទួលបាន។',
      } : undefined,
      accountSpecs: fulfillmentType === 'account' ? {
        levelRank,
        meleeSkills,
        emailSecurity,
        phonePin,
      } : undefined,
      galleryImages: galleryImages.filter(Boolean),
      videoUrl: videoUrl.trim() || undefined,
      tradeInstructions: fulfillmentType === 'trade' ? tradeInstructions : undefined,
      isFeatured: isShimmer,
      isDraft: false,
      createdAt: new Date().toISOString(),
    };

    onAddProduct(newProduct);
  };

  return (
    <div className="min-h-screen pb-28 pt-20 px-4 md:px-8 max-w-2xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-[#1C1F29] border border-white/10 text-[#ffd7a1] hover:text-[#ffb230] flex items-center justify-center transition-all active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-headline text-2xl md:text-3xl text-[#ffd7a1] uppercase tracking-wider text-center flex-1 pr-10">
          + ADD PRODUCT
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Fulfillment Type Selector Tabs */}
        <section className="bg-[#1C1F29] rounded-2xl p-5 border border-white/10 space-y-3">
          <label className="font-price text-xs text-[#8B90A0] uppercase font-bold block">
            Fulfillment & Delivery Type *
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setFulfillmentType('account');
                setCategory('account');
              }}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-price font-bold ${
                fulfillmentType === 'account'
                  ? 'bg-[#ffb230]/20 border-[#ffb230] text-[#ffb230]'
                  : 'bg-[#11131a] border-white/10 text-[#8B90A0] hover:text-white'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span>Account (Auto)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFulfillmentType('gift');
                setCategory('gamepass');
              }}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-price font-bold ${
                fulfillmentType === 'gift'
                  ? 'bg-[#E8433F]/20 border-[#E8433F] text-[#ff8e8b]'
                  : 'bg-[#11131a] border-white/10 text-[#8B90A0] hover:text-white'
              }`}
            >
              <Gift className="w-5 h-5" />
              <span>Gift (15-30m)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFulfillmentType('trade');
                setCategory('fruit');
              }}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-price font-bold ${
                fulfillmentType === 'trade'
                  ? 'bg-[#60a5fa]/20 border-[#60a5fa] text-[#93c5fd]'
                  : 'bg-[#11131a] border-white/10 text-[#8B90A0] hover:text-white'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>In-Game Trade</span>
            </button>
          </div>
        </section>

        {/* Image Upload & Preview */}
        <section className="bg-[#1C1F29] rounded-2xl p-5 border border-white/10 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <label className="font-price text-xs text-[#8B90A0] uppercase font-bold">
              Product Image / Media *
            </label>
            <label className="cursor-pointer bg-[#ffb230]/10 hover:bg-[#ffb230]/20 text-[#ffb230] border border-[#ffb230]/30 px-3 py-1.5 rounded-lg text-xs font-price font-bold flex items-center gap-1.5 transition-all">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Image File</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-xl overflow-hidden bg-[#11131a] border-2 border-[#ffb230] shrink-0 relative">
              <img
                src={imageUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              {badge && (
                <div className="absolute top-0 left-0 bg-[#ffb230] text-[#291800] text-[9px] font-bold px-1.5 py-0.5 rounded-br-md">
                  {badge}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Or paste direct image URL..."
                className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3 py-2 text-xs font-price focus:border-[#ffb230] outline-none"
              />
              <div className="flex gap-1.5 flex-wrap">
                {SAMPLE_IMAGES.map((img) => (
                  <button
                    key={img.name}
                    type="button"
                    onClick={() => setImageUrl(img.url)}
                    className="text-[10px] font-price bg-[#282a31] hover:bg-[#ffb230] text-[#ffd7a1] hover:text-[#291800] px-2 py-1 rounded-md border border-white/10 transition-colors"
                  >
                    {img.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Additional Gallery Images (up to 2 more, 3 total with cover) + Video */}
        <section className="bg-[#1C1F29] rounded-2xl p-5 border border-white/10 flex flex-col gap-4">
          <label className="font-price text-xs text-[#8B90A0] uppercase font-bold">
            Extra Photos (optional, up to 2) &amp; Video
          </label>

          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((slot) => (
              <div key={slot} className="flex flex-col gap-2">
                <div className="w-full aspect-video rounded-xl overflow-hidden bg-[#11131a] border border-white/10 flex items-center justify-center">
                  {galleryImages[slot] ? (
                    <img src={galleryImages[slot]} alt={`Extra ${slot + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-[#4a4d59]" />
                  )}
                </div>
                <label className="cursor-pointer text-center bg-[#282a31] hover:bg-[#ffb230]/20 text-[#ffd7a1] border border-white/10 px-2 py-1.5 rounded-lg text-[10px] font-price font-bold transition-all">
                  Photo {slot + 2}
                  <input type="file" accept="image/*" onChange={handleGalleryFileUpload(slot)} className="hidden" />
                </label>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-white/5">
            <label className="font-price text-xs text-[#8B90A0] uppercase font-bold block mb-2">
              Video Link (optional)
            </label>
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="YouTube or direct .mp4 link..."
              className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3 py-2 text-xs font-price focus:border-[#ffb230] outline-none"
            />
            <p className="mt-1.5 text-[10px] text-[#6b6f7d] leading-relaxed">
              Paste a link (YouTube, or a direct video file URL) — don't upload the raw video file here, it's too large to store directly.
            </p>
          </div>
        </section>

        {/* Basic Details */}
        <section className="bg-[#1C1F29] rounded-2xl p-5 border border-white/10 space-y-4">
          <div>
            <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
              Title (English) *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Blox Fruits Max Account or Kitsune Physical Fruit"
              className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-sans focus:border-[#ffb230] outline-none"
            />
          </div>

          <div>
            <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
              Title (Khmer)
            </label>
            <input
              type="text"
              value={titleKhmer}
              onChange={(e) => setTitleKhmer(e.target.value)}
              placeholder="e.g. គណនី Blox Fruits Max + God Human"
              className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-khmer focus:border-[#ffb230] outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as CategoryType)}
                className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3 py-2.5 text-xs font-price focus:border-[#ffb230] outline-none"
              >
                <option value="account">👑 Accounts (គណនី)</option>
                <option value="fruit">🍇 Blox Fruits (ផ្លែឈើ)</option>
                <option value="gamepass">🎟️ Gamepass (ហ្គេមផាស)</option>
                <option value="evade">🏃‍♂️ Evade (រត់គេច)</option>
                <option value="mm2">🗡️ MM2 (Murder Mystery)</option>
                <option value="blade-ball">⚔️ Blade Ball (បាល់ដាវ)</option>
                <option value="steal-egg">🥚 Steal an Egg (លួចស៊ុត)</option>
              </select>
            </div>

            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                Price (USD) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={priceUSD}
                onChange={(e) => setPriceUSD(e.target.value)}
                className="w-full bg-[#11131a] text-[#ffd7a1] font-bold border border-white/10 rounded-xl px-3 py-2.5 text-sm font-price focus:border-[#ffb230] outline-none"
              />
            </div>

            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                {fulfillmentType === 'account' ? 'Warranty (Days)' : 'Stock Count *'}
              </label>
              {fulfillmentType === 'account' ? (
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={warrantyDays}
                  onChange={(e) => setWarrantyDays(parseInt(e.target.value, 10) || 14)}
                  className="w-full bg-[#11131a] text-[#ffb230] font-bold border border-white/10 rounded-xl px-3 py-2.5 text-sm font-price focus:border-[#ffb230] outline-none"
                />
              ) : (
                <input
                  type="number"
                  min="1"
                  required
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3 py-2.5 text-sm font-price focus:border-[#ffb230] outline-none"
                />
              )}
            </div>
          </div>
        </section>

        {/* Conditional Fulfillment Payload */}
        {fulfillmentType === 'account' && (
          <section className="bg-[#1C1F29] rounded-2xl p-5 border border-[#ffb230]/30 space-y-4">
            <div className="flex items-center gap-2 text-[#3ECF8E]">
              <Zap className="w-5 h-5" />
              <h3 className="font-headline text-base uppercase">
                Account Auto-Delivery Credentials
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                  Roblox Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3 py-2 text-xs font-price"
                />
              </div>

              <div>
                <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                  Roblox Password
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3 py-2 text-xs font-price"
                />
              </div>
            </div>

            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                Authenticator Key (2FA Live Seed)
              </label>
              <input
                type="text"
                value={authKey}
                onChange={(e) => setAuthKey(e.target.value)}
                className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3 py-2 text-xs font-price"
              />
            </div>

            {/* In-Store Account Specifications (Level, Skills, Security, Phone) */}
            <div className="pt-3 border-t border-white/10 space-y-3">
              <span className="font-headline text-xs text-[#ffd7a1] uppercase block">
                In-Store Account Specifications (Displayed in Store Modal)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-[#8B90A0] block">Level / Rank</label>
                  <input
                    type="text"
                    value={levelRank}
                    onChange={(e) => setLevelRank(e.target.value)}
                    placeholder="Max Level (2550)"
                    className="w-full bg-[#11131a] text-[#ffd7a1] font-bold border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-price"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8B90A0] block">Melee & Skills</label>
                  <input
                    type="text"
                    value={meleeSkills}
                    onChange={(e) => setMeleeSkills(e.target.value)}
                    placeholder="Godhuman / V4 Gear"
                    className="w-full bg-[#11131a] text-[#3ECF8E] font-bold border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-price"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8B90A0] block">Email Security</label>
                  <input
                    type="text"
                    value={emailSecurity}
                    onChange={(e) => setEmailSecurity(e.target.value)}
                    placeholder="Unlinked (Clean)"
                    className="w-full bg-[#11131a] text-[#3ECF8E] font-bold border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-price"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#8B90A0] block">Phone / PIN</label>
                  <input
                    type="text"
                    value={phonePin}
                    onChange={(e) => setPhonePin(e.target.value)}
                    placeholder="No Pin / No Phone"
                    className="w-full bg-[#11131a] text-[#3ECF8E] font-bold border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-price"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {fulfillmentType === 'trade' && (
          <section className="bg-[#1C1F29] rounded-2xl p-5 border border-[#60a5fa]/30 space-y-3">
            <div className="flex items-center gap-2 text-[#60a5fa]">
              <Users className="w-5 h-5" />
              <h3 className="font-headline text-base uppercase">
                In-Game Trade Instructions
              </h3>
            </div>
            <textarea
              rows={2}
              value={tradeInstructions}
              onChange={(e) => setTradeInstructions(e.target.value)}
              className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl p-3 text-xs font-khmer outline-none focus:border-[#60a5fa]"
            />
          </section>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] font-headline text-lg py-3.5 rounded-xl uppercase font-bold chunky-btn-gold transition-all shadow-xl"
        >
          {lang === 'KM' ? 'បោះពុម្ពផ្សាយមុខទំនិញ' : 'PUBLISH PRODUCT TO STORE'}
        </button>
      </form>
    </div>
  );
};
