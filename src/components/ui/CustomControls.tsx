import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    FiChevronDown,
    FiCalendar,
    FiChevronLeft,
    FiChevronRight
} from 'react-icons/fi';
import {
    format,
    startOfWeek,
    startOfMonth,
    endOfMonth,
    endOfWeek,
    eachDayOfInterval,
    addMonths,
    subMonths,
    isSameMonth
} from 'date-fns';

// --- Shared Positioning Hook ---

const useDropdownPosition = (isOpen: boolean, optionsLength: number, extraDependency?: any) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

    const updatePosition = useCallback(() => {
        if (!isOpen || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        
        // Use the actual dropdown height if available, otherwise estimate
        const dropdownHeight = dropdownRef.current?.offsetHeight || 250;
        const dropdownWidth = dropdownRef.current?.offsetWidth || rect.width;

        let left = rect.left;
        if (left + dropdownWidth > windowWidth - 16) {
            left = windowWidth - dropdownWidth - 16;
        }

        const spaceBelow = windowHeight - rect.bottom;
        const spaceAbove = rect.top;
        const shouldFlip = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

        if (shouldFlip) {
            setDropdownStyle({
                position: 'fixed',
                bottom: windowHeight - rect.top + 4,
                left: left,
                width: rect.width,
                zIndex: 9999,
            });
        } else {
            setDropdownStyle({
                position: 'fixed',
                top: rect.bottom + 4,
                left: left,
                width: rect.width,
                zIndex: 9999,
            });
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            updatePosition();
            // Create a small delay to handle menu content rendering
            const timer = setTimeout(updatePosition, 10);
            
            window.addEventListener('resize', updatePosition);
            // Use capture to catch scroll events on any parent
            window.addEventListener('scroll', updatePosition, true);
            
            return () => {
                clearTimeout(timer);
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition, true);
            };
        }
    }, [isOpen, updatePosition, optionsLength, extraDependency]);

    return { containerRef, dropdownRef, dropdownStyle, updatePosition };
};

// --- Custom Dropdown ---

