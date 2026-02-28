'use client';

import { useEffect, useState } from 'react';
import { FiDownloadCloud, FiX } from 'react-icons/fi';

/**
 * REQUIRED_NATIVE_VERSION
 * Increase this number whenever you make a change in Median (e.g., adding Location permissions, changing App Icon)
 * to force users to download the new APK.
 */
const REQUIRED_NATIVE_VERSION = 2;
// Hosted permanently in Supabase 'public-assets' bucket
const DOWNLOAD_URL = 'https://uswdtcmemgfqlkzmfkxs.supabase.co/storage/v1/object/public/public-assets/apple-manager.apk';

export default function NativeVersionChecker() {
    const [showBanner, setShowBanner] = useState(false);
    const [currentVersion, setCurrentVersion] = useState<number | null>(null);

    useEffect(() => {
        // Median/GoNative injects information into the window object
        // Check if we are running inside the app
        const checkVersion = () => {
            const ua = navigator.userAgent;
            // @ts-ignore - Median global
            const isApp = !!(window.median || window.gonative || ua.includes('Median') || ua.includes('GoNative'));

            // Try JS Bridge first
            let medianVersion = window.median?.version || window.gonative?.version || 0;

            // Fallback: Parse from user string (e.g., "Median_1.0.0" or "gonative_1")
            // Median injects something like `median_version/X` depending on configuration
            if (medianVersion === 0) {
                const match = ua.match(/(?:median|gonative)[_\s/v]*version[\s/v]*(\d+)/i) ||
                    ua.match(/(?:median|gonative)[_\s/v]*(\d+)/i);
                if (match && match[1]) {
                    medianVersion = parseInt(match[1], 10);
                }
            }

            if (isApp) {
                setCurrentVersion(medianVersion);
                // Only show banner if version is definitively less than required AND we managed to parse a number
                if (medianVersion > 0 && medianVersion < REQUIRED_NATIVE_VERSION) {
                    setShowBanner(true);
                }
            }
        };

        // Small delay to ensure Median bridges are ready
        const timer = setTimeout(checkVersion, 2500);
        return () => clearTimeout(timer);
    }, []);

    const handleDownload = (e: React.MouseEvent) => {
        e.preventDefault();
        // Force the URL to open in the device's default external browser (e.g., Chrome).
        // This is crucial for Android WebViews because native browsers handle the actual 
        // downloading of .apk files with proper progress indicators and install prompts.
        // @ts-ignore
        if (window.median && window.median.open && window.median.open.external) {
            // @ts-ignore
            window.median.open.external({ url: DOWNLOAD_URL });
        } else {
            window.open(DOWNLOAD_URL, '_blank');
        }
    };

    if (!showBanner) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-blue-600 text-white shadow-lg animate-slide-down">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <FiDownloadCloud className="h-5 w-5" />
                    <div className="flex flex-col">
                        <p className="font-bold text-sm">New App Version Available</p>
                        <p className="text-[10px] text-blue-200 opacity-70">App reports v{currentVersion} (Needs v{REQUIRED_NATIVE_VERSION})</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleDownload}
                        className="px-4 py-1.5 bg-white text-blue-600 font-bold rounded-lg text-xs shadow-sm"
                    >
                        Update Now
                    </button>
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
