import React from 'react';
import { useOfflineStatus } from '../hooks/useOfflineStatus';
import { AlertTriangleIcon } from './Icons';

const OfflineBanner: React.FC = () => {
  const isOnline = useOfflineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-yellow-400 dark:bg-yellow-500 text-gray-900 dark:text-black p-3 text-center text-sm font-semibold z-50 flex items-center justify-center gap-2 animate-fade-in"
      role="status"
    >
      <AlertTriangleIcon className="w-5 h-5" />
      <span>Anda sedang offline. Beberapa fitur mungkin dinonaktifkan.</span>
    </div>
  );
};

export default OfflineBanner;
