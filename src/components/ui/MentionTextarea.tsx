'use client';

import React, { useState, useRef, useEffect } from 'react';

interface User {
    id: string;
    full_name: string;
    username: string;
}

interface MentionTextareaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    users: User[];
    className?: string;
    disabled?: boolean;
    rows?: number;
}

export function MentionTextarea({
    value,
    onChange,
    placeholder,
    users,
    className,
    disabled,
    rows = 3
}: MentionTextareaProps) {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState<User[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [cursorPosition, setCursorPosition] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const suggestionRef = useRef<HTMLDivElement>(null);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const pos = e.target.selectionStart;
        onChange(newValue);
        setCursorPosition(pos);

        // Check if we are typing after an @
        const textBeforeCursor = newValue.slice(0, pos);
        const lastAtPos = textBeforeCursor.lastIndexOf('@');

        if (lastAtPos !== -1) {
            const query = textBeforeCursor.slice(lastAtPos + 1);
            // Verify there's no space between @ and cursor (except if it's the beginning of a word)
            const spaceAfterAt = query.includes(' ');

            if (!spaceAfterAt) {
                const filtered = users.filter(u =>
                    u.username?.toLowerCase().includes(query.toLowerCase()) ||
                    u.full_name?.toLowerCase().includes(query.toLowerCase())
                );

                if (filtered.length > 0) {
                    setSuggestions(filtered);
                    setShowSuggestions(true);
                    setSelectedIndex(0);
                    return;
                }
            }
        }
        setShowSuggestions(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            selectUser(suggestions[selectedIndex]);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    const selectUser = (user: User) => {
        const textBeforeAt = value.slice(0, value.lastIndexOf('@', cursorPosition - 1));
        const textAfterCursor = value.slice(cursorPosition);
        const newValue = `${textBeforeAt}@${user.username} ${textAfterCursor}`;

        onChange(newValue);
        setShowSuggestions(false);

        // Refocus and move cursor
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const newPos = textBeforeAt.length + user.username.length + 2;
                textareaRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };

    // Close suggestions on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative w-full">
            <textarea
                ref={textareaRef}
                value={value}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                rows={rows}
                className={className}
            />

            {showSuggestions && (
                <div
                    ref={suggestionRef}
                    className="absolute z-[100] top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                >
                    <div className="p-2 border-b border-gray-50 bg-gray-50">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mention Team Member</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {suggestions.map((user, index) => (
                            <button
                                key={user.id}
                                onClick={() => selectUser(user)}
                                className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${index === selectedIndex ? 'bg-yellow-50 text-yellow-700' : 'hover:bg-gray-50 text-gray-700'
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${index === selectedIndex ? 'bg-yellow-200' : 'bg-gray-100'
                                    }`}>
                                    {user.full_name?.[0] || user.username?.[0]}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-bold truncate">{user.full_name}</span>
                                    <span className="text-[10px] text-gray-500">@{user.username}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
