'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown } from 'react-icons/fi';

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
    const [isOpen, setIsOpen] = useState(true); // Start open for immediate editing
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

    // Calculate dropdown position when opened
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownStyle({
                position: 'fixed',
                top: rect.bottom + 2,
                left: rect.left,
                zIndex: 9999
            });
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
        onBlur?.();
    };

    const displayValue = value ? value.replace(/_/g, ' ') : placeholder;

    const dropdownContent = isOpen ? (
        <div
            className="bg-white rounded-lg shadow-xl py-1 max-h-48 overflow-auto"
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
                    className={`block px-3 py-1.5 text-left text-sm hover:bg-amber-50 whitespace-nowrap ${value === opt ? 'bg-amber-100 text-amber-800 font-medium' : 'text-gray-700'
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
                    ref={buttonRef}
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


