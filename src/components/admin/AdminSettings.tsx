import React, { useState, useEffect, useRef } from 'react';
import { StoreSettings, SongTrack } from '../../types';
import { api } from '../../utils/api';
import {
  ArrowLeft,
  Save,
  Shield,
  QrCode,
  Image as ImageIcon,
  Music,
  Trash2,
  Plus,
  RefreshCw,
  AlertTriangle,
  Check,
  Upload,
  Globe,
  MessageSquare,
  Bell,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Radio,
  Sparkles,
  Laptop,
  CheckCircle2,
  ExternalLink,
  Layers,
  DollarSign,
  Clock,
  Phone,
  Link as LinkIcon,
  HelpCircle,
  Loader2,
  Zap,
} from 'lucide-react';
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendTestDesktopNotification,
  isSoundAlertEnabled,
  setSoundAlertEnabled,
  getSoundAlertVolume,
  setSoundAlertVolume,
  playOrderAlertChime,
} from '../../utils/desktopNotification';
import { generateKHQRDataURL } from '../../utils/khqr';

const PRESET_SONGS: Omit<SongTrack, 'id'>[] = [
  {
    title: 'Neon Horizon (Lofi Beats)',
    artist: 'Chill Gaming Studio',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
    duration: '2:27',
  },
  {
    title: 'Cyberpunk Tokyo Nights',
    artist: 'Uchiro Synth Wave',
    url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=chill-abstract-intention-12099.mp3',
    duration: '2:05',
  },
  {
    title: 'Awakened Sea Theme',
    artist: 'Grand Line Melodies',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=ambient-piano-amp-strings-10711.mp3',
    duration: '2:15',
  },
  {
    title: 'Tokyo Street Anime Chill',
    artist: 'Anime Lofi Project',
    url: 'https://cdn.pixabay.com/download/audio/2022/01/26/audio_d0c6ff1101.mp3?filename=lofi-chill-medium-version-159456.mp3',
    duration: '2:40',
  },
];

