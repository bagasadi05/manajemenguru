
import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { DownloadCloudIcon } from './Icons';

// This is a browser event type, so we declare it for TypeScript
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed',
    platform: string,
  }>;
  prompt(): Promise<void>;
}

const PwaPrompt: React.FC = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
      // Check if user has dismissed it before in this session
      if (!sessionStorage.getItem('pwa-prompt-dismissed')) {
          setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (!installPromptEvent) {
      return;
    }
    // Show the install prompt
    installPromptEvent.prompt();
    // Wait for the user to respond to the prompt
    installPromptEvent.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      setInstallPromptEvent(null);
      setIsVisible(false);
    });
  };

  const handleDismiss = () => {
      setIsVisible(false);
      sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  }

  if (!isVisible || !installPromptEvent) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg p-4 z-[60] animate-fade-in-up">
      <div className="bg-gray-800/80 backdrop-blur-md text-white rounded-xl shadow-2xl p-4 flex items-center gap-4 border border-gray-700/50">
        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
          <DownloadCloudIcon className="w-6 h-6"/>
        </div>
        <div className="flex-grow">
          <p className="font-bold">Pasang Aplikasi Guru Cerdas</p>
          <p className="text-sm text-gray-300">Dapatkan akses cepat dan fitur offline.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" variant="ghost" onClick={handleDismiss}>Nanti</Button>
            <Button size="sm" onClick={handleInstallClick}>Pasang</Button>
        </div>
      </div>
    </div>
  );
};

export default PwaPrompt;
