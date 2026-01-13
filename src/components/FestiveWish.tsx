import React, { useEffect, useState } from 'react';

const FestiveWish = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Show only between Jan 14 and Jan 16, 2026
        const now = new Date();
        const startDate = new Date('2026-01-14T00:00:00+05:30');
        const endDate = new Date('2026-01-16T23:59:59+05:30');

        // For testing/demonstration, if you want to see it now, uncomment logic below
        // const isTestMode = true; 

        const isHolidayPeriod = now >= startDate && now <= endDate;
        const isClosed = localStorage.getItem('sankranti_wish_2026_closed') === 'true';

        if (isHolidayPeriod && !isClosed) {
            setIsVisible(true);
        }
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        localStorage.setItem('sankranti_wish_2026_closed', 'true');
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-300">
                {/* Decorative Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 opacity-90" />

                {/* Kite Patterns/Illustrations (Simplified with SVG/CSS for performance) */}
                <div className="absolute top-4 left-4 w-12 h-12 bg-yellow-300 rotate-45 opacity-40 rounded-sm shadow-lg" />
                <div className="absolute top-12 right-8 w-16 h-16 bg-pink-400 rotate-12 opacity-30 rounded-sm shadow-xl" />
                <div className="absolute bottom-10 left-10 w-20 h-20 bg-green-400 -rotate-12 opacity-20 rounded-sm shadow-2xl" />

                <div className="relative p-8 text-center text-white">
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/40 transition-colors"
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>

                    <div className="mb-6 flex justify-center">
                        <div className="relative">
                            {/* Visual Kite Icon */}
                            <svg viewBox="0 0 100 100" className="w-24 h-24 drop-shadow-lg">
                                <path d="M50 5 L90 50 L50 95 L10 50 Z" fill="#fbbf24" stroke="white" strokeWidth="2" />
                                <path d="M10 50 L90 50 M50 5 L50 95" stroke="white" strokeWidth="1" strokeDasharray="2" />
                                <path d="M50 95 L40 105 L60 105 Z" fill="#ef4444" />
                                <path d="M50 105 C55 110, 45 115, 50 120" fill="none" stroke="#fbbf24" strokeWidth="2" />
                            </svg>
                        </div>
                    </div>

                    <h2 className="text-4xl font-bold mb-4 tracking-tight">Happy Sankranti!</h2>

                    <div className="space-y-4 text-lg font-light leading-relaxed">
                        <p className="italic">"May your life be filled with the sweetness of joy and the colors of prosperity."</p>
                        <p>Wishing you and your family a bountiful harvest season and a wonderful holiday!</p>
                    </div>

                    <button
                        onClick={handleClose}
                        className="mt-8 px-8 py-3 bg-white text-blue-600 font-semibold rounded-full shadow-lg hover:bg-blue-50 transition-all transform active:scale-95"
                    >
                        Thank You
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FestiveWish;
