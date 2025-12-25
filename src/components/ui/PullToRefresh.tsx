'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FiRefreshCw } from 'react-icons/fi';

interface PullToRefreshProps {
    children: React.ReactNode;
    onRefresh?: () => Promise<void>;
    disabled?: boolean;
}

export function PullToRefresh({ children, onRefresh, disabled = false }: PullToRefreshProps) {
    const [isPulling, setIsPulling] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const currentY = useRef(0);

    const PULL_THRESHOLD = 80; // Distance needed to trigger refresh
    const MAX_PULL = 120; // Maximum pull distance

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (disabled || isRefreshing) return;

        // Only start pull if at top of page
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        if (scrollTop > 0) return;

        startY.current = e.touches[0].clientY;
        setIsPulling(true);
    }, [disabled, isRefreshing]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!isPulling || disabled || isRefreshing) return;

        currentY.current = e.touches[0].clientY;
        const diff = currentY.current - startY.current;

        // Only allow pulling down, not up
        if (diff < 0) {
            setPullDistance(0);
            return;
        }

        // Apply resistance to the pull
        const resistance = 0.4;
        const distance = Math.min(diff * resistance, MAX_PULL);
        setPullDistance(distance);

        // Prevent default scrolling when pulling
        if (distance > 0) {
            e.preventDefault();
        }
    }, [isPulling, disabled, isRefreshing]);

    const handleTouchEnd = useCallback(async () => {
        if (!isPulling || disabled) return;

        setIsPulling(false);

        if (pullDistance >= PULL_THRESHOLD) {
            setIsRefreshing(true);
            setPullDistance(PULL_THRESHOLD / 2); // Keep indicator visible during refresh

            try {
                if (onRefresh) {
                    await onRefresh();
                } else {
                    // Default: reload the page
                    window.location.reload();
                }
            } catch (error) {
                console.error('Refresh failed:', error);
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            setPullDistance(0);
        }
    }, [isPulling, pullDistance, onRefresh, disabled]);

    useEffect(() => {
        const container = document.body;

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
    const rotation = progress * 180;

    return (
        <div ref={containerRef} className="relative">
            {/* Pull to refresh indicator */}
            <div
                className="fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-opacity duration-200"
                style={{
                    top: `${Math.max(pullDistance - 40, 0)}px`,
                    opacity: pullDistance > 10 ? 1 : 0,
                }}
            >
                <div
                    className={`w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center border border-gray-200 ${isRefreshing ? 'animate-spin' : ''
                        }`}
                    style={{
                        transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
                    }}
                >
                    <FiRefreshCw
                        className={`w-5 h-5 ${progress >= 1 || isRefreshing ? 'text-yellow-500' : 'text-gray-400'
                            }`}
                    />
                </div>
            </div>

            {/* Content wrapper with pull transform */}
            <div
                style={{
                    transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
                    transition: isPulling ? 'none' : 'transform 0.2s ease-out',
                }}
            >
                {children}
            </div>
        </div>
    );
}
