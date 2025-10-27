'use client';

import { useState, useEffect } from 'react';
import { FiDownload, FiX } from 'react-icons/fi';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstallPrompt(false);
    }
    
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
  };

  if (!showInstallPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <FiDownload className="h-6 w-6 text-indigo-600" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-gray-900">
            Install App
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Install this app on your device for a better experience.
          </p>
          <div className="mt-3 flex space-x-2">
            <button
              onClick={handleInstallClick}
              className="bg-indigo-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="ml-2 flex-shrink-0 text-gray-400 hover:text-gray-600"
        >
          <FiX className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
