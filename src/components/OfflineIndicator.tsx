import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) {
    return null;
  }

  if (showReconnected) {
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xl animate-in fade-in slide-in-from-bottom-2">
        <Wifi className="w-4 h-4" />
        <span>تمت استعادة الاتصال بالشبكة — المزامنة فورية</span>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-xl animate-in fade-in slide-in-from-bottom-2 border border-amber-400/40">
      <WifiOff className="w-4 h-4 animate-pulse" />
      <div>
        <p>وضع عدم الاتصال (Offline)</p>
        <p className="text-[10px] font-normal text-amber-100">الطلبات تُحفظ محلياً وتُزامن فور عودة الإنترنت</p>
      </div>
    </div>
  );
};
