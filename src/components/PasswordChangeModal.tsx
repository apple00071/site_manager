'use client';

import { useState } from 'react';
import { FiAlertTriangle, FiLock, FiEye, FiEyeOff, FiCheck } from 'react-icons/fi';

interface PasswordChangeModalProps {
    onSuccess: () => void;
}

export default function PasswordChangeModal({ onSuccess }: PasswordChangeModalProps) {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const passwordStrength = (pw: string) => {
        let score = 0;
        if (pw.length >= 8) score++;
        if (pw.length >= 12) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        return score;
    };

    const strength = passwordStrength(newPassword);
    const strengthLabel = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'][Math.min(strength, 4)];
    const strengthColor = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'][Math.min(strength, 4)];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (strength < 2) {
            setError('Please choose a stronger password. Include uppercase letters, numbers, or symbols.');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_password: newPassword }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to update password');
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2.5 rounded-xl">
                            <FiAlertTriangle className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Password Change Required</h2>
                            <p className="text-amber-100 text-sm">For your security, please set a new password</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p className="text-sm text-amber-800">
                            You are currently using a temporary password assigned during account creation.
                            Please create a new, secure password to continue using the application.
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    {/* New Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            <FiLock className="inline w-4 h-4 mr-1" />New Password
                        </label>
                        <div className="relative">
                            <input
                                type={showNew ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-sm pr-12"
                                placeholder="Enter new password"
                                required
                                minLength={8}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNew(!showNew)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showNew ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                            </button>
                        </div>
                        {/* Strength Indicator */}
                        {newPassword && (
                            <div className="mt-2">
                                <div className="flex gap-1 mb-1">
                                    {[0, 1, 2, 3, 4].map((i) => (
                                        <div
                                            key={i}
                                            className={`h-1.5 flex-1 rounded-full transition-colors ${i < strength ? strengthColor : 'bg-gray-200'
                                                }`}
                                        />
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500">Strength: {strengthLabel}</p>
                            </div>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            <FiCheck className="inline w-4 h-4 mr-1" />Confirm Password
                        </label>
                        <div className="relative">
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-sm pr-12 ${confirmPassword && confirmPassword !== newPassword
                                        ? 'border-red-300'
                                        : confirmPassword && confirmPassword === newPassword
                                            ? 'border-green-300'
                                            : 'border-gray-200'
                                    }`}
                                placeholder="Confirm new password"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm(!showConfirm)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showConfirm ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                            </button>
                        </div>
                        {confirmPassword && confirmPassword !== newPassword && (
                            <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-yellow-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-200"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                Updating...
                            </span>
                        ) : (
                            'Update Password'
                        )}
                    </button>

                    <p className="text-xs text-center text-gray-400">
                        You cannot skip this step. A strong password keeps your account safe.
                    </p>
                </form>
            </div>
        </div>
    );
}
