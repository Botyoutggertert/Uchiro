import React, { useEffect, useState } from 'react';
import { Trophy, ShoppingBag, Wallet } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  username: string;
  totalUSD: number;
}

interface LeaderboardProps {
  lang: 'KM' | 'EN';
}

const MEDAL = ['🥇', '🥈', '🥉'];

export const Leaderboard: React.FC<LeaderboardProps> = ({ lang }) => {
  const [tab, setTab] = useState<'buyers' | 'topups'>('buyers');
  const [topBuyers, setTopBuyers] = useState<LeaderboardEntry[]>([]);
  const [topTopupUsers, setTopTopupUsers] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadLeaderboard = async () => {
      try {
        const res = await fetch('/api/activity/leaderboard?limit=10');
        const data = await res.json();
        if (!cancelled && data?.success) {
          setTopBuyers(data.topBuyers || []);
          setTopTopupUsers(data.topTopupUsers || []);
        }
      } catch {
        // Decorative section -- fail silently, just don't render.
      }
    };

    loadLeaderboard();
    const pollId = setInterval(loadLeaderboard, 60000);
    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, []);

  const entries = tab === 'buyers' ? topBuyers : topTopupUsers;

  if (topBuyers.length === 0 && topTopupUsers.length === 0) return null;

  return (
    <div className="w-full mt-4">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8">
        <div className="bg-[#151722]/90 border border-white/10 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-[#ffb230]/15 border border-[#ffb230]/30 flex items-center justify-center text-[#ffb230]">
                <Trophy className="w-3.5 h-3.5" />
              </div>
              <h2 className="font-user font-bold text-xs sm:text-sm text-[#ffd7a1] uppercase tracking-wider">
                {lang === 'KM' ? 'តារាងអ្នកឈ្នះ' : 'Leaderboard'}
              </h2>
            </div>

            <div className="flex items-center gap-1 bg-[#0D0E14] border border-white/10 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setTab('buyers')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] sm:text-[11px] font-bold transition-all ${
                  tab === 'buyers' ? 'bg-[#ffb230] text-[#291800]' : 'text-[#8B90A0] hover:text-white'
                }`}
              >
                <ShoppingBag className="w-3 h-3" />
                <span>{lang === 'KM' ? 'អ្នកទិញកំពូល' : 'Top Buyers'}</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('topups')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] sm:text-[11px] font-bold transition-all ${
                  tab === 'topups' ? 'bg-[#06B6D4] text-[#03181c]' : 'text-[#8B90A0] hover:text-white'
                }`}
              >
                <Wallet className="w-3 h-3" />
                <span>{lang === 'KM' ? 'អ្នកបញ្ចូលលុយកំពូល' : 'Top Top-Ups'}</span>
              </button>
            </div>
          </div>

          {entries.length === 0 ? (
            <p className="text-xs text-[#8B90A0] text-center py-4">
              {lang === 'KM' ? 'មិនទាន់មានទិន្នន័យនៅឡើយទេ' : 'No data yet'}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {entries.map((entry) => (
                <div
                  key={`${tab}-${entry.rank}-${entry.username}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${
                    entry.rank <= 3
                      ? 'bg-gradient-to-r from-[#ffb230]/10 to-transparent border-[#ffb230]/25'
                      : 'bg-[#0D0E14]/60 border-white/5'
                  }`}
                >
                  <span className="w-6 text-center text-sm shrink-0">
                    {MEDAL[entry.rank - 1] || (
                      <span className="text-[11px] font-bold text-[#8B90A0]">#{entry.rank}</span>
                    )}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-[12px] sm:text-[13px] font-bold text-white">
                    {entry.username}
                  </span>
                  <span
                    className={`text-[12px] sm:text-[13px] font-bold shrink-0 ${
                      tab === 'buyers' ? 'text-[#ffb230]' : 'text-[#06B6D4]'
                    }`}
                  >
                    ${entry.totalUSD.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
