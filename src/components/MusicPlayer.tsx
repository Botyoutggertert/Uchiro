import React, { useState, useRef, useEffect } from 'react';
import { SongTrack } from '../types';
import { Music, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, ChevronDown, ChevronUp } from 'lucide-react';

interface MusicPlayerProps {
  songs: SongTrack[];
  enabled?: boolean;
  defaultVolume?: number;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({ songs, enabled = true, defaultVolume = 0.4 }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [volume, setVolume] = useState(defaultVolume);
  const [isMuted, setIsMuted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentSong = songs[currentSongIndex] || songs[0];

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    if (currentSong?.url) {
      audio.src = currentSong.url;
      audio.volume = isMuted ? 0 : volume;
      if (isPlaying) {
        audio.play().catch(() => {
          // Browser autoplay policy might block before user gesture
          setIsPlaying(false);
        });
      }
    }

    const handleEnded = () => {
      handleNext();
    };

    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentSongIndex, songs]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.warn('Audio playback error:', e);
      });
    }
  };

  const handleNext = () => {
    if (songs.length === 0) return;
    setCurrentSongIndex((prev) => (prev + 1) % songs.length);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    if (songs.length === 0) return;
    setCurrentSongIndex((prev) => (prev - 1 + songs.length) % songs.length);
    setIsPlaying(true);
  };

  if (!enabled || !currentSong) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-40">
      {isCollapsed ? (
        <button
          onClick={() => setIsCollapsed(false)}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-full border shadow-xl backdrop-blur-md transition-all active:scale-95 ${
            isPlaying
              ? 'bg-[#1C1F29]/95 border-[#ffb230]/50 text-[#ffd7a1] shadow-[0_0_15px_rgba(255,178,48,0.25)]'
              : 'bg-[#11131a]/90 border-white/10 text-[#8B90A0] hover:text-[#ffd7a1]'
          }`}
          title="Uchiro Ambient BGM Player"
        >
          <div className="relative">
            <Music className={`w-4 h-4 ${isPlaying ? 'text-[#ffb230] animate-bounce' : ''}`} />
            {isPlaying && (
              <span className="w-2 h-2 rounded-full bg-[#3ECF8E] absolute -top-1 -right-1 animate-ping" />
            )}
          </div>
          <span className="font-price text-xs font-bold max-w-[120px] truncate">
            {isPlaying ? currentSong.title : 'BGM Player'}
          </span>
          <div
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="w-6 h-6 rounded-full bg-[#ffb230] text-[#291800] flex items-center justify-center font-bold hover:scale-105"
          >
            {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
          </div>
        </button>
      ) : (
        <div className="w-72 bg-[#1C1F29]/95 border border-[#ffb230]/30 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[#ffb230]">
              <Music className="w-3.5 h-3.5" />
              <span className="font-headline text-[11px] uppercase tracking-wider">
                UCHIRO AMBIENT BGM
              </span>
            </div>
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-[#8B90A0] hover:text-white p-1 rounded-md"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Current Song Info & Visualizer */}
          <div className="bg-[#11131a] p-2.5 rounded-xl border border-white/5 flex items-center justify-between mb-3">
            <div className="overflow-hidden pr-2">
              <h4 className="font-sans text-xs font-bold text-[#e2e2ec] truncate">
                {currentSong.title}
              </h4>
              <p className="font-price text-[10px] text-[#8B90A0] truncate">
                {currentSong.artist}
              </p>
            </div>
            {/* Equalizer animation */}
            <div className="flex items-end gap-0.5 h-4 shrink-0">
              <span className={`w-1 bg-[#ffb230] rounded-full transition-all duration-300 ${isPlaying ? 'h-4 animate-pulse' : 'h-1.5'}`} />
              <span className={`w-1 bg-[#ffb230] rounded-full transition-all duration-300 delay-75 ${isPlaying ? 'h-3 animate-pulse' : 'h-2'}`} />
              <span className={`w-1 bg-[#ffb230] rounded-full transition-all duration-300 delay-150 ${isPlaying ? 'h-4 animate-pulse' : 'h-1'}`} />
            </div>
          </div>

          {/* Player Controls */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-lg bg-[#11131a] text-[#8B90A0] hover:text-[#ffd7a1] border border-white/5 transition-colors"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={togglePlay}
              className="flex-1 py-1.5 rounded-xl bg-[#ffb230] text-[#291800] font-headline text-xs font-bold uppercase flex items-center justify-center gap-1.5 chunky-btn-gold"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play Music</span>
                </>
              )}
            </button>

            <button
              onClick={handleNext}
              className="p-1.5 rounded-lg bg-[#11131a] text-[#8B90A0] hover:text-[#ffd7a1] border border-white/5 transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-white/5">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-[#8B90A0] hover:text-[#ffd7a1]"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-[#E8433F]" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-[#3ECF8E]" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                setIsMuted(false);
              }}
              className="w-full h-1 bg-[#11131a] rounded-lg appearance-none cursor-pointer accent-[#ffb230]"
            />
            <span className="font-price text-[10px] text-[#8B90A0] w-6 text-right">
              {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
