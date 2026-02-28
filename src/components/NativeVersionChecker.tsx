'use client';

import { useEffect, useState } from 'react';
import { FiDownloadCloud, FiX } from 'react-icons/fi';

/**
 * REQUIRED_NATIVE_VERSION
 * Increase this number whenever you make a change in Median (e.g., adding Location permissions, changing App Icon)
 * to force users to download the new APK.
 */
const REQUIRED_NATIVE_VERSION = 1; // Start at 1

export default function NativeVersionChecker() {
    const [showBanner, setShowBanner] = useState(false);
    const [currentVersion, setCurrentVersion] = useState<number | null>(null);

    useEffect(() => {
        // Median/GoNative injects information into the window object
        // Check if we are running inside the app
        const checkVersion = () => {
            // @ts-ignore - Median global
            const medianVersion = window.median?.version || window.gonative?.version || 0;

            if (typeof medianVersion === 'number' && medianVersion > 0) {
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
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-blue-600 text-white p-4 shadow-lg animate-slide-down">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500 rounded-lg">
                        <FiDownloadCloud className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="font-bold text-sm">New App Version Available</p>
                        <p className="text-xs text-blue-100 italic">Required for new features like Location & Attendance</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowBanner(false)}
                        className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
                    >
                        <FiX />
                    </button>
                </div>
            </div>
        </div>
    );
}
