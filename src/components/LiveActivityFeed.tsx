import React, { useEffect, useState } from 'react';
import { ShoppingBag, Wallet, Sparkles } from 'lucide-react';

interface LiveFeedEvent {
  type: 'purchase' | 'topup';
  username: string;
  label: string;
  amountUSD: number;
  timestamp: number;
}

interface LiveActivityFeedProps {
  lang: 'KM' | 'EN';
}

export const LiveActivityFeed: React.FC<LiveActivityFeedProps> = ({ lang }) => {
  const [events, setEvents] = useState<LiveFeedEvent[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Poll the server every 20s for fresh activity
  useEffect(() => {
    let cancelled = false;

    const loadFeed = async () => {
      try {
        const res = await fetch('/api/activity/live-feed?limit=15');
        const data = await res.json();
        if (!cancelled && data?.success && Array.isArray(data.feed)) {
          setEvents(data.feed);
        }
      } catch {
        // Silently ignore -- this is a decorative trust signal, not critical UI.
      }
    };

    loadFeed();
    const pollId = setInterval(loadFeed, 20000);
    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, []);

  // Rotate which event is shown every 4s
  useEffect(() => {
    if (events.length === 0) return;
    const rotateId = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % events.length);
    }, 4000);
    return () => clearInterval(rotateId);
  }, [events.length]);

  if (events.length === 0) return null;

  const event = events[activeIndex % events.length];
  const isTopup = event.type === 'topup';

  return (
    <div className="w-full mt-4 mb-2">
      <div className="max-w-[1280px] mx-auto px-4 md:px-8">
        <div className="flex items-center gap-2.5 bg-[#151722]/90 border border-white/10 rounded-xl px-3.5 py-2.5 overflow-hidden">
          <div className="relative shrink-0">
            <span className="absolute inset-0 rounded-full bg-[#3ECF8E]/40 animate-ping" />
            <span className="relative block w-2 h-2 rounded-full bg-[#3ECF8E]" />
          </div>

          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isTopup ? 'bg-[#06B6D4]/15 text-[#06B6D4]' : 'bg-[#ffb230]/15 text-[#ffb230]'
            }`}
          >
            {isTopup ? <Wallet className="w-3.5 h-3.5" /> : <ShoppingBag className="w-3.5 h-3.5" />}
          </div>

          <div key={`${event.username}-${event.timestamp}-${activeIndex}`} className="flex-1 min-w-0 animate-fade-in">
            <p className="text-[12px] sm:text-[13px] text-[#e2e2ec] truncate">
              <span className="font-bold text-white">{event.username}</span>{' '}
              {isTopup
                ? lang === 'KM'
                  ? 'បានបញ្ចូលលុយចំនួន'
                  : 'just topped up'
                : lang === 'KM'
                ? 'បានទិញ'
                : 'just bought'}{' '}
              {!isTopup && <span className="text-[#ffd7a1]">{event.label}</span>}{' '}
              <span className="font-bold text-[#3ECF8E]">${event.amountUSD.toFixed(2)}</span>
            </p>
          </div>

          <Sparkles className="w-3.5 h-3.5 text-[#ffb230] shrink-0 hidden sm:block" />
        </div>
      </div>
    </div>
  );
};
