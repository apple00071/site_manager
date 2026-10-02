'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiZoomIn,
  FiZoomOut,
  FiRotateCcw,
  FiGrid,
} from 'react-icons/fi';

const openExternalLink = (url: string) => {
  if (!url) return;

  // Median / GoNative support
  // @ts-ignore
  if (typeof window !== 'undefined' && window.median && window.median.open && window.median.open.external) {
    // @ts-ignore
    window.median.open.external({ url });
    return;
  }

  // Capacitor support
  // @ts-ignore
  if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
    try {
      // @ts-ignore
      window.Capacitor.Plugins.Browser.open({ url });
      return;
    } catch (e) {
      console.error('Capacitor browser open failed', e);
    }
  }

  // Standard window.open fallback
  if (typeof window !== 'undefined') {
    window.open(url, '_blank');
  }
};

type ImageModalProps = {
  images: string[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (index: number) => void;
  showThumbnailsDefault?: boolean;
};

export function ImageModal({
  images,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
  showThumbnailsDefault = false,
}: ImageModalProps) {
  const [activeIndex, setActiveIndex] = useState(currentIndex);
  const [mounted, setMounted] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [showThumbnails, setShowThumbnails] = useState(showThumbnailsDefault);

  const modalRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);

  // Helper function to check if URL is a PDF
  const isPDF = (url: string | undefined) => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return lowerUrl.endsWith('.pdf') || lowerUrl.includes('.pdf?') || lowerUrl.includes('/pdf');
  };

  const currentUrl = images[activeIndex] || '';
  const isCurrentPDF = isPDF(currentUrl);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsDragging(false);
  }, []);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(4, Number((prev + 0.5).toFixed(2))));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(1, Number((prev - 0.5).toFixed(2)));
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2.5);
    }
  };

  const handlePrevious = useCallback(() => {
    resetZoom();
    const newIndex = activeIndex > 0 ? activeIndex - 1 : images.length - 1;
    setActiveIndex(newIndex);
    onNavigate?.(newIndex);
  }, [activeIndex, images.length, onNavigate, resetZoom]);

  const handleNext = useCallback(() => {
    resetZoom();
    const newIndex = activeIndex < images.length - 1 ? activeIndex + 1 : 0;
    setActiveIndex(newIndex);
    onNavigate?.(newIndex);
  }, [activeIndex, images.length, onNavigate, resetZoom]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setActiveIndex(currentIndex);
    resetZoom();
  }, [currentIndex, resetZoom]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        resetZoom();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehaviorY = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehaviorY = 'none';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.documentElement.style.overflow = '';
      document.documentElement.style.overscrollBehaviorY = '';
      document.body.style.overflow = '';
      document.body.style.overscrollBehaviorY = '';
    };
  }, [isOpen, handlePrevious, handleNext, onClose, resetZoom]);

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (isCurrentPDF) return;
    e.stopPropagation();
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))));
    } else {
      setScale((prev) => {
        const next = Math.max(1, Number((prev - 0.25).toFixed(2)));
        if (next === 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Mouse pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1 || isCurrentPDF) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setStartPan({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile pan & pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isCurrentPDF) return;

    if (e.touches.length === 2) {
      // Pinch start
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistanceRef.current = dist;
      pinchStartScaleRef.current = scale;
      setIsDragging(false);
    } else if (e.touches.length === 1) {
      // Check double tap
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        handleDoubleTap(e);
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      // Pan start
      if (scale > 1) {
        setIsDragging(true);
        setStartPan({
          x: e.touches[0].clientX - position.x,
          y: e.touches[0].clientY - position.y,
        });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isCurrentPDF) return;

    if (e.touches.length === 2 && pinchStartDistanceRef.current !== null) {
      // Pinching
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / pinchStartDistanceRef.current;
      const newScale = Math.min(4, Math.max(1, Number((pinchStartScaleRef.current * factor).toFixed(2))));
      setScale(newScale);
      if (newScale === 1) setPosition({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      // Panning
      e.preventDefault();
      setPosition({
        x: e.touches[0].clientX - startPan.x,
        y: e.touches[0].clientY - startPan.y,
      });
    }
  };

  const handleTouchEnd = () => {
    pinchStartDistanceRef.current = null;
    setIsDragging(false);
  };

  if (!isOpen || !images.length || !mounted || !currentUrl) return null;

  const content = (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 select-none"
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Header Controls Bar */}
      <div className="absolute top-3 left-3 right-3 z-[170] flex items-center justify-between pointer-events-none">
        {/* Left: Counter badge */}
        <div className="pointer-events-auto flex items-center gap-2">
          {images.length > 1 && (
            <span className="px-3 py-1.5 bg-black/60 backdrop-blur-md text-white text-xs font-semibold rounded-full border border-white/10 shadow-lg">
              {activeIndex + 1} / {images.length}
            </span>
          )}
        </div>

        {/* Right: Zoom controls, thumbnail toggle, and Close */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 bg-black/60 backdrop-blur-md p-1 sm:p-1.5 rounded-full border border-white/10 shadow-lg">
          {!isCurrentPDF && (
            <>
              {/* Zoom Out */}
              <button
                onClick={handleZoomOut}
                disabled={scale <= 1}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Zoom Out (-)"
                aria-label="Zoom Out"
              >
                <FiZoomOut className="w-4 h-4" />
              </button>

              {/* Zoom Scale Pill */}
              <button
                onClick={resetZoom}
                className="px-2 py-0.5 text-[11px] font-bold text-yellow-400 hover:text-yellow-300 transition cursor-pointer"
                title="Click to reset zoom"
              >
                {Math.round(scale * 100)}%
              </button>

              {/* Zoom In */}
              <button
                onClick={handleZoomIn}
                disabled={scale >= 4}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Zoom In (+)"
                aria-label="Zoom In"
              >
                <FiZoomIn className="w-4 h-4" />
              </button>

              {/* Reset Zoom Button */}
              {scale > 1 && (
                <button
                  onClick={resetZoom}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition cursor-pointer"
                  title="Reset Zoom (1:1)"
                  aria-label="Reset Zoom"
                >
                  <FiRotateCcw className="w-4 h-4" />
                </button>
              )}
            </>
          )}

          {/* Toggle Thumbnails Strip (hidden by default) */}
          {images.length > 1 && (
            <button
              onClick={() => setShowThumbnails((prev) => !prev)}
              className={`p-2 rounded-full transition cursor-pointer ${
                showThumbnails
                  ? 'text-yellow-400 bg-white/20'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              title={showThumbnails ? 'Hide thumbnail strip' : 'Show thumbnail strip'}
              aria-label="Toggle thumbnails"
            >
              <FiGrid className="w-4 h-4" />
            </button>
          )}

          <div className="w-[1px] h-4 bg-white/20 mx-0.5" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 text-white/90 hover:text-white hover:bg-white/20 rounded-full transition cursor-pointer"
            aria-label="Close modal"
            title="Close (Esc)"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Previous Button */}
      {images.length > 1 && (
        <button
          onClick={handlePrevious}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-[160] p-2.5 sm:p-3 text-white hover:text-yellow-400 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full transition shadow-lg cursor-pointer border border-white/10"
          aria-label="Previous image"
        >
          <FiChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Next Button */}
      {images.length > 1 && (
        <button
          onClick={handleNext}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-[160] p-2.5 sm:p-3 text-white hover:text-yellow-400 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full transition shadow-lg cursor-pointer border border-white/10"
          aria-label="Next image"
        >
          <FiChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Main Content - Image with Zoom & Pan */}
      <div
        className="relative w-full h-full flex items-center justify-center p-2 sm:p-8 overflow-hidden"
        onClick={() => {
          if (scale === 1) onClose();
        }}
      >
        {isCurrentPDF ? (
          <div className="w-full h-full flex flex-col items-center justify-center max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <iframe
              src={
                typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
                  ? `https://docs.google.com/viewer?url=${encodeURIComponent(currentUrl)}&embedded=true`
                  : currentUrl
              }
              className="w-full h-full rounded-lg shadow-2xl bg-white"
              title={`PDF ${activeIndex + 1}`}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                openExternalLink(currentUrl);
              }}
              className="mt-4 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-medium text-xs sm:text-sm rounded-lg shadow transition flex items-center gap-2 cursor-pointer"
            >
              📄 Open PDF in System App
            </button>
          </div>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={currentUrl}
              alt={`Image ${activeIndex + 1}`}
              draggable={false}
              onMouseDown={handleMouseDown}
              onDoubleClick={handleDoubleTap}
              onClick={(e) => e.stopPropagation()}
              style={{
                transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                touchAction: 'none',
              }}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl will-change-transform"
              onError={(e) => {
                if (!isPDF(currentUrl)) {
                  console.error('Failed to load image:', currentUrl);
                }
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}
      </div>

      {/* Optional Thumbnail Strip (HIDDEN by default so it never blocks watermarks / bottom of photo) */}
      {showThumbnails && images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[160] flex gap-2 bg-black/75 backdrop-blur-md p-2 rounded-2xl max-w-sm sm:max-w-md overflow-x-auto border border-white/10 shadow-2xl">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => {
                resetZoom();
                setActiveIndex(index);
                onNavigate?.(index);
              }}
              className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all duration-200 flex items-center justify-center cursor-pointer ${
                index === activeIndex
                  ? 'border-yellow-400 opacity-100 scale-105'
                  : 'border-transparent opacity-60 hover:opacity-90'
              }`}
            >
              {isPDF(image) ? (
                <div className="w-full h-full bg-red-100 flex items-center justify-center text-[10px] font-bold text-red-700">
                  PDF
                </div>
              ) : (
                <img
                  src={image}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Mobile Swipe Left / Right touch zones (only active at 1x zoom so they don't hijack pan gestures) */}
      {scale === 1 && images.length > 1 && (
        <div className="absolute inset-0 z-40 lg:hidden pointer-events-none">
          <div
            className="absolute left-0 top-16 w-1/4 h-[75%] pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              handlePrevious();
            }}
          />
          <div
            className="absolute right-0 top-16 w-1/4 h-[75%] pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
          />
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}
