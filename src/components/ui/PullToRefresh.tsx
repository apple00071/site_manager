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
    const canPull = useRef(false); // Track if pull gesture is valid
    const pullStarted = useRef(false); // Track if pull has actually started

    const PULL_THRESHOLD = 80; // Distance needed to trigger refresh
    const MAX_PULL = 120; // Maximum pull distance
    const ACTIVATION_THRESHOLD = 15; // Minimum downward movement to activate pull

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (disabled || isRefreshing) return;

        // Check if touch started inside a modal, bottom sheet, or side panel
        const target = e.target as HTMLElement;
        const isInsideOverlay = target.closest('[data-modal]') ||
            target.closest('[data-bottom-sheet]') ||
            target.closest('[data-side-panel]') ||
            target.closest('[role="dialog"]') ||
            target.closest('.fixed.inset-0') ||
            target.closest('.fixed.inset-x-0');
        if (isInsideOverlay) return;

        // Only allow pull if at very top of page
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        if (scrollTop > 5) {
            canPull.current = false;
            return;
        }

        startY.current = e.touches[0].clientY;
        canPull.current = true;
        pullStarted.current = false;
    }, [disabled, isRefreshing]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!canPull.current || disabled || isRefreshing) return;

        // Re-check scroll position - if user scrolled down, disable pull
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        if (scrollTop > 5) {
            canPull.current = false;
            setIsPulling(false);
            setPullDistance(0);
            return;
        }

        currentY.current = e.touches[0].clientY;
        const diff = currentY.current - startY.current;

        // Only allow pulling down, not up
        if (diff < 0) {
            if (pullStarted.current) {
                setPullDistance(0);
                setIsPulling(false);
                pullStarted.current = false;
            }
            return;
        }

        // Only start pull mode after passing activation threshold
        if (!pullStarted.current) {
            if (diff >= ACTIVATION_THRESHOLD) {
                pullStarted.current = true;
                setIsPulling(true);
                // Adjust startY to make the pull feel natural
                startY.current = currentY.current - ACTIVATION_THRESHOLD;
            } else {
                return; // Don't do anything until threshold is reached
            }
        }

        // Apply resistance to the pull
        const resistance = 0.4;
        const distance = Math.min((currentY.current - startY.current) * resistance, MAX_PULL);
        setPullDistance(distance);

        // Prevent default scrolling when pulling
        if (distance > 0) {
            e.preventDefault();
        }
    }, [disabled, isRefreshing]);

    const handleTouchEnd = useCallback(async () => {
        // Reset refs
        canPull.current = false;
        pullStarted.current = false;

        if (!isPulling || disabled) {
            setPullDistance(0);
            return;
        }

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