export const CustomDropdown = ({
    value,
    options,
    onChange,
    placeholder = 'Select Option',
    emptyMessage = 'No options found',
    className = "",
    disabled = false,
    searchable = false
}: {
    value: string,
    options: { id: string, title: string }[],
    onChange: (id: string) => void,
    placeholder?: string,
    emptyMessage?: string,
    className?: string,
    disabled?: boolean,
    searchable?: boolean
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredOptions = useMemo(() => {
        if (!searchable || !searchTerm) return options;
        return options.filter(opt =>
            opt.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [options, searchTerm, searchable]);

    const { containerRef, dropdownRef, dropdownStyle } = useDropdownPosition(
        isOpen, 
        options.length, 
        filteredOptions.length
    );

    const selectedOption = options.find(opt => opt.id === value);

    useEffect(() => {
        if (isOpen && searchable) {
            setSearchTerm('');
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isOpen, searchable]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (containerRef.current && !containerRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [containerRef, dropdownRef]);

    return (
        <div className={`relative w-full min-w-0 ${className} ${disabled ? 'opacity-50' : ''}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-yellow-500 overflow-hidden ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
                {isOpen && searchable ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Search..."
                        className="flex-1 bg-transparent border-none outline-none text-gray-900 p-0 text-sm focus:ring-0 w-full"
                    />
                ) : (
                    <span className={`truncate flex-1 text-left ${selectedOption ? 'text-gray-900' : 'text-gray-400'}`}>
                        {selectedOption ? selectedOption.title : placeholder}
                    </span>
                )}
                <FiChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && createPortal(
                <div ref={dropdownRef}
                    className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-100"
                    style={{ ...dropdownStyle, minWidth: dropdownStyle.width }}
                >
                    <div className="max-h-60 overflow-y-auto no-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(opt => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => {
                                        onChange(opt.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-yellow-50 transition-colors ${value === opt.id ? 'bg-yellow-100 text-yellow-800 font-medium' : 'text-gray-700'}`}
                                >
                                    <p className="truncate">{opt.title}</p>
                                </button>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-center text-xs text-gray-400">
                                {emptyMessage}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

// --- Custom Date Picker ---

export const CustomDatePicker = ({
    value,
    onChange,
    placeholder = 'Select Date',
    className = "",
    disabled = false
}: {
    value: string;
    onChange: (date: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const [viewDate, setViewDate] = useState(() => {
        return value ? new Date(value) : new Date();
    });

    const { containerRef, dropdownRef, dropdownStyle } = useDropdownPosition(isOpen, 42); // 42 is roughly the max days shown

    const selectedDate = useMemo(() => {
        if (!value) return null;
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (containerRef.current && !containerRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [containerRef, dropdownRef]);

    const days = useMemo(() => {
        const mStart = startOfMonth(viewDate);
        const mEnd = endOfMonth(mStart);
        const sDate = startOfWeek(mStart);
        const eDate = endOfWeek(mEnd);
        return eachDayOfInterval({ start: sDate, end: eDate });
    }, [viewDate]);

    const handlePrevMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        setViewDate(subMonths(viewDate, 1));
    };
    const handleNextMonth = (e: React.MouseEvent) => {
        e.stopPropagation();
        setViewDate(addMonths(viewDate, 1));
    };

    return (
        <div className={`relative w-full ${className} ${disabled ? 'opacity-50' : ''}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-yellow-500 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <span className={selectedDate ? 'text-gray-900' : 'text-gray-400'}>
                    {selectedDate ? format(selectedDate, 'dd-MMM-yyyy') : placeholder}
                </span>
                <FiCalendar className="w-4 h-4 text-gray-400" />
            </button>

            {isOpen && createPortal(
                <div ref={dropdownRef} className="bg-white border border-gray-200 rounded-lg shadow-xl p-3 animate-in fade-in zoom-in duration-100" style={{ ...dropdownStyle, width: 280 }}>
                    <div className="flex items-center justify-between mb-3 px-1">
                        <button type="button" onClick={handlePrevMonth} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded transition-colors">
                            <FiChevronLeft className="w-4 h-4 text-gray-600" />
                        </button>
                        <div className="font-semibold text-sm text-gray-900">
                            {format(viewDate, 'MMMM yyyy')}
                        </div>
                        <button type="button" onClick={handleNextMonth} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded transition-colors">
                            <FiChevronRight className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-1">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                            <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider py-1">
                                {d}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {days.map(day => {
                            const isSelected = selectedDate && format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                            const isCurrentMonth = isSameMonth(day, viewDate);

                            return (
                                <button
                                    key={day.toString()}
                                    type="button"
                                    onClick={() => {
                                        onChange(format(day, 'yyyy-MM-dd'));
                                        setIsOpen(false);
                                    }}
                                    className={`
                    h-8 w-8 flex items-center justify-center text-xs rounded-full transition-all
                    ${isSelected ? 'bg-yellow-400 text-yellow-900 font-bold shadow-sm' : 'hover:bg-yellow-50'}
                    ${!isSelected && isToday ? 'border border-yellow-400 text-yellow-600' : ''}
                    ${!isCurrentMonth ? 'text-gray-300' : (isSelected ? '' : 'text-gray-700')}
                  `}
                                >
                                    {format(day, 'd')}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between px-1">
                        <button
                            type="button"
                            onClick={() => {
                                onChange('');
                                setIsOpen(false);
                            }}
                            className="text-[10px] font-medium text-gray-500 hover:text-red-500 transition-colors"
                        >
                            CLEAR
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const today = format(new Date(), 'yyyy-MM-dd');
                                onChange(today);
                                setViewDate(new Date());
                                setIsOpen(false);
                            }}
                            className="text-[10px] font-bold text-yellow-600 hover:text-yellow-700 transition-colors"
                        >
                            TODAY
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

// --- Custom Time Selector ---

export const TimeSelect = ({
    hour,
    minute,
    ampm,
    options,
    onChange,
    className = "",
    disabled = false
}: {
    hour: string;
    minute: string;
    ampm: string;
    options: string[];
    onChange: (h: string, m: string, ap: string) => void;
    className?: string;
    disabled?: boolean;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const displayValue = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')} ${ampm}`;

    const { containerRef, dropdownRef, dropdownStyle } = useDropdownPosition(isOpen, options.length);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (containerRef.current && !containerRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [containerRef, dropdownRef]);

    return (
        <div className={`relative w-full ${className} ${disabled ? 'opacity-50' : ''}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-yellow-500 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <span className="text-gray-900">{displayValue}</span>
                <FiChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && createPortal(
                <div ref={dropdownRef}
                    className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-100"
                    style={dropdownStyle}
                >
                    <div className="max-h-48 overflow-y-auto no-scrollbar">
                        {options.map(opt => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                    const [time, ap] = opt.split(' ');
                                    const [h, m] = time.split(':');
                                    onChange(h, m, ap);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-yellow-50 transition-colors ${displayValue === opt ? 'bg-yellow-100 text-yellow-800 font-medium' : 'text-gray-700'}`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
