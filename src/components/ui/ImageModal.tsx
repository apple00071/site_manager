'use client';

import { useState, useEffect } from 'react';
import { FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

type ImageModalProps = {
  images: string[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (index: number) => void;
};

export function ImageModal({ images, currentIndex, isOpen, onClose, onNavigate }: ImageModalProps) {
  const [activeIndex, setActiveIndex] = useState(currentIndex);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setActiveIndex(currentIndex);
  }, [currentIndex]);

  const handlePrevious = () => {
    const newIndex = activeIndex > 0 ? activeIndex - 1 : images.length - 1;
    setActiveIndex(newIndex);
    onNavigate?.(newIndex);
  };

  const handleNext = () => {
    const newIndex = activeIndex < images.length - 1 ? activeIndex + 1 : 0;
    setActiveIndex(newIndex);
    onNavigate?.(newIndex);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, activeIndex, handlePrevious, handleNext, onClose]);

  // Early return AFTER all hooks to prevent hooks rule violation
  if (!isOpen || !images.length) return null;

  // Don't render until mounted to prevent hydration issues
  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-95">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-60 p-3 text-white hover:text-gray-300 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition-all duration-200 touch-target"
        aria-label="Close modal"
      >
        <FiX className="w-6 h-6" />
      </button>

      {/* Image Counter */}
      {images.length > 1 && (
        <div className="absolute top-4 left-4 z-60 px-3 py-2 bg-black bg-opacity-50 text-white text-sm rounded-full">
          {activeIndex + 1} / {images.length}
        </div>
      )}

      {/* Previous Button */}
      {images.length > 1 && (
        <button
          onClick={handlePrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-60 p-3 text-white hover:text-gray-300 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition-all duration-200 touch-target"
          aria-label="Previous image"
        >
          <FiChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Next Button */}
      {images.length > 1 && (
        <button
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-60 p-3 text-white hover:text-gray-300 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition-all duration-200 touch-target"
          aria-label="Next image"
        >
          <FiChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Main Image */}
      <div 
        className="relative w-full h-full flex items-center justify-center p-4 sm:p-8"
        onClick={onClose}
      >
        <img
          src={images[activeIndex]}
          alt={`Image ${activeIndex + 1}`}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          onError={(e) => {
            console.error('Failed to load image:', images[activeIndex]);
          }}
        />
      </div>

      {/* Thumbnail Navigation (for mobile swipe) */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-60 flex gap-2 bg-black bg-opacity-50 p-2 rounded-full max-w-xs overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => {
                setActiveIndex(index);
                onNavigate?.(index);
              }}
              className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                index === activeIndex 
                  ? 'border-yellow-400 opacity-100' 
                  : 'border-transparent opacity-60 hover:opacity-80'
              }`}
            >
              <img
                src={image}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Mobile Swipe Gestures */}
      <div className="absolute inset-0 z-50 lg:hidden">
        <div 
          className="absolute left-0 top-0 w-1/3 h-full"
          onClick={(e) => {
            e.stopPropagation();
            handlePrevious();
          }}
        />
        <div 
          className="absolute right-0 top-0 w-1/3 h-full"
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
        />
      </div>
    </div>
  );
}
