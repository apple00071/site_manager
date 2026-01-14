'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';

const FestiveWish = () => {
    const { user, isLoading } = useAuth();
    const pathname = usePathname();
    const [isVisible, setIsVisible] = useState(false);
    const [wishImage, setWishImage] = useState('/bhogi_wish.png');

    useEffect(() => {
        // Hide if loading, or no user, or on auth pages
        const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/register');

        if (isLoading || !user || isAuthPage) {
            setIsVisible(false);
            return;
        }

        const now = new Date();
        const day = now.getDate();
        const month = now.getMonth(); // 0 is January
        const year = now.getFullYear();

        // Show interval: Jan 14 - Jan 16, 2026
        const startDate = new Date('2026-01-14T00:00:00+05:30');
        const endDate = new Date('2026-01-16T23:59:59+05:30');
        const isHolidayPeriod = now >= startDate && now <= endDate;

        // Determine Image based on Date
        if (year === 2026 && month === 0) {
            if (day === 14) {
                setWishImage('/bhogi_wish.png');
            } else {
                setWishImage('/sankranti_wish.png');
            }
        }

        const isClosed = localStorage.getItem(`festive_wish_2026_${day}_closed`) === 'true';

        if (isHolidayPeriod && !isClosed) {
            setIsVisible(true);
        }
    }, [user, isLoading, pathname]);

    const handleClose = () => {
        setIsVisible(false);
        const day = new Date().getDate();
        localStorage.setItem(`festive_wish_2026_${day}_closed`, 'true');
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-500">
            <div className="relative w-full max-w-[400px] max-h-[90vh] overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_70px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-500 border border-white/20 flex flex-col">
                {/* Close Button Overlay */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 rounded-full bg-black/10 hover:bg-black/20 text-gray-700 transition-all z-20 hover:scale-110 active:scale-90"
                    aria-label="Close"
                >
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>

                {/* The Premium Poster Image */}
                <div className="overflow-y-auto scrollbar-hide">
                    <img
                        src={wishImage}
                        alt="Festive Greeting"
                        className="w-full h-auto block object-contain"
                    />
                </div>
            </div>
        </div>
    );
};

export default FestiveWish;