interface AdminSettingsProps {
  settings: StoreSettings;
  songs?: SongTrack[];
  onSaveSettings: (settings: StoreSettings) => void;
  onSaveSongs?: (songs: SongTrack[]) => void;
  onResetToZero?: () => void;
  onResetData?: (mode: 'zero' | 'starter') => void;
  onBack: () => void;
  lang: 'KM' | 'EN';
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  settings,
  songs,
  onSaveSettings,
  onSaveSongs,
  onResetToZero,
  onResetData,
  onBack,
  lang,
}) => {
  const [formData, setFormData] = useState<StoreSettings>({
    ...settings,
    tagline: settings.tagline || "Cambodia's #1 Automated Roblox & Mythical Items Store",
    aboutStore: settings.aboutStore || 'Instant automated delivery 24/7 with zero fees and full warranty.',
    workingHours: settings.workingHours || '24/7 Automated Instant Delivery (១ ទៅ ៥ វិនាទី)',
    exchangeRateKHR: settings.exchangeRateKHR || 4100,
    acquiringBank: settings.acquiringBank || 'ABA Bank (Advanced Bank of Asia)',
    songs: songs || settings.songs || [],
  });

  const [showSavedToast, setShowSavedToast] = useState(false);
  const [confirmResetMode, setConfirmResetMode] = useState<'zero' | 'starter' | null>(null);

  // Notification state
  const [notifPermission, setNotifPermission] = useState(getNotificationPermission());
  const [soundEnabled, setSoundEnabledState] = useState(isSoundAlertEnabled());
  const [soundVolume, setSoundVolumeState] = useState(getSoundAlertVolume());
  const [testSent, setTestSent] = useState(false);

  // In-Admin Song Previewer State
  const [previewingSongId, setPreviewingSongId] = useState<string | null>(null);
  const adminAudioRef = useRef<HTMLAudioElement | null>(null);

  // New Song Input State
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongArtist, setNewSongArtist] = useState('');
  const [newSongUrl, setNewSongUrl] = useState('');

  // KHQR Live Sandbox Generator State
  const [testQRUrl, setTestQRUrl] = useState<string | null>(null);
  const [isGeneratingTestQR, setIsGeneratingTestQR] = useState(false);
  const [khqrTestSuccess, setKhqrTestSuccess] = useState(false);

  // Bakong Open API live verification test
  const [isTestingBakongApi, setIsTestingBakongApi] = useState(false);
  const [bakongApiTestResult, setBakongApiTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const handleTestBakongConnection = async () => {
    setIsTestingBakongApi(true);
    setBakongApiTestResult(null);
    try {
      const res = await api.testBakongConnection({
        bakongAccountId: formData.bakongAccountId,
        khqrApiKey: formData.khqrApiKey,
      });
      setBakongApiTestResult({
        success: res.success,
        message: res.message || (res.success ? 'Bakong Open API connection OK' : 'Connection failed'),
        details: res,
      });
    } catch (err: any) {
      setBakongApiTestResult({
        success: false,
        message: err.message || 'Connection to Bakong Open API failed',
      });
    } finally {
      setIsTestingBakongApi(false);
    }
  };

  useEffect(() => {
    setNotifPermission(getNotificationPermission());
    setSoundEnabledState(isSoundAlertEnabled());
    setSoundVolumeState(getSoundAlertVolume());

    return () => {
      if (adminAudioRef.current) {
        adminAudioRef.current.pause();
      }
    };
  }, []);

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      sendTestDesktopNotification(formData.logoUrl);
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    }
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabledState(next);
    setSoundAlertEnabled(next);
    if (next) playOrderAlertChime(soundVolume);
  };

  const handleVolumeChange = (vol: number) => {
    setSoundVolumeState(vol);
    setSoundAlertVolume(vol);
  };

  const handleTestNotification = () => {
    sendTestDesktopNotification(formData.logoUrl);
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    if (onSaveSongs) {
      onSaveSongs(formData.songs);
    }
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64 = uploadEvent.target?.result as string;
        if (base64) {
          setFormData((prev) => ({ ...prev, logoUrl: base64 }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTogglePreviewSong = (song: SongTrack) => {
    if (previewingSongId === song.id) {
      if (adminAudioRef.current) {
        adminAudioRef.current.pause();
      }
      setPreviewingSongId(null);
    } else {
      if (!adminAudioRef.current) {
        adminAudioRef.current = new Audio();
      }
      adminAudioRef.current.src = song.url;
      adminAudioRef.current.volume = formData.defaultVolume || 0.4;
      adminAudioRef.current.play().then(() => {
        setPreviewingSongId(song.id);
      }).catch((err) => {
        console.warn('Audio preview error:', err);
        setPreviewingSongId(null);
      });
      adminAudioRef.current.onended = () => {
        setPreviewingSongId(null);
      };
    }
  };

  const handleAddSong = () => {
    if (!newSongTitle.trim() || !newSongUrl.trim()) return;
    const newTrack: SongTrack = {
      id: `song-${Date.now()}`,
      title: newSongTitle.trim(),
      artist: newSongArtist.trim() || 'Uchiro Audio',
      url: newSongUrl.trim(),
    };
    setFormData((prev) => ({
      ...prev,
      songs: [...prev.songs, newTrack],
    }));
    setNewSongTitle('');
    setNewSongArtist('');
    setNewSongUrl('');
  };

  const handleAddPresetSong = (preset: typeof PRESET_SONGS[0]) => {
    const newTrack: SongTrack = {
      id: `song-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...preset,
    };
    setFormData((prev) => ({
      ...prev,
      songs: [...prev.songs, newTrack],
    }));
  };

  const handleRemoveSong = (songId: string) => {
    if (previewingSongId === songId && adminAudioRef.current) {
      adminAudioRef.current.pause();
      setPreviewingSongId(null);
    }
    setFormData((prev) => ({
      ...prev,
      songs: prev.songs.filter((s) => s.id !== songId),
    }));
  };

  const handleGenerateTestKHQR = async () => {
    setIsGeneratingTestQR(true);
    setKhqrTestSuccess(false);
    try {
      const url = await generateKHQRDataURL({
        merchantName: formData.merchantName || 'UCHIRO STORE',
        merchantCity: formData.merchantCity || 'Phnom Penh',
        bakongAccountId: formData.bakongAccountId || 'uchiro_store@aclb',
        amount: 10.0,
        currency: 'USD',
        billNumber: `TEST-KHQR-${Date.now().toString().slice(-4)}`,
        storeLabel: 'Uchiro Admin Test',
      });
      setTestQRUrl(url);
      setKhqrTestSuccess(true);
    } catch (err) {
      console.error('Failed to generate test KHQR:', err);
    } finally {
      setIsGeneratingTestQR(false);
    }
  };

  return (
    <div className="min-h-screen pb-28 pt-15 sm:pt-20 px-3 sm:px-4 md:px-8 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-[#1C1F29] border border-white/10 text-[#ffd7a1] hover:text-[#ffb230] flex items-center justify-center transition-all active:scale-95 shadow-md"
          title="Back to Admin Dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-headline text-2xl md:text-3xl text-[#ffd7a1] uppercase tracking-wider text-center flex-1 pr-10">
          STORE, MUSIC & KHQR SETTINGS
        </h1>
      </div>

      {showSavedToast && (
        <div className="bg-[#3ECF8E]/20 border border-[#3ECF8E]/50 text-[#3ECF8E] p-4 rounded-2xl flex items-center gap-2.5 font-price text-sm font-bold animate-[scaleIn_0.2s_ease-out] shadow-xl">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>All store logo, music playlist, information, and Bakong KHQR settings saved successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {/* ========================================================================= */}
        {/* 1. STORE LOGO & BRANDING INFORMATION */}
        {/* ========================================================================= */}
        <section className="bg-[#1C1F29] border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2.5 text-[#ffd7a1] border-b border-white/5 pb-3">
            <ImageIcon className="w-6 h-6 text-[#ffb230]" />
            <div>
              <h2 className="font-headline text-lg uppercase">Store Logo, Branding & Info</h2>
              <p className="font-price text-xs text-[#8B90A0]">Customize store logo, store names, announcements, and working hours</p>
            </div>
          </div>

          {/* Logo Upload & Preview */}
          <div className="flex flex-col sm:flex-row items-center gap-5 bg-[#11131a] p-4 rounded-2xl border border-white/5">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[#1C1F29] border-2 border-[#ffb230] shrink-0 relative group shadow-md">
              <img
                src={formData.logoUrl}
                alt="Store Logo"
                className="w-full h-full object-cover"
              />
              <label className="absolute inset-0 bg-black/60 rounded-2xl flex flex-col items-center justify-center text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="w-5 h-5 text-[#ffb230]" />
                <span className="text-[9px] font-price font-bold">Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex-1 w-full space-y-2">
              <label className="font-price text-xs text-[#8B90A0] block font-bold">
                Store Logo Image URL or File Upload
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="cursor-pointer bg-[#282a31] hover:bg-[#33353e] text-[#ffd7a1] border border-white/10 px-3.5 py-2 rounded-xl text-xs font-price font-bold flex items-center gap-1.5 transition-all">
                  <Upload className="w-4 h-4 text-[#ffb230]" />
                  <span>Upload Image File</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                <span className="font-price text-xs text-[#8B90A0]">or direct URL:</span>
              </div>
              <input
                type="text"
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                placeholder="https://..."
                className="w-full bg-[#1C1F29] text-[#e2e2ec] border border-white/10 rounded-xl px-3.5 py-2 text-xs font-price focus:border-[#ffb230] outline-none"
              />
            </div>
          </div>

          {/* Store Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                Store Name (English) *
              </label>
              <input
                type="text"
                required
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-sans focus:border-[#ffb230] outline-none"
              />
            </div>

            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                Store Name (Khmer) *
              </label>
              <input
                type="text"
                required
                value={formData.storeNameKhmer}
                onChange={(e) => setFormData({ ...formData, storeNameKhmer: e.target.value })}
                className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-khmer focus:border-[#ffb230] outline-none"
              />
            </div>
          </div>

          {/* Tagline & Announcement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                Store Tagline / Slogan
              </label>
              <input
                type="text"
                value={formData.tagline || ''}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                placeholder="Cambodia's #1 Automated Roblox Store"
                className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-sans focus:border-[#ffb230] outline-none"
              />
            </div>

            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                Exchange Rate (1 USD to KHR)
              </label>
              <div className="relative">
                <span className="text-xs font-price text-[#8B90A0] absolute left-3 top-1/2 -translate-y-1/2 font-bold">៛</span>
                <input
                  type="number"
                  value={formData.exchangeRateKHR || 4100}
                  onChange={(e) => setFormData({ ...formData, exchangeRateKHR: Number(e.target.value) || 4100 })}
                  className="w-full bg-[#11131a] text-[#ffd7a1] border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-sm font-price focus:border-[#ffb230] outline-none font-bold"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
              Announcement Marquee Banner (Header)
            </label>
            <input
              type="text"
              value={formData.announcement}
              onChange={(e) => setFormData({ ...formData, announcement: e.target.value })}
              className="w-full bg-[#11131a] text-[#ffd7a1] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-khmer focus:border-[#ffb230] outline-none"
            />
          </div>

          {/* Working Hours, Telegram Contact & Socials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                Working Hours / Delivery Notice
              </label>
              <input
                type="text"
                value={formData.workingHours || ''}
                onChange={(e) => setFormData({ ...formData, workingHours: e.target.value })}
                placeholder="24/7 Automated Delivery"
                className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3 py-2 text-xs font-price focus:border-[#ffb230] outline-none"
              />
            </div>

            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                Admin Support Telegram Link (e.g. @Noreakyout)
              </label>
              <input
                type="text"
                value={formData.telegramUrl || 'https://t.me/Noreakyout'}
                onChange={(e) => setFormData({ ...formData, telegramUrl: e.target.value })}
                placeholder="https://t.me/Noreakyout"
                className="w-full bg-[#11131a] text-[#3ECF8E] border border-white/10 rounded-xl px-3 py-2 text-xs font-price focus:border-[#ffb230] outline-none font-bold"
              />
            </div>
          </div>

          {/* Sold-out products visibility behavior */}
          <div className="flex items-center justify-between bg-[#11131a] p-4 rounded-2xl border border-white/5 mt-2">
            <div>
              <span className="font-price text-xs text-[#e2e2ec] font-bold block">
                Auto-Hide Sold Out Items from Storefront
              </span>
              <p className="text-[11px] font-price text-[#8B90A0] mt-0.5">
                When enabled, products with 0 stock or marked as Sold will automatically disappear from customer view. When disabled, they stay visible with a "SOLD OUT" badge.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, hideSoldOutProducts: !formData.hideSoldOutProducts })}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ml-4 ${
                formData.hideSoldOutProducts ? 'bg-[#3ECF8E]' : 'bg-[#33343c]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  formData.hideSoldOutProducts ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 2. STORE MUSIC (BGM) & SOUND EFFECTS */}
        {/* ========================================================================= */}
        <section className="bg-[#1C1F29] border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div className="flex items-center gap-2.5 text-[#ffb230]">
              <Music className="w-6 h-6" />
              <div>
                <h2 className="font-headline text-lg uppercase">Store Background Music (BGM)</h2>
                <p className="font-price text-xs text-[#8B90A0]">Manage ambient soundtrack, default volume, and playlist tracks</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-[#11131a] px-3 py-1.5 rounded-xl border border-white/5">
                <span className="font-price text-xs text-[#e2e2ec] font-bold">Enable Music:</span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, bgMusicEnabled: !formData.bgMusicEnabled })}
                  className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                    formData.bgMusicEnabled ? 'bg-[#3ECF8E]' : 'bg-[#33343c]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      formData.bgMusicEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Volume and Playback Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#11131a] p-4 rounded-2xl border border-white/5">
            <div>
              <div className="flex justify-between text-xs font-price text-[#8B90A0] mb-1.5 font-bold">
                <span>Default Music Volume:</span>
                <span className="text-[#ffd7a1]">{Math.round((formData.defaultVolume ?? 0.35) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={formData.defaultVolume ?? 0.35}
                onChange={(e) => setFormData({ ...formData, defaultVolume: parseFloat(e.target.value) })}
                className="w-full accent-[#ffb230] h-2 bg-[#1C1F29] rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4">
              <label className="flex items-center gap-2 cursor-pointer font-price text-xs text-[#cac6bb]">
                <input
                  type="checkbox"
                  checked={formData.bgMusicLoop ?? true}
                  onChange={(e) => setFormData({ ...formData, bgMusicLoop: e.target.checked })}
                  className="rounded border-white/10 text-[#ffb230] focus:ring-0"
                />
                <span>Loop Playlist</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-price text-xs text-[#cac6bb]">
                <input
                  type="checkbox"
                  checked={formData.bgMusicAutoplay ?? false}
                  onChange={(e) => setFormData({ ...formData, bgMusicAutoplay: e.target.checked })}
                  className="rounded border-white/10 text-[#ffb230] focus:ring-0"
                />
                <span>Autoplay on Load</span>
              </label>
            </div>
          </div>

          {/* Current Playlist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-price text-xs text-[#8B90A0] uppercase font-bold block">
                Store Playlist ({formData.songs.length} Tracks)
              </label>
              <span className="font-price text-[11px] text-[#3ECF8E]">Click Play ▶ to test audio in admin</span>
            </div>

            {formData.songs.map((song, idx) => (
              <div
                key={song.id}
                className="flex items-center justify-between bg-[#11131a] p-3 rounded-2xl border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleTogglePreviewSong(song)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      previewingSongId === song.id
                        ? 'bg-[#3ECF8E] text-[#003822] shadow-lg animate-pulse'
                        : 'bg-[#ffb230]/20 text-[#ffb230] hover:bg-[#ffb230] hover:text-[#291800]'
                    }`}
                    title={previewingSongId === song.id ? 'Pause Preview' : 'Play Preview'}
                  >
                    {previewingSongId === song.id ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current translate-x-0.5" />
                    )}
                  </button>

                  <div className="overflow-hidden">
                    <span className="font-sans text-sm font-bold text-[#e2e2ec] block truncate">
                      {song.title}
                    </span>
                    <span className="font-price text-xs text-[#8B90A0] block truncate">
                      {song.artist} • <span className="text-white/30 text-[10px]">{song.url}</span>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveSong(song.id)}
                  className="text-[#E8433F] hover:bg-[#E8433F]/20 p-2 rounded-xl transition-colors shrink-0 ml-2"
                  title="Delete Song"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Quick Presets */}
          <div className="bg-[#11131a] p-3.5 rounded-2xl border border-white/5">
            <span className="font-price text-xs text-[#8B90A0] font-bold block mb-2">
              ✨ Quick-Add Popular Gaming Soundtrack Presets:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_SONGS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddPresetSong(preset)}
                  className="bg-[#1C1F29] hover:bg-[#282a31] text-[#ffd7a1] border border-white/10 px-3 py-1.5 rounded-xl text-xs font-price flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 text-[#3ECF8E]" />
                  <span>{preset.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Add Custom Song Track */}
          <div className="bg-[#11131a] p-4 rounded-2xl border border-white/10 space-y-3">
            <span className="font-headline text-xs text-[#ffd7a1] uppercase flex items-center gap-1.5 font-bold">
              <Plus className="w-4 h-4 text-[#ffb230]" />
              + Add Custom MP3 Song
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Song Title (e.g. Chill Blox Fruits BGM)"
                value={newSongTitle}
                onChange={(e) => setNewSongTitle(e.target.value)}
                className="w-full bg-[#1C1F29] text-[#e2e2ec] border border-white/10 rounded-xl px-3 py-2 text-xs font-price focus:border-[#ffb230] outline-none"
              />
              <input
                type="text"
                placeholder="Artist / Composer"
                value={newSongArtist}
                onChange={(e) => setNewSongArtist(e.target.value)}
                className="w-full bg-[#1C1F29] text-[#e2e2ec] border border-white/10 rounded-xl px-3 py-2 text-xs font-price focus:border-[#ffb230] outline-none"
              />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Direct MP3 Audio URL (e.g. https://.../audio.mp3)"
                value={newSongUrl}
                onChange={(e) => setNewSongUrl(e.target.value)}
                className="flex-1 bg-[#1C1F29] text-[#e2e2ec] border border-white/10 rounded-xl px-3 py-2 text-xs font-price focus:border-[#ffb230] outline-none"
              />
              <button
                type="button"
                onClick={handleAddSong}
                className="bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] px-4 py-2 rounded-xl text-xs font-headline font-bold uppercase transition-all shadow-md"
              >
                Add Track
              </button>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. BAKONG KHQR API & PAYMENT GATEWAY */}
        {/* ========================================================================= */}
        <section className="bg-[#1C1F29] border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div className="flex items-center gap-2.5 text-[#ffb230]">
              <QrCode className="w-6 h-6" />
              <div>
                <h2 className="font-headline text-lg uppercase">Bakong KHQR API & Gateway</h2>
                <p className="font-price text-xs text-[#8B90A0]">Configure Bakong account for USD and KHR automated checkout</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              <button
                type="button"
                onClick={handleTestBakongConnection}
                disabled={isTestingBakongApi}
                className="bg-[#3ECF8E]/15 hover:bg-[#3ECF8E]/25 text-[#3ECF8E] border border-[#3ECF8E]/30 px-3.5 py-1.5 rounded-xl text-xs font-headline uppercase font-bold transition-all flex items-center gap-1.5"
              >
                {isTestingBakongApi ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-[#3ECF8E]" />
                    <span>Test Bakong API</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleGenerateTestKHQR}
                disabled={isGeneratingTestQR}
                className="bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 text-[#00F0FF] border border-[#00F0FF]/30 px-3.5 py-1.5 rounded-xl text-xs font-headline uppercase font-bold transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isGeneratingTestQR ? 'Generating...' : 'Test KHQR Code'}</span>
              </button>
            </div>
          </div>

          {/* Bakong API Live Verification Test Result */}
          {bakongApiTestResult && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-price flex items-start gap-2.5 transition-all ${
                bakongApiTestResult.success
                  ? 'bg-[#3ECF8E]/10 border-[#3ECF8E]/40 text-[#3ECF8E]'
                  : 'bg-[#E8433F]/10 border-[#E8433F]/40 text-[#ffd7a1]'
              }`}
            >
              {bakongApiTestResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-[#3ECF8E] shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-[#E8433F] shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <span className="font-bold block text-sm">
                  {bakongApiTestResult.success ? 'Bakong Open API Connected' : 'Bakong API Status'}
                </span>
                <p className="mt-0.5 text-xs text-[#d6c4ae] leading-relaxed">
                  {bakongApiTestResult.message}
                </p>
                {bakongApiTestResult.details && (
                  <pre className="mt-2 p-2 bg-[#0A0B0E] rounded-lg text-[10px] text-[#8B90A0] overflow-x-auto font-mono">
                    {JSON.stringify(bakongApiTestResult.details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                Bakong Account ID / Phone Number *
              </label>
              <input
                type="text"
                required
                value={formData.bakongAccountId}
                onChange={(e) => setFormData({ ...formData, bakongAccountId: e.target.value })}
                placeholder="e.g. 0968888888@aba or uchiro_store@aclb"
                className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-price focus:border-[#ffb230] outline-none"
              />
              <span className="text-[11px] font-price text-[#8B90A0] mt-1 block">
                Standard Bakong ID or bank phone number (ABA, ACLEDA, Wing, etc.)
              </span>
            </div>

            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                Merchant Business Name *
              </label>
              <input
                type="text"
                required
                value={formData.merchantName}
                onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })}
                placeholder="UCHIRO STORE"
                className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-price focus:border-[#ffb230] outline-none"
              />
            </div>

            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                Merchant City
              </label>
              <input
                type="text"
                value={formData.merchantCity}
                onChange={(e) => setFormData({ ...formData, merchantCity: e.target.value })}
                placeholder="Phnom Penh"
                className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-price focus:border-[#ffb230] outline-none"
              />
            </div>

            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                Acquiring Bank Provider
              </label>
              <select
                value={formData.acquiringBank || 'ABA Bank (Advanced Bank of Asia)'}
                onChange={(e) => setFormData({ ...formData, acquiringBank: e.target.value })}
                className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-price focus:border-[#ffb230] outline-none"
              >
                <option value="ABA Bank (Advanced Bank of Asia)">ABA Bank (Advanced Bank of Asia)</option>
                <option value="ACLEDA Bank PLC">ACLEDA Bank PLC</option>
                <option value="Wing Bank (Cambodia) Plc">Wing Bank (Cambodia) Plc</option>
                <option value="Canadia Bank">Canadia Bank</option>
                <option value="Bakong Central Network">Bakong Central Network</option>
              </select>
            </div>

            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                KHPay (khpay.site) / Bakong API Token *
              </label>
              <input
                type="password"
                value={formData.khqrApiKey}
                onChange={(e) => setFormData({ ...formData, khqrApiKey: e.target.value })}
                placeholder="Paste KHPay API Token (from https://khpay.site/) or Bakong JWT Key"
                className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-price focus:border-[#ffb230] outline-none"
              />
              <span className="text-[11px] font-price text-[#8B90A0] mt-1 block">
                Supports <span className="text-[#00F0FF]">KHPay API Token</span> (<a href="https://khpay.site/" target="_blank" rel="noreferrer" className="text-[#00F0FF] underline hover:text-white">khpay.site</a>) or official NBC Bakong Open API Bearer Token.
              </span>
            </div>

            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                Webhook Notification URL
              </label>
              <input
                type="text"
                value={formData.webhookUrl}
                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                placeholder="https://api.uchiro.gg/v1/khqr-webhook"
                className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-price focus:border-[#ffb230] outline-none"
              />
            </div>
          </div>

          {/* Auto-Approve KHQR Payments Toggle */}
          <div className="flex items-center justify-between bg-[#11131a] p-4 rounded-2xl border border-white/5">
            <div>
              <span className="font-sans text-sm font-bold text-[#e2e2ec] block">
                Auto-Approve Orders Upon KHQR Scan
              </span>
              <span className="font-price text-xs text-[#8B90A0]">
                Automatically marks orders complete and reveals account credentials immediately after payment.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, autoApproveKHQR: !formData.autoApproveKHQR })}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                formData.autoApproveKHQR ? 'bg-[#3ECF8E]' : 'bg-[#33343c]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  formData.autoApproveKHQR ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Test KHQR Modal/Box */}
          {testQRUrl && (
            <div className="bg-[#11131a] p-4 rounded-2xl border border-[#00F0FF]/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-headline text-sm text-[#00F0FF] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#3ECF8E]" />
                  Live KHQR Test QR Generated ($10.00 USD)
                </span>
                <button
                  type="button"
                  onClick={() => setTestQRUrl(null)}
                  className="text-xs text-[#8B90A0] hover:text-white"
                >
                  Hide
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="bg-white p-3 rounded-2xl max-w-[160px] aspect-square flex items-center justify-center shadow-lg">
                  <img src={testQRUrl} alt="Test KHQR" className="w-full h-full object-contain" />
                </div>
                <div className="text-xs font-price text-[#cac6bb] space-y-1">
                  <p><strong>Merchant:</strong> {formData.merchantName}</p>
                  <p><strong>Bakong ID:</strong> {formData.bakongAccountId}</p>
                  <p><strong>Acquiring Bank:</strong> {formData.acquiringBank}</p>
                  <p className="text-[#3ECF8E] font-bold">✨ Valid EMVCo format compatible with all Cambodia banking apps.</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ========================================================================= */}
        {/* 4. DESKTOP NOTIFICATIONS & SOUND ENGINE */}
        {/* ========================================================================= */}
        <section className="bg-[#1C1F29] border border-[#ffb230]/40 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2.5 text-[#ffb230]">
              <Bell className="w-6 h-6" />
              <div>
                <h2 className="font-headline text-lg uppercase text-[#ffd7a1]">Desktop Order Alerts & Sound Chime</h2>
                <p className="font-price text-xs text-[#8B90A0]">Real-time system alerts for incoming customer orders</p>
              </div>
            </div>
            <span
              className={`font-price text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                notifPermission === 'granted'
                  ? 'bg-[#3ECF8E]/20 text-[#3ECF8E] border-[#3ECF8E]/40'
                  : notifPermission === 'denied'
                  ? 'bg-[#E8433F]/20 text-[#E8433F] border-[#E8433F]/40'
                  : 'bg-[#ffb230]/20 text-[#ffb230] border-[#ffb230]/40'
              }`}
            >
              {notifPermission === 'granted' ? '🟢 PERMISSION GRANTED' : notifPermission === 'denied' ? '🔴 BLOCKED' : '🟡 DEFAULT'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* System Notification Control */}
            <div className="bg-[#11131a] p-4 rounded-2xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-[#ffd7a1]" />
                  <span className="font-price text-xs font-bold text-[#e2e2ec] uppercase">
                    Native OS Notifications
                  </span>
                </div>
              </div>
              <p className="font-price text-xs text-[#8B90A0]">
                Shows desktop alerts with customer order details even if the store is minimized or in a background tab.
              </p>
              {notifPermission !== 'granted' ? (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="w-full bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] font-headline text-xs py-2.5 rounded-xl uppercase font-bold chunky-btn-gold transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Grant Desktop Permission</span>
                </button>
              ) : (
                <div className="bg-[#3ECF8E]/10 border border-[#3ECF8E]/30 p-2.5 rounded-xl text-xs font-price text-[#3ECF8E] flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Desktop notifications are active & configured</span>
                </div>
              )}
            </div>

            {/* Synthesized Audio Chime Control */}
            <div className="bg-[#11131a] p-4 rounded-2xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-[#3ECF8E]" />
                  <span className="font-price text-xs font-bold text-[#e2e2ec] uppercase">
                    Order Sound Chime
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSound}
                  className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${
                    soundEnabled ? 'bg-[#3ECF8E]' : 'bg-[#33343c]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      soundEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {soundEnabled && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs font-price text-[#8B90A0]">
                    <span>Chime Volume:</span>
                    <span className="text-[#ffd7a1] font-bold">{Math.round(soundVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={soundVolume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    onMouseUp={() => playOrderAlertChime(soundVolume)}
                    className="w-full accent-[#ffb230] h-1.5 bg-[#1C1F29] rounded-lg cursor-pointer"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleTestNotification}
                className="w-full bg-[#1C1F29] hover:bg-[#282a31] border border-white/10 text-[#ffd7a1] hover:text-[#ffb230] font-headline text-xs py-2 rounded-xl uppercase font-bold tracking-wider transition-all flex items-center justify-center gap-1.5"
              >
                <Radio className={`w-3.5 h-3.5 ${testSent ? 'text-[#3ECF8E] animate-ping' : 'text-[#ffb230]'}`} />
                <span>{testSent ? 'Alert Dispatched! 🔔' : 'Play Test Alert'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. ADMIN CREDENTIALS & SECURITY */}
        {/* ========================================================================= */}
        <section className="bg-[#1C1F29] border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2.5 text-[#ffd7a1] border-b border-white/5 pb-3">
            <Shield className="w-6 h-6 text-[#ffb230]" />
            <div>
              <h2 className="font-headline text-lg uppercase">Admin Access & Security</h2>
              <p className="font-price text-xs text-[#8B90A0]">Update master credentials for the admin portal</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                Admin Username / Email
              </label>
              <input
                type="text"
                required
                value={formData.adminUsername}
                onChange={(e) => setFormData({ ...formData, adminUsername: e.target.value })}
                className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-price focus:border-[#ffb230] outline-none"
              />
            </div>

            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                Admin Password
              </label>
              <input
                type="text"
                required
                value={formData.adminPasswordHash || ''}
                onChange={(e) => setFormData({ ...formData, adminPasswordHash: e.target.value })}
                className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-price focus:border-[#ffb230] outline-none"
              />
            </div>

            <div>
              <label className="font-price text-xs text-[#8B90A0] block mb-1 font-bold">
                Admin Security PIN
              </label>
              <input
                type="text"
                required
                value={formData.adminSecurityPin || ''}
                onChange={(e) => setFormData({ ...formData, adminSecurityPin: e.target.value })}
                className="w-full bg-[#11131a] text-[#e2e2ec] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-price focus:border-[#ffb230] outline-none"
              />
            </div>
          </div>
        </section>

        {/* Save Settings Button */}
        <button
          type="submit"
          className="w-full bg-[#ffb230] hover:bg-[#ffb94d] text-[#291800] font-headline text-lg py-4 rounded-2xl uppercase font-bold chunky-btn-gold transition-all shadow-2xl flex items-center justify-center gap-2 active:scale-98"
        >
          <Save className="w-5 h-5" />
          <span>SAVE STORE CONFIGURATION</span>
        </button>

        {/* 6. Clean Zero-State & Factory Reset Suite */}
        <section className="bg-[#1C1F29]/60 border border-[#E8433F]/30 rounded-3xl p-6 space-y-4 mt-2 shadow-xl">
          <div className="flex items-center gap-2 text-[#E8433F]">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div>
              <h3 className="font-headline text-base uppercase">Testing & Inventory Reset Tools</h3>
              <p className="font-price text-xs text-[#8B90A0]">Wipe all items and orders to 0 so you can test adding products completely from scratch</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => setConfirmResetMode('zero')}
              className="bg-[#282a31] hover:bg-[#E8433F]/20 text-[#E8433F] border border-[#E8433F]/40 p-4 rounded-2xl text-left transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-headline text-sm uppercase font-bold">Wipe to 0 Clean State</span>
                <Trash2 className="w-4 h-4 group-hover:scale-110" />
              </div>
              <p className="font-price text-[11px] text-[#8B90A0]">
                Empties all products & orders to 0. Perfect for fresh catalog testing.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setConfirmResetMode('starter')}
              className="bg-[#282a31] hover:bg-[#3ECF8E]/20 text-[#3ECF8E] border border-[#3ECF8E]/40 p-4 rounded-2xl text-left transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-headline text-sm uppercase font-bold">Load Starter Pack</span>
                <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              </div>
              <p className="font-price text-[11px] text-[#8B90A0]">
                Restores 10 official game accounts, mythical fruits, and sample orders.
              </p>
            </button>
          </div>
        </section>
      </form>

      {/* Confirmation Modal for Reset */}
      {confirmResetMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="max-w-md w-full bg-[#1C1F29] rounded-3xl p-6 border border-[#E8433F]/40 shadow-2xl space-y-4 animate-[scaleIn_0.2s_ease-out]">
            <div className="flex items-center gap-3 text-[#E8433F]">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <h3 className="font-headline text-xl uppercase">
                {confirmResetMode === 'zero' ? 'Wipe Everything to 0?' : 'Restore Starter Pack?'}
              </h3>
            </div>

            <p className="font-price text-sm text-[#cac6bb]">
              {confirmResetMode === 'zero'
                ? 'This will clear all current store products and order records, setting inventory to zero so you can test adding new products from scratch.'
                : 'This will reset the store inventory and load the default game accounts and demo items.'}
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetMode(null)}
                className="flex-1 bg-[#282a31] text-[#e2e2ec] py-3 rounded-xl font-headline text-sm uppercase font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmResetMode === 'zero' && onResetToZero) {
                    onResetToZero();
                  } else if (onResetData) {
                    onResetData(confirmResetMode);
                  }
                  setConfirmResetMode(null);
                }}
                className="flex-1 bg-[#E8433F] hover:bg-[#ff5752] text-white py-3 rounded-xl font-headline text-sm uppercase font-bold shadow-lg"
              >
                Yes, Reset Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
