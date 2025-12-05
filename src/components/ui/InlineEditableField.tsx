'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { FiCheck, FiX, FiEdit2 } from 'react-icons/fi';

type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea';

interface SelectOption {
    value: string;
    label: string;
}

interface InlineEditableFieldProps {
    value: string | number;
    onSave: (value: string | number) => Promise<void> | void;
    type?: FieldType;
    placeholder?: string;
    options?: SelectOption[];
    disabled?: boolean;
    className?: string;
    displayFormatter?: (value: string | number) => string;
    validate?: (value: string | number) => string | null;
    emptyText?: string;
}

export function InlineEditableField({
    value,
    onSave,
    type = 'text',
    placeholder = 'Click to edit',
    options = [],
    disabled = false,
    className = '',
    displayFormatter,
    validate,
    emptyText = '-',
}: InlineEditableFieldProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(String(value));
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

    // Reset edit value when value prop changes
    useEffect(() => {
        if (!isEditing) {
            setEditValue(String(value));
        }
    }, [value, isEditing]);

    // Focus input when entering edit mode
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
                inputRef.current.select();
            }
        }
    }, [isEditing]);

    const handleStartEdit = () => {
        if (disabled) return;
        setIsEditing(true);
        setEditValue(String(value));
        setError(null);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditValue(String(value));
        setError(null);
    };

    const handleSave = async () => {
        // Validate
        if (validate) {
            const validationError = validate(type === 'number' ? Number(editValue) : editValue);
            if (validationError) {
                setError(validationError);
                return;
            }
        }

        setIsSaving(true);
        setError(null);

        try {
            const saveValue = type === 'number' ? Number(editValue) : editValue;
            await onSave(saveValue);
            setIsEditing(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 1500);
        } catch (err: any) {
            setError(err.message || 'Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && type !== 'textarea') {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    const displayValue = displayFormatter ? displayFormatter(value) : String(value);

    // Display mode
    if (!isEditing) {
        return (
            <div className={`group relative ${className}`}>
                <button
                    onClick={handleStartEdit}
                    disabled={disabled}
                    className={`w-full text-left px-2 py-1 rounded-md transition-colors ${disabled
                            ? 'cursor-default'
                            : 'hover:bg-gray-100 cursor-pointer'
                        } ${showSuccess ? 'bg-green-50' : ''}`}
                    title={disabled ? undefined : 'Click to edit'}
                >
                    <span className={value ? 'text-gray-900' : 'text-gray-400'}>
                        {value ? displayValue : emptyText}
                    </span>
                    {!disabled && (
                        <FiEdit2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                    {showSuccess && (
                        <FiCheck className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                    )}
                </button>
            </div>
        );
    }

    // Edit mode
    return (
        <div className={`relative ${className}`}>
            <div className="flex items-center gap-1">
                {type === 'textarea' ? (
                    <textarea
                        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        disabled={isSaving}
                        rows={3}
                        className={`flex-1 px-2 py-1 text-sm border rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 ${error ? 'border-red-300' : 'border-gray-300'
                            }`}
                    />
                ) : type === 'select' ? (
                    <select
                        ref={inputRef as React.RefObject<HTMLSelectElement>}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isSaving}
                        className={`flex-1 px-2 py-1 text-sm border rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 ${error ? 'border-red-300' : 'border-gray-300'
                            }`}
                    >
                        {options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                ) : (
                    <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type={type}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        disabled={isSaving}
                        className={`flex-1 px-2 py-1 text-sm border rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 ${error ? 'border-red-300' : 'border-gray-300'
                            }`}
                    />
                )}

                {/* Action buttons */}
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
                    title="Save"
                >
                    {isSaving ? (
                        <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <FiCheck className="w-4 h-4" />
                    )}
                </button>
                <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                    title="Cancel"
                >
                    <FiX className="w-4 h-4" />
                </button>
            </div>

            {/* Error message */}
            {error && (
                <p className="mt-1 text-xs text-red-600">{error}</p>
            )}
        </div>
    );
}

export default InlineEditableField;
