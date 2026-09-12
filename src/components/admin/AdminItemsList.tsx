import React, { useState } from 'react';
import { Product } from '../../types';
import { ArrowLeft, Plus, Search, Trash2, Edit3, Shield, Sparkles, Check, Flame, SlidersHorizontal, Eye, ShoppingBag } from 'lucide-react';
import { AdminEditProductModal } from './AdminEditProductModal';

interface AdminItemsListProps {
  products: Product[];
  onAddProductClick: () => void;
  onUpdateProduct: (id: string, updates: Partial<Product>) => void;
  onDeleteProduct: (id: string) => void;
  onBack: () => void;
  onGoToStore?: () => void;
  lang: 'KM' | 'EN';
}

export const AdminItemsList: React.FC<AdminItemsListProps> = ({
  products,
  onAddProductClick,
  onUpdateProduct,
  onDeleteProduct,
  onBack,
  onGoToStore,
  lang,
}) => {
  const [search, setSearch] = useState('');
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');

  const filtered = products.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.titleKhmer.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (p: Product) => {
    setSelectedProductForModal(p);
  };

  const startQuickInlineEdit = (p: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(p.id);
    setEditPrice(p.price.toString());
    setEditStock(p.stock.toString());
  };

  const saveEdit = (id: string) => {
    const numericStock = parseInt(editStock, 10) || 0;
    onUpdateProduct(id, {
      price: parseFloat(editPrice) || 0,
      stock: numericStock,
      isSold: numericStock <= 0,
    });
    setEditingId(null);
  };

  const toggleSoldStatus = (p: Product) => {
    const isCurrentlySold = p.isSold || p.stock <= 0;
    if (isCurrentlySold) {
      onUpdateProduct(p.id, {
        isSold: false,
        stock: p.stock > 0 ? p.stock : 5,
      });
    } else {
      onUpdateProduct(p.id, {
        isSold: true,
        stock: 0,
      });
    }
  };

  return (
    <div className="min-h-screen pb-28 pt-20 px-4 md:px-8 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-[#1C1F29] border border-white/10 text-[#ffd7a1] hover:text-[#ffb230] flex items-center justify-center transition-all active:scale-95 shrink-0"
          title="Back to Dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-headline text-xl sm:text-2xl md:text-3xl text-[#ffd7a1] uppercase tracking-wider text-center flex-1 truncate">
          MANAGE INVENTORY ({products.length})
        </h1>
        {onGoToStore && (
          <button
            onClick={onGoToStore}
            className="bg-[#3ECF8E]/20 hover:bg-[#3ECF8E]/30 text-[#3ECF8E] border border-[#3ECF8E]/50 font-headline text-xs px-3 py-2 rounded-xl uppercase font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-md shrink-0 cursor-pointer"
            title="View Live Store"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'KM' ? 'ហាងទំនិញ' : 'Store'}</span>
          </button>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8B90A0] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items by title or category..."
            className="w-full bg-[#1C1F29] text-[#e2e2ec] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs font-price focus:border-[#ffb230] outline-none"
          />
        </div>

        <button
          onClick={onAddProductClick}
          className="bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] px-4 py-2.5 rounded-xl font-headline text-sm uppercase font-bold chunky-btn-gold flex items-center justify-center gap-2 shadow-lg"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add New Product</span>
        </button>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-[#14161D] rounded-3xl border border-white/5 space-y-3">
            <Sparkles className="w-10 h-10 text-[#8B90A0] mx-auto opacity-50" />
            <h3 className="font-headline text-xl text-[#e2e2ec] uppercase">
              No products found
            </h3>
            <p className="font-price text-xs text-[#8B90A0]">
              Click "+ Add New Product" to publish your first item.
            </p>
          </div>
        ) : (
          filtered.map((product) => {
            const isEditing = editingId === product.id;
            return (
              <div
                key={product.id}
                className="bg-[#1C1F29] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-3.5 overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.title}
                    className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0"
                  />
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-2">
                      <h4 className="font-headline text-sm text-[#e2e2ec] truncate">
                        {product.title}
                      </h4>
                      {product.badge && (
                        <span className="bg-[#ffb230]/20 text-[#ffb230] text-[9px] font-price px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                          {product.badge}
                        </span>
                      )}
                    </div>
                    <p className="font-khmer text-xs text-[#8B90A0] truncate">
                      {product.titleKhmer}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-price text-[11px] text-[#3ECF8E] uppercase flex items-center gap-1">
                        <span>
                          {product.category === 'account' && '👑'}
                          {product.category === 'fruit' && '🍇'}
                          {product.category === 'gamepass' && '🎟️'}
                          {product.category === 'evade' && '🏃‍♂️'}
                          {product.category === 'mm2' && '🗡️'}
                          {product.category === 'blade-ball' && '⚔️'}
                        </span>
                        <span>{product.category}</span>
                      </span>
                    </div>

                    {/* Admin Fulfillment Delivery Selector */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-[#8B90A0] font-price uppercase">Delivery:</span>
                      <div className="inline-flex rounded-lg p-0.5 bg-[#11131a] border border-white/10">
                        <button
                          type="button"
                          onClick={() => onUpdateProduct(product.id, { fulfillmentType: 'account' })}
                          className={`px-2 py-0.5 rounded text-[10px] font-price font-bold uppercase transition-all flex items-center gap-1 ${
                            product.fulfillmentType === 'account'
                              ? 'bg-[#3ECF8E] text-[#003822] shadow'
                              : 'text-[#8B90A0] hover:text-white'
                          }`}
                          title="Instant 24/7 Automated Account Credentials Delivery"
                        >
                          👑 Account
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateProduct(product.id, { fulfillmentType: 'gift' })}
                          className={`px-2 py-0.5 rounded text-[10px] font-price font-bold uppercase transition-all flex items-center gap-1 ${
                            product.fulfillmentType === 'gift'
                              ? 'bg-[#ffb230] text-[#291800] shadow'
                              : 'text-[#8B90A0] hover:text-white'
                          }`}
                          title="Gift delivery directly to user's Roblox Account (15-30m)"
                        >
                          🎁 Gift
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateProduct(product.id, { fulfillmentType: 'trade' })}
                          className={`px-2 py-0.5 rounded text-[10px] font-price font-bold uppercase transition-all flex items-center gap-1 ${
                            product.fulfillmentType === 'trade'
                              ? 'bg-[#60a5fa] text-[#0f172a] shadow'
                              : 'text-[#8B90A0] hover:text-white'
                          }`}
                          title="In-Game Trade with Admin server"
                        >
                          👥 Trade
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Price & Stock Controls */}
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-0 border-white/5">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <div>
                        <span className="text-[10px] text-[#8B90A0] block font-price">USD ($)</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-16 bg-[#11131a] text-[#ffd7a1] font-bold border border-white/10 rounded-lg px-2 py-1 text-xs font-price"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8B90A0] block font-price">Stock</span>
                        <input
                          type="number"
                          value={editStock}
                          onChange={(e) => setEditStock(e.target.value)}
                          className="w-14 bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-lg px-2 py-1 text-xs font-price"
                        />
                      </div>
                      <button
                        onClick={() => saveEdit(product.id)}
                        className="bg-[#3ECF8E] text-[#003822] p-2 rounded-xl hover:scale-105 transition-transform"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-right">
                      <div className="font-price text-base font-bold text-[#ffb230]">
                        ${(product.price ?? 0).toFixed(2)} USD
                      </div>
                      <div className="font-price text-xs text-[#8B90A0]">
                        Stock:{' '}
                        <span
                          className={`font-bold ${
                            product.stock > 0 ? 'text-[#3ECF8E]' : 'text-[#E8433F]'
                          }`}
                        >
                          {product.stock} left
                        </span>
                      </div>
                    </div>
                  )}

                  {!isEditing && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleSoldStatus(product)}
                        className={`px-2.5 py-1.5 rounded-xl font-price text-[11px] font-bold border transition-all ${
                          product.isSold || product.stock <= 0
                            ? 'bg-[#3ECF8E]/10 border-[#3ECF8E]/40 text-[#3ECF8E] hover:bg-[#3ECF8E]/20'
                            : 'bg-[#E8433F]/10 border-[#E8433F]/40 text-[#E8433F] hover:bg-[#E8433F]/20'
                        }`}
                        title={product.isSold || product.stock <= 0 ? 'Click to Restock (+5)' : 'Click to Mark as Sold Out'}
                      >
                        {product.isSold || product.stock <= 0 ? 'RESTOCK' : 'MARK SOLD'}
                      </button>

                      {/* Full Detail Editor Button (Like in Store) */}
                      <button
                        onClick={() => setSelectedProductForModal(product)}
                        className="px-2.5 py-1.5 bg-[#ffb230]/15 hover:bg-[#ffb230]/25 text-[#ffd7a1] hover:text-[#ffb230] border border-[#ffb230]/30 rounded-xl font-headline text-xs uppercase font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                        title="Edit Full Specifications, Gallery & Store Details"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-[#ffb230]" />
                        <span>{lang === 'KM' ? 'កែព័ត៌មានលម្អិត' : 'Edit Details'}</span>
                      </button>

                      <button
                        onClick={(e) => startQuickInlineEdit(product, e)}
                        className="p-2 bg-[#282a31] text-[#ffd7a1] hover:text-[#ffb230] rounded-xl transition-colors"
                        title="Quick Edit Price & Stock"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onDeleteProduct(product.id)}
                        className="p-2 bg-[#282a31] text-[#E8433F] hover:bg-[#E8433F]/20 rounded-xl transition-colors"
                        title="Delete Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Full Store Product Detail Editor Modal */}
      {selectedProductForModal && (
        <AdminEditProductModal
          product={selectedProductForModal}
          onSave={(id, updates) => {
            onUpdateProduct(id, updates);
            setSelectedProductForModal((prev) => (prev && prev.id === id ? { ...prev, ...updates } : prev));
          }}
          onClose={() => setSelectedProductForModal(null)}
          lang={lang}
        />
      )}
    </div>
  );
};
