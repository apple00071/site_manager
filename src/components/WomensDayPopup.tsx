'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'womens_day_2026_dismissed';

export default function WomensDayPopup() {
    const { user, isLoading } = useAuth();
    const [visible, setVisible] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        // Only show when user is authenticated and auth has resolved
        if (isLoading || !user) return;

        // Only show on March 8th
        const now = new Date();
        const isWomensDay = now.getMonth() === 2 && now.getDate() === 8; // Month is 0-indexed
        if (!isWomensDay) return;

        // Check if already dismissed today
        const dismissed = localStorage.getItem(STORAGE_KEY);
        if (dismissed === 'true') return;

        // Small delay so the page content loads first
        const timer = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(timer);
    }, [user, isLoading]);

    const handleClose = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        setVisible(false);
    };

    if (!mounted || !visible) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
            onClick={handleClose}
        >
            <div
                className="relative max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                style={{
                    animation: 'womensday-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                }}
            >
                {/* Close button */}
                <button
                    onClick={handleClose}
                    aria-label="Close"
                    style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        zIndex: 10,
                        background: 'rgba(0,0,0,0.45)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#fff',
                        fontSize: '18px',
                        lineHeight: 1,
                        backdropFilter: 'blur(4px)',
                    }}
                >
                    ✕
                </button>

                {/* Image */}
                <Image
                    src="/womens_day.png"
                    alt="Happy Women's Day"
                    width={420}
                    height={560}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                    priority
                />
            </div>

            <style>{`
        @keyframes womensday-pop {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
        </div>,
        document.body
    );
}
