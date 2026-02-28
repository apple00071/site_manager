'use client';

import { useEffect, useState } from 'react';
import { FiDownloadCloud, FiX } from 'react-icons/fi';

/**
 * REQUIRED_NATIVE_VERSION
 * Increase this number whenever you make a change in Median (e.g., adding Location permissions, changing App Icon)
 * to force users to download the new APK.
 */
const REQUIRED_NATIVE_VERSION = 2;
// Removed expiring AWS links and external Median links.
// The APK is now hosted locally in the public folder.
const DOWNLOAD_URL = '/apple-manager.apk';

export default function NativeVersionChecker() {
    const [showBanner, setShowBanner] = useState(false);
    const [currentVersion, setCurrentVersion] = useState<number | null>(null);

    useEffect(() => {
        // Median/GoNative injects information into the window object
        // Check if we are running inside the app
        const checkVersion = () => {
            // @ts-ignore - Median global
            const isApp = !!(window.median || window.gonative || navigator.userAgent.includes('Median') || navigator.userAgent.includes('GoNative'));
            const medianVersion = window.median?.version || window.gonative?.version || 0;

            if (isApp) {
                setCurrentVersion(medianVersion);
                if (medianVersion < REQUIRED_NATIVE_VERSION) {
                    setShowBanner(true);
                }
            }
        };

        // Small delay to ensure Median bridges are ready
        const timer = setTimeout(checkVersion, 2000);
        return () => clearTimeout(timer);
    }, []);

    if (!showBanner) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-blue-600 text-white shadow-lg animate-slide-down">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <FiDownloadCloud className="h-5 w-5" />
                    <p className="font-bold text-sm">New App Version Available</p>
                </div>

                <div className="flex items-center gap-3">
                    <a
                        href={DOWNLOAD_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-1.5 bg-white text-blue-600 font-bold rounded-lg text-xs shadow-sm"
                    >
                        Update Now
                    </a>
                    <button
                        onClick={() => setShowBanner(false)}
                        className="p-1 hover:bg-black/10 rounded"
                    >
                        <FiX className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
