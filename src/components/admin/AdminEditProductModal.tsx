import React, { useState } from 'react';
import { Product, CategoryType, FulfillmentType } from '../../types';
import {
  X,
  Save,
  Image as ImageIcon,
  Shield,
  Sparkles,
  Check,
  Upload,
  Plus,
  Trash2,
  Eye,
  Key,
  Gamepad2,
  Gift,
  Users,
  CheckCircle2,
  Flame,
  Clock,
  Layers,
  ExternalLink,
} from 'lucide-react';

interface AdminEditProductModalProps {
  product: Product;
  onSave: (id: string, updates: Partial<Product>) => void;
  onClose: () => void;
  lang: 'KM' | 'EN';
}

type TabType = 'details' | 'media' | 'specs' | 'preview';

export const AdminEditProductModal: React.FC<AdminEditProductModalProps> = ({
  product,
  onSave,
  onClose,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('details');

  // Basic Information
  const [title, setTitle] = useState(product.title || '');
  const [titleKhmer, setTitleKhmer] = useState(product.titleKhmer || '');
  const [category, setCategory] = useState<CategoryType>(product.category || 'account');
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>(product.fulfillmentType || 'account');
  const [priceUSD, setPriceUSD] = useState((product.price ?? 0).toString());
  const [stock, setStock] = useState((product.stock ?? 0).toString());
  const [badge, setBadge] = useState<'14D' | '7D' | '30D' | 'NEW' | 'LEGENDARY' | null>(product.badge || null);
  const [warrantyDays, setWarrantyDays] = useState(product.warrantyDays || 14);
  const [isShimmer, setIsShimmer] = useState(product.isShimmer ?? true);
  const [isFeatured, setIsFeatured] = useState(product.isFeatured ?? false);
  const [isDraft, setIsDraft] = useState(product.isDraft ?? false);
  const [isSold, setIsSold] = useState(product.isSold ?? (product.stock <= 0));

  // Descriptions
  const [description, setDescription] = useState(product.description || '');
  const [descriptionKhmer, setDescriptionKhmer] = useState(product.descriptionKhmer || '');
  const [tradeInstructions, setTradeInstructions] = useState(product.tradeInstructions || '');

  // Media & Gallery (Like in Store)
  const [imageUrl, setImageUrl] = useState(product.image || '');
  const [galleryImages, setGalleryImages] = useState<string[]>(product.galleryImages || []);
  const [newGalleryUrl, setNewGalleryUrl] = useState('');

  // Account Specifications (Like in Store)
  const [levelRank, setLevelRank] = useState(product.accountSpecs?.levelRank || 'Max Level (2550)');
  const [meleeSkills, setMeleeSkills] = useState(product.accountSpecs?.meleeSkills || 'Godhuman / V4 Gear');
  const [emailSecurity, setEmailSecurity] = useState(product.accountSpecs?.emailSecurity || 'Unlinked (Clean)');
  const [phonePin, setPhonePin] = useState(product.accountSpecs?.phonePin || 'No Pin / No Phone');

  // Auto Delivery Credentials
  const [username, setUsername] = useState(product.autoDeliveryPayload?.username || '');
  const [password, setPassword] = useState(product.autoDeliveryPayload?.password || '');
  const [authenticatorKey, setAuthenticatorKey] = useState(product.autoDeliveryPayload?.authenticatorKey || '');
  const [instructionsKhmer, setInstructionsKhmer] = useState(
    product.autoDeliveryPayload?.instructionsKhmer || 'សូមផ្លាស់ប្តូរលេខសម្ងាត់បន្ទាប់ពីទទួលបាន។'
  );

  // Local Save Status
  const [isSaved, setIsSaved] = useState(false);

  const handleMainImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64 = uploadEvent.target?.result as string;
        if (base64) setImageUrl(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64 = uploadEvent.target?.result as string;
        if (base64) {
          setGalleryImages((prev) => [...prev, base64]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddGalleryUrl = () => {
    if (newGalleryUrl.trim()) {
      setGalleryImages((prev) => [...prev, newGalleryUrl.trim()]);
      setNewGalleryUrl('');
    }
  };

  const handleRemoveGalleryImage = (index: number) => {
    setGalleryImages((prev) => prev.filter((_, idx) => idx !== index));
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

  const handleSave = () => {
    const numPrice = parseFloat(priceUSD) || 0;
    const numStock = parseInt(stock, 10) || 0;

    const updates: Partial<Product> = {
      title: title.trim() || product.title,
      titleKhmer: titleKhmer.trim() || title.trim() || product.titleKhmer,
      category,
      fulfillmentType,
      price: numPrice,
      priceUSD: numPrice,
      stock: numStock,
      isSold: isSold || numStock <= 0,
      badge,
      warrantyDays: fulfillmentType === 'account' ? warrantyDays : undefined,
      isShimmer,
      isFeatured,
      isDraft,
      description,
      descriptionKhmer,
      image: imageUrl || product.image,
      galleryImages: galleryImages.filter((img) => Boolean(img)),
      accountSpecs: {
        levelRank,
        meleeSkills,
        emailSecurity,
        phonePin,
      },
      autoDeliveryPayload:
        fulfillmentType === 'account'
          ? {
              username: username.trim(),
              password: password.trim(),
              authenticatorKey: authenticatorKey.trim(),
              instructionsKhmer: instructionsKhmer.trim(),
            }
          : undefined,
      tradeInstructions: fulfillmentType === 'trade' ? tradeInstructions : undefined,
    };

    onSave(product.id, updates);
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const isAccount = fulfillmentType === 'account' || category === 'account';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div
        className="relative w-full max-w-4xl bg-[#14161D] border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#1C1F29] border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#ffb230]/15 border border-[#ffb230]/30 flex items-center justify-center text-[#ffb230]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline text-lg sm:text-xl text-[#ffd7a1] uppercase tracking-wide">
                  {lang === 'KM' ? 'កែសម្រួលព័ត៌មានលម្អិតទំនិញ' : 'EDIT PRODUCT SPECIFICATIONS'}
                </h2>
                <span className="text-[10px] font-mono bg-white/10 text-[#8B90A0] px-2 py-0.5 rounded-full">
                  #{product.id}
                </span>
              </div>
              <p className="text-xs text-[#8B90A0] font-sans truncate max-w-md">
                {product.title} &bull; ${product.price?.toFixed(2)} USD
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-[#8B90A0] hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-[#171922] border-b border-white/10 overflow-x-auto scrollbar-none shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`px-3.5 py-1.5 rounded-xl font-headline text-xs uppercase font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'details'
                ? 'bg-[#ffb230] text-[#291800] shadow'
                : 'text-[#8B90A0] hover:text-white hover:bg-white/5'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>{lang === 'KM' ? 'ព័ត៌មានទូទៅ & តម្លៃ' : '1. Details & Price'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('media')}
            className={`px-3.5 py-1.5 rounded-xl font-headline text-xs uppercase font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'media'
                ? 'bg-[#ffb230] text-[#291800] shadow'
                : 'text-[#8B90A0] hover:text-white hover:bg-white/5'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>
              {lang === 'KM' ? 'រូបភាព & Gallery' : '2. Media & Gallery'}
              {galleryImages.length > 0 && ` (${galleryImages.length + 1})`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('specs')}
            className={`px-3.5 py-1.5 rounded-xl font-headline text-xs uppercase font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'specs'
                ? 'bg-[#ffb230] text-[#291800] shadow'
                : 'text-[#8B90A0] hover:text-white hover:bg-white/5'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{lang === 'KM' ? 'លក្ខណៈគណនី (Store Specs)' : '3. Account Specs (In-Store)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3.5 py-1.5 rounded-xl font-headline text-xs uppercase font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ml-auto ${
              activeTab === 'preview'
                ? 'bg-[#00F0FF] text-[#00222a] shadow'
                : 'text-[#00F0FF] hover:bg-[#00F0FF]/10'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{lang === 'KM' ? 'មើលគំរូក្នុង Store' : '👁️ Live Store Preview'}</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: BASIC DETAILS & PRICING */}
          {activeTab === 'details' && (
            <div className="space-y-5 animate-fade-in">
              {/* Product Titles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-headline text-[#ffd7a1] uppercase">
                    Product Title (English) *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. ROBLOX MAX LEVEL ACCOUNT"
                    className="w-full bg-[#1C1F29] text-white border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-sans focus:border-[#ffb230] outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-headline text-[#ffd7a1] uppercase">
                    Product Title (Khmer)
                  </label>
                  <input
                    type="text"
                    value={titleKhmer}
                    onChange={(e) => setTitleKhmer(e.target.value)}
                    placeholder="e.g. គណនីកម្រិតអតិបរមា BLOX FRUITS"
                    className="w-full bg-[#1C1F29] text-white border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-khmer focus:border-[#ffb230] outline-none"
                  />
                </div>
              </div>

              {/* Category & Fulfillment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-headline text-[#ffd7a1] uppercase">Category</label>
                  <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value as CategoryType)}
                    className="w-full bg-[#1C1F29] text-white border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-sans focus:border-[#ffb230] outline-none"
                  >
                    <option value="account">👑 Account (Full Access + Live 2FA)</option>
                    <option value="fruit">🍇 Fruit (Blox Fruits In-game)</option>
                    <option value="gamepass">🎟️ Gamepass (Permanent Fruit / VIP)</option>
                    <option value="evade">🏃‍♂️ Evade Items</option>
                    <option value="mm2">🗡️ Murder Mystery 2</option>
                    <option value="blade-ball">⚔️ Blade Ball Swords</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-headline text-[#ffd7a1] uppercase">Fulfillment Method</label>
                  <select
                    value={fulfillmentType}
                    onChange={(e) => setFulfillmentType(e.target.value as FulfillmentType)}
                    className="w-full bg-[#1C1F29] text-white border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-sans focus:border-[#ffb230] outline-none"
                  >
                    <option value="account">👑 Account: Instant Auto Delivery + 14D Warranty</option>
                    <option value="gift">🎁 Gift: Send to Roblox Username (15-30m)</option>
                    <option value="trade">👥 Trade: In-Game Trade / Admin Server Contact</option>
                  </select>
                </div>
              </div>

              {/* Price, Stock & Warranty */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-headline text-[#ffd7a1] uppercase">Price (USD $)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B90A0] text-xs font-price font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={priceUSD}
                      onChange={(e) => setPriceUSD(e.target.value)}
                      className="w-full bg-[#1C1F29] text-[#ffd7a1] font-bold border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-xs font-price focus:border-[#ffb230] outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-headline text-[#ffd7a1] uppercase">Stock Available</label>
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full bg-[#1C1F29] text-white border border-white/10 rounded-xl px-3 py-2.5 text-xs font-price focus:border-[#ffb230] outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-headline text-[#ffd7a1] uppercase">Warranty Badge</label>
                  <select
                    value={badge || ''}
                    onChange={(e) => setBadge((e.target.value || null) as any)}
                    className="w-full bg-[#1C1F29] text-white border border-white/10 rounded-xl px-2.5 py-2.5 text-xs font-sans focus:border-[#ffb230] outline-none"
                  >
                    <option value="14D">14-Day Warranty</option>
                    <option value="7D">7-Day Warranty</option>
                    <option value="30D">30-Day Warranty</option>
                    <option value="NEW">NEW Release</option>
                    <option value="LEGENDARY">LEGENDARY</option>
                    <option value="">No Badge</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-headline text-[#ffd7a1] uppercase">Warranty Days</label>
                  <input
                    type="number"
                    value={warrantyDays}
                    onChange={(e) => setWarrantyDays(parseInt(e.target.value, 10) || 14)}
                    className="w-full bg-[#1C1F29] text-white border border-white/10 rounded-xl px-3 py-2.5 text-xs font-price focus:border-[#ffb230] outline-none"
                  />
                </div>
              </div>

              {/* Status Toggles */}
              <div className="bg-[#1C1F29] p-4 rounded-2xl border border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!isSold && parseInt(stock, 10) > 0}
                    onChange={(e) => {
                      setIsSold(!e.target.checked);
                      if (e.target.checked && parseInt(stock, 10) <= 0) setStock('1');
                    }}
                    className="w-4 h-4 rounded text-[#ffb230] focus:ring-0 accent-[#ffb230]"
                  />
                  <span className="text-xs text-[#e2e2ec] font-bold">In Stock (Active)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDraft}
                    onChange={(e) => setIsDraft(e.target.checked)}
                    className="w-4 h-4 rounded text-[#ffb230] focus:ring-0 accent-[#ffb230]"
                  />
                  <span className="text-xs text-[#ffd7a1]">Draft Only</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="w-4 h-4 rounded text-[#ffb230] focus:ring-0 accent-[#ffb230]"
                  />
                  <span className="text-xs text-[#ffd7a1]">Featured Badge</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isShimmer}
                    onChange={(e) => setIsShimmer(e.target.checked)}
                    className="w-4 h-4 rounded text-[#ffb230] focus:ring-0 accent-[#ffb230]"
                  />
                  <span className="text-xs text-[#ffd7a1]">Gold Glow Aura</span>
                </label>
              </div>

              {/* Descriptions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-headline text-[#ffd7a1] uppercase">
                    Description (Khmer - Shown in Store Modal)
                  </label>
                  <textarea
                    rows={3}
                    value={descriptionKhmer}
                    onChange={(e) => setDescriptionKhmer(e.target.value)}
                    placeholder="គណនីកម្រិតអតិបរមា មានផ្លែឈើភ្ញាក់ពេញលេញ..."
                    className="w-full bg-[#1C1F29] text-white border border-white/10 rounded-xl p-3 text-xs font-khmer focus:border-[#ffb230] outline-none leading-relaxed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-headline text-[#ffd7a1] uppercase">
                    Description (English)
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Max level account with full access, godhuman melee..."
                    className="w-full bg-[#1C1F29] text-white border border-white/10 rounded-xl p-3 text-xs font-sans focus:border-[#ffb230] outline-none leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MEDIA & GALLERY (LIKE IN STORE) */}
          {activeTab === 'media' && (
            <div className="space-y-5 animate-fade-in">
              {/* Main Cover Image */}
              <div className="bg-[#1C1F29] p-4 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-headline text-[#ffd7a1] uppercase font-bold flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-[#ffb230]" />
                    Main Cover Image (Display Thumbnail)
                  </span>
                  <label className="px-3 py-1 bg-[#ffb230]/20 hover:bg-[#ffb230]/30 text-[#ffb230] border border-[#ffb230]/40 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                    <input type="file" accept="image/*" onChange={handleMainImageUpload} className="hidden" />
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-white/20 shrink-0 bg-[#11131a]">
                    {imageUrl ? (
                      <img src={imageUrl} alt="Main Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#8B90A0] text-xs">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    <label className="text-[11px] text-[#8B90A0] block">Image URL / Link</label>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://... or upload above"
                      className="w-full bg-[#11131a] text-white border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono focus:border-[#ffb230] outline-none"
                    />
                    <p className="text-[10px] text-[#8B90A0]">
                      This is the primary showcase photo shown on the main marketplace card and the modal header.
                    </p>
                  </div>
                </div>
              </div>

              {/* Multi-Image Gallery Strip (Matches Store 1/3 Gallery) */}
              <div className="bg-[#1C1F29] p-4 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-headline text-[#ffd7a1] uppercase font-bold flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#00F0FF]" />
                      Store Screenshot Gallery ({galleryImages.length} Additional Photos)
                    </span>
                    <p className="text-[11px] text-[#8B90A0] mt-0.5">
                      Screenshots appear in the interactive thumbnail carousel in the store (e.g. 1/3, 2/3).
                    </p>
                  </div>

                  <label className="px-3 py-1 bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 text-[#00F0FF] border border-[#00F0FF]/30 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Screenshot</span>
                    <input type="file" accept="image/*" onChange={handleGalleryUpload} className="hidden" />
                  </label>
                </div>

                {/* Gallery URL Add Bar */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newGalleryUrl}
                    onChange={(e) => setNewGalleryUrl(e.target.value)}
                    placeholder="Enter image URL to add to gallery (e.g. inventory screenshot)..."
                    className="flex-1 bg-[#11131a] text-white border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono focus:border-[#ffb230] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddGalleryUrl}
                    disabled={!newGalleryUrl.trim()}
                    className="px-4 py-2 rounded-xl bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] font-headline text-xs uppercase font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add URL</span>
                  </button>
                </div>

                {/* Thumbnails Strip */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-price text-[#8B90A0] block">
                    Current Carousel Gallery Strip (Main + Additional):
                  </span>
                  <div className="flex items-center gap-3 overflow-x-auto py-2">
                    {/* Main Image as #1 */}
                    <div className="relative w-20 h-16 rounded-xl overflow-hidden border-2 border-[#ffb230] shrink-0 bg-[#11131a]">
                      <img src={imageUrl || product.image} alt="Main" className="w-full h-full object-cover" />
                      <span className="absolute bottom-0.5 left-0.5 bg-[#ffb230] text-[#291800] font-bold text-[9px] px-1 rounded">
                        Cover
                      </span>
                    </div>

                    {/* Additional Gallery Images */}
                    {galleryImages.map((img, idx) => (
                      <div
                        key={idx}
                        className="group relative w-20 h-16 rounded-xl overflow-hidden border border-white/20 shrink-0 bg-[#11131a]"
                      >
                        <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveGalleryImage(idx)}
                          className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove image"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white font-mono text-[9px] px-1 rounded">
                          #{idx + 2}
                        </span>
                      </div>
                    ))}

                    {galleryImages.length === 0 && (
                      <div className="px-4 py-3 rounded-xl border border-dashed border-white/10 text-xs text-[#8B90A0] italic">
                        No additional screenshots added yet. Add screenshot URLs or upload files above.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACCOUNT SPECIFICATIONS (EXACTLY LIKE IN STORE AS SEEN IN IMAGE.PNG) */}
          {activeTab === 'specs' && (
            <div className="space-y-5 animate-fade-in">
              <div className="bg-[#1C1F29] border border-[#ffb230]/30 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#ffb230]" />
                    <h3 className="font-headline text-sm text-[#ffd7a1] uppercase font-bold">
                      {lang === 'KM'
                        ? 'ព័ត៌មានលម្អិតគណនី (ACCOUNT SPECIFICATIONS)'
                        : 'ACCOUNT SPECIFICATIONS (SHOWN IN STORE MODAL)'}
                    </h3>
                  </div>
                  <span className="bg-[#3ECF8E]/20 text-[#3ECF8E] text-[10px] font-price font-bold px-2 py-0.5 rounded-full border border-[#3ECF8E]/30">
                    100% VERIFIED
                  </span>
                </div>

                <p className="text-xs text-[#8B90A0]">
                  These 4 specification cards are shown prominently in the store product details popup (matches image mockup).
                </p>

                {/* 4 In-Store Specifications Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. Level / Rank */}
                  <div className="bg-[#11131a] p-3 rounded-xl border border-white/10 space-y-1">
                    <span className="text-[10px] text-[#8B90A0] uppercase font-price block">
                      1. Level / Rank
                    </span>
                    <input
                      type="text"
                      value={levelRank}
                      onChange={(e) => setLevelRank(e.target.value)}
                      placeholder="e.g. Max Level (2550)"
                      className="w-full bg-[#1C1F29] text-[#ffd7a1] font-bold border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-price focus:border-[#ffb230] outline-none"
                    />
                  </div>

                  {/* 2. Melee & Skills */}
                  <div className="bg-[#11131a] p-3 rounded-xl border border-white/10 space-y-1">
                    <span className="text-[10px] text-[#8B90A0] uppercase font-price block">
                      2. Melee & Skills
                    </span>
                    <input
                      type="text"
                      value={meleeSkills}
                      onChange={(e) => setMeleeSkills(e.target.value)}
                      placeholder="e.g. Godhuman / V4 Gear"
                      className="w-full bg-[#1C1F29] text-[#3ECF8E] font-bold border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-price focus:border-[#ffb230] outline-none"
                    />
                  </div>

                  {/* 3. Email Security */}
                  <div className="bg-[#11131a] p-3 rounded-xl border border-white/10 space-y-1">
                    <span className="text-[10px] text-[#8B90A0] uppercase font-price block">
                      3. Email Security
                    </span>
                    <input
                      type="text"
                      value={emailSecurity}
                      onChange={(e) => setEmailSecurity(e.target.value)}
                      placeholder="e.g. Unlinked (Clean)"
                      className="w-full bg-[#1C1F29] text-[#3ECF8E] font-bold border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-price focus:border-[#ffb230] outline-none"
                    />
                  </div>

                  {/* 4. Phone / PIN */}
                  <div className="bg-[#11131a] p-3 rounded-xl border border-white/10 space-y-1">
                    <span className="text-[10px] text-[#8B90A0] uppercase font-price block">
                      4. Phone / PIN Security
                    </span>
                    <input
                      type="text"
                      value={phonePin}
                      onChange={(e) => setPhonePin(e.target.value)}
                      placeholder="e.g. No Pin / No Phone"
                      className="w-full bg-[#1C1F29] text-[#3ECF8E] font-bold border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-price focus:border-[#ffb230] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Auto Delivery Credentials (If fulfillment is account) */}
              {isAccount && (
                <div className="bg-[#1C1F29] border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-[#ffb230]" />
                    <h3 className="font-headline text-xs text-[#ffd7a1] uppercase font-bold">
                      Instant Automated Delivery Payload (Delivered to Buyer Upon Payment)
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-[#8B90A0] uppercase block">Roblox Username</label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Uchiro_Player77"
                        className="w-full bg-[#11131a] text-white border border-white/10 rounded-xl px-3 py-2 text-xs font-mono focus:border-[#ffb230] outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-[#8B90A0] uppercase block">Password</label>
                      <input
                        type="text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Secret!Pass2026"
                        className="w-full bg-[#11131a] text-white border border-white/10 rounded-xl px-3 py-2 text-xs font-mono focus:border-[#ffb230] outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-[#8B90A0] uppercase block">Authenticator Key / Live 2FA Seed</label>
                      <input
                        type="text"
                        value={authenticatorKey}
                        onChange={(e) => setAuthenticatorKey(e.target.value)}
                        placeholder="JBSWY3DPEHPK3PXP"
                        className="w-full bg-[#11131a] text-[#00F0FF] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono focus:border-[#00F0FF] outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 mt-2">
                    <label className="text-[10px] text-[#8B90A0] uppercase block">
                      Instructions Khmer (Shown on Completed Order Screen)
                    </label>
                    <input
                      type="text"
                      value={instructionsKhmer}
                      onChange={(e) => setInstructionsKhmer(e.target.value)}
                      placeholder="ទទួលបាន Username, Password និងកូដ Live 2FA ភ្លាមៗ..."
                      className="w-full bg-[#11131a] text-[#d1d5db] border border-white/10 rounded-xl px-3 py-2 text-xs font-khmer focus:border-[#ffb230] outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Trade Instructions for Fruit or Trade items */}
              {fulfillmentType === 'trade' && (
                <div className="bg-[#1C1F29] border border-white/10 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#60a5fa]" />
                    <span className="font-headline text-xs text-[#ffd7a1] uppercase font-bold">
                      In-Game Trade Instructions
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={tradeInstructions}
                    onChange={(e) => setTradeInstructions(e.target.value)}
                    placeholder="ទាក់ទង Admin Telegram @Noreakyout ដើម្បី Trade ក្នុងហ្គេម..."
                    className="w-full bg-[#11131a] text-white border border-white/10 rounded-xl p-3 text-xs font-khmer focus:border-[#ffb230] outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 4: LIVE STORE PREVIEW (MATCHES USER IMAGE MOCKUP EXACTLY) */}
          {activeTab === 'preview' && (
            <div className="space-y-4 animate-fade-in max-w-lg mx-auto">
              <div className="bg-[#11131a] p-3 rounded-2xl border border-[#00F0FF]/30 text-center">
                <span className="text-xs font-headline uppercase text-[#00F0FF] font-bold">
                  ⚡ Live Customer In-Store View Preview
                </span>
                <p className="text-[10px] text-[#8B90A0]">
                  This is how customers will see this item in the Product Detail Modal.
                </p>
              </div>

              {/* Store Modal Simulation Card */}
              <div className="bg-[#14161D] border border-white/15 rounded-3xl p-4 shadow-2xl space-y-4">
                {/* Photo & Badge */}
                <div className="relative rounded-2xl overflow-hidden border border-white/10 aspect-video bg-[#11131a]">
                  <img
                    src={imageUrl || product.image}
                    alt={title}
                    className="w-full h-full object-cover"
                  />
                  {badge && (
                    <span className="absolute top-3 left-3 bg-[#ffb230] text-[#291800] text-xs font-price font-bold px-2 py-0.5 rounded-md uppercase shadow-lg">
                      {badge}
                    </span>
                  )}
                  {galleryImages.length > 0 && (
                    <span className="absolute top-3 right-3 bg-black/70 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-white/20">
                      1 / {galleryImages.length + 1}
                    </span>
                  )}
                </div>

                {/* Title & Khmer Description */}
                <div>
                  <h3 className="font-headline text-lg text-white uppercase">{title || 'Product Title'}</h3>
                  <p className="font-khmer text-xs text-[#ffd7a1] leading-relaxed mt-1">
                    {descriptionKhmer || 'ការពិពណ៌នាទំនិញជាភាសាខ្មែរ...'}
                  </p>
                </div>

                {/* Account Specifications Grid */}
                {isAccount && (
                  <div className="bg-[#1C1F29]/90 border border-white/10 rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#ffb230]" />
                        <span className="font-headline text-[11px] font-bold text-[#ffd7a1] uppercase">
                          ព័ត៌មានលម្អិតគណនី (ACCOUNT DETAILS)
                        </span>
                      </div>
                      <span className="bg-[#3ECF8E]/20 text-[#3ECF8E] text-[9px] font-price font-bold px-2 py-0.5 rounded-full border border-[#3ECF8E]/30">
                        100% VERIFIED
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-price">
                      <div className="bg-[#11131a] p-2 rounded-xl border border-white/5">
                        <span className="text-[9px] text-[#8B90A0] uppercase block">Level / Rank</span>
                        <span className="text-[#ffd7a1] font-bold text-xs">{levelRank}</span>
                      </div>
                      <div className="bg-[#11131a] p-2 rounded-xl border border-white/5">
                        <span className="text-[9px] text-[#8B90A0] uppercase block">Melee & Skills</span>
                        <span className="text-[#3ECF8E] font-bold text-xs">{meleeSkills}</span>
                      </div>
                      <div className="bg-[#11131a] p-2 rounded-xl border border-white/5">
                        <span className="text-[9px] text-[#8B90A0] uppercase block">Email Security</span>
                        <span className="text-[#3ECF8E] font-bold flex items-center gap-1 text-xs">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{emailSecurity}</span>
                        </span>
                      </div>
                      <div className="bg-[#11131a] p-2 rounded-xl border border-white/5">
                        <span className="text-[9px] text-[#8B90A0] uppercase block">Phone / PIN</span>
                        <span className="text-[#3ECF8E] font-bold flex items-center gap-1 text-xs">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{phonePin}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Price Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <div>
                    <span className="text-[10px] text-[#8B90A0] uppercase block">Price</span>
                    <span className="font-price text-xl font-bold text-[#ffb230]">
                      ${(parseFloat(priceUSD) || 0).toFixed(2)} USD
                    </span>
                  </div>
                  <span className="bg-[#3ECF8E] text-[#003822] font-headline text-xs uppercase font-bold px-4 py-2 rounded-xl">
                    Buy Now
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-[#1C1F29] border-t border-white/10 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#8B90A0] hover:text-white text-xs font-headline uppercase font-bold transition-all cursor-pointer"
          >
            {lang === 'KM' ? 'បោះបង់' : 'Cancel'}
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] font-headline text-xs uppercase font-bold chunky-btn-gold flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4 text-[#003822]" />
                  <span>{lang === 'KM' ? 'បានរក្សាទុក!' : 'Saved!'}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{lang === 'KM' ? 'រក្សាទុកការកែសម្រួល' : 'Save & Update Product'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
