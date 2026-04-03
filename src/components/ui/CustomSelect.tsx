'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown } from 'react-icons/fi';
import { useDropdownPosition } from './CustomControls';

interface CustomSelectProps {
    value: string;
    options: string[];
    onChange: (value: string) => void;
    onBlur?: () => void;
    placeholder?: string;
    className?: string;
}

export function CustomSelect({
    value,
    options,
    onChange,
    onBlur,
    placeholder = 'Select...',
    className = ''
}: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { containerRef, dropdownRef, dropdownStyle } = useDropdownPosition(isOpen, options.length);

    // Close on click outside - check both container AND dropdown portal
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            const clickedInsideContainer = containerRef.current?.contains(target);
            const clickedInsideDropdown = dropdownRef.current?.contains(target);

            if (!clickedInsideContainer && !clickedInsideDropdown) {
                setIsOpen(false);
                onBlur?.();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onBlur]);

    const handleSelect = (opt: string) => {
        onChange(opt);
        setIsOpen(false);
    };

    const displayValue = value ? value.replace(/_/g, ' ') : placeholder;

    const dropdownContent = isOpen ? (
        <div
            ref={dropdownRef}
            className="bg-white rounded-lg shadow-xl border border-gray-200 py-1 max-h-48 overflow-auto"
            style={dropdownStyle}
        >
            <button
                type="button"
                onClick={() => handleSelect('')}
                className="block px-3 py-1.5 text-left text-sm text-gray-400 hover:bg-gray-50 whitespace-nowrap"
            >
                -
            </button>
            {options.map(opt => (
                <button
                    key={opt}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={`block px-3 py-1.5 text-left text-sm hover:bg-yellow-50 whitespace-nowrap ${value === opt ? 'bg-yellow-100 text-yellow-800 font-medium' : 'text-gray-700'
                        }`}
                >
                    {opt.replace(/_/g, ' ')}
                </button>
            ))}
        </div>
    ) : null;

    return (
        <>
            <div ref={containerRef} className={`relative ${className}`}>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full px-2 py-1 text-sm bg-gray-50 rounded text-left flex items-center justify-between gap-1 hover:bg-gray-100"
                >
                    <span className={value ? 'text-gray-900' : 'text-gray-400'}>
                        {displayValue}
                    </span>
                    <FiChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>
            {typeof window !== 'undefined' && dropdownContent && createPortal(dropdownContent, document.body)}
        </>
    );
}

export default CustomSelect;


