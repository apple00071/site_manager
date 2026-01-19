'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { FiX, FiCheck, FiAlertCircle, FiInfo, FiAlertTriangle } from 'react-icons/fi';

// Toast types
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    showToast: (type: ToastType, message: string, duration?: number) => void;
    dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

// Toast Provider Component
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((type: ToastType, message: string, duration = 4000) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newToast: Toast = { id, type, message, duration };

        setToasts(prev => [...prev, newToast]);

        // Auto-dismiss
        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        }
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </ToastContext.Provider>
    );
}

// Toast Container (renders all active toasts)
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[100] flex flex-col gap-2 sm:max-w-sm sm:w-full pointer-events-none">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
        </div>
    );
}

// Individual Toast Item
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
    const icons = {
        success: FiCheck,
        error: FiAlertCircle,
        warning: FiAlertTriangle,
        info: FiInfo,
    };

    const styles = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800',
    };

    const iconStyles = {
        success: 'text-green-500',
        error: 'text-red-500',
        warning: 'text-yellow-500',
        info: 'text-blue-500',
    };

    const Icon = icons[toast.type];

    return (
        <div
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-slide-up ${styles[toast.type]}`}
            role="alert"
        >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconStyles[toast.type]}`} />
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
                onClick={() => onDismiss(toast.id)}
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-black/5 transition-colors touch-manipulation"
                aria-label="Dismiss"
            >
                <FiX className="w-4 h-4" />
            </button>
        </div>
    );
}

// Convenience hooks for each toast type
export function useSuccessToast() {
    const { showToast } = useToast();
    return useCallback((message: string, duration?: number) => showToast('success', message, duration), [showToast]);
}

export function useErrorToast() {
    const { showToast } = useToast();
    return useCallback((message: string, duration?: number) => showToast('error', message, duration), [showToast]);
}

export function useWarningToast() {
    const { showToast } = useToast();
    return useCallback((message: string, duration?: number) => showToast('warning', message, duration), [showToast]);
}

export function useInfoToast() {
    const { showToast } = useToast();
    return useCallback((message: string, duration?: number) => showToast('info', message, duration), [showToast]);
}

export default ToastProvider;
