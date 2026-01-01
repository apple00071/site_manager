'use client';

import { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import { useAuth } from '@/contexts/AuthContext';

export default function NewYearPopup() {
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        // Check if the popup has already been shown this year
        const hasShown = localStorage.getItem('new_year_2026_shown');

        // Only show if not shown before AND user is logged in
        // Putting a small delay for better entrance feel
        if (!hasShown && user) {
            const timer = setTimeout(() => {
                setIsOpen(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [user]);

    const handleClose = () => {
        setIsOpen(false);
        localStorage.setItem('new_year_2026_shown', 'true');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-500">
            <div className="relative w-full max-w-lg overflow-hidden bg-slate-900 rounded-3xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-500">

                {/* Festive Background Elements */}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30">
                    <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-yellow-500/20 rounded-full blur-[100px]" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] bg-indigo-500/20 rounded-full blur-[100px]" />

                    {/* Firework Sparks */}
                    <div className="absolute top-10 left-10 w-2 h-2 bg-yellow-400 rounded-full animate-ping" />
                    <div className="absolute top-20 right-20 w-1 h-1 bg-white rounded-full animate-ping [animation-delay:1s]" />
                    <div className="absolute bottom-20 left-1/2 w-1.5 h-1.5 bg-yellow-200 rounded-full animate-ping [animation-delay:0.5s]" />
                </div>

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors z-10"
                >
                    <FiX className="w-6 h-6" />
                </button>

                <div className="relative p-8 text-center flex flex-col items-center">
                    {/* Logo */}
                    <img
                        src="/New-logo.png"
                        alt="Apple Interior Manager"
                        className="h-16 mb-6 drop-shadow-lg"
                    />

                    <h2 className="text-sm font-semibold tracking-[0.2em] uppercase text-yellow-500 mb-2">
                        Welcome to 2026
                    </h2>

                    <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight drop-shadow-sm">
                        Happy <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-500">New Year</span>
                    </h1>

                    <p className="text-lg text-slate-300 mb-8 max-w-[280px] sm:max-w-none">
                        Wishing you a year filled with <span className="text-yellow-400 font-medium">innovation</span>,
                        <span className="text-yellow-400 font-medium ml-1">creativity</span>, and
                        <span className="text-yellow-400 font-medium ml-1">success</span>.
                    </p>

                    <button
                        onClick={handleClose}
                        className="group relative inline-flex items-center justify-center px-8 py-3 font-bold text-slate-900 bg-yellow-500 rounded-full overflow-hidden transition-all hover:bg-yellow-400 active:scale-95 shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                    >
                        <span className="relative">Let's Build It!</span>
                        <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
                            <div className="relative h-full w-8 bg-white/30" />
                        </div>
                    </button>
                </div>

                {/* Bottom Decorative Line */}
                <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50" />
            </div>

            <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zoom-in-95 {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-in {
          animation: fade-in 0.5s ease-out;
        }
        .zoom-in-95 {
          animation: zoom-in-95 0.5s ease-out;
        }
      `}</style>
        </div>
    );
}
