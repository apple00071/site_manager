'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { FiAlertCircle, FiCheck, FiStar, FiSend, FiHelpCircle } from 'react-icons/fi';

export default function MandatorySurveyModal() {
    const { user, isLoading } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [rating, setRating] = useState<number>(5);
    const [issues, setIssues] = useState('');
    const [improvements, setImprovements] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submittedSuccess, setSubmittedSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isLoading || !user) return;

        const storageKey = `app_survey_submitted_${user.id}`;
        const localStatus = localStorage.getItem(storageKey);

        // If already marked as submitted locally, no need to open
        if (localStatus === 'true') {
            return;
        }

        // Verify with server
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/surveys?action=status');
                if (res.ok) {
                    const data = await res.json();
                    if (data.hasSubmitted) {
                        localStorage.setItem(storageKey, 'true');
                    } else {
                        // Delay opening slightly so the page content renders first
                        setTimeout(() => setIsOpen(true), 500);
                    }
                }
            } catch (e) {
                // In case of network error, show survey if not marked locally
                if (localStatus !== 'true') {
                    setIsOpen(true);
                }
            }
        };

        checkStatus();
    }, [user, isLoading]);

    // Prevent ESC key from closing
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');

        if (!issues.trim()) {
            setErrorMessage('Please describe the issues or difficulties you are facing.');
            return;
        }

        if (!improvements.trim()) {
            setErrorMessage('Please describe what should be improved.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/surveys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rating,
                    category: 'General',
                    issues: issues.trim(),
                    improvements: improvements.trim()
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to submit survey');
            }

            // Save completion to local storage
            if (user?.id) {
                localStorage.setItem(`app_survey_submitted_${user.id}`, 'true');
            }

            setSubmittedSuccess(true);
            setTimeout(() => {
                setIsOpen(false);
            }, 1600);
        } catch (err: any) {
            setErrorMessage(err.message || 'Error submitting survey. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!mounted || !isOpen || !user) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
            // Click outside disabled intentionally
            onClick={(e) => e.stopPropagation()}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header - No Close Button */}
                <div className="px-6 py-5 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex items-center gap-3.5 shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-[#f0b100] text-gray-950 flex items-center justify-center font-bold shrink-0 shadow-md">
                        <FiHelpCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                                Mandatory Feedback & Experience Survey
                            </h2>
                            <span className="text-[10px] bg-red-500/90 text-white font-bold uppercase px-2 py-0.5 rounded-full">
                                Required
                            </span>
                        </div>
                        <p className="text-xs text-gray-300 mt-0.5">
                            Apple Interiors · Your honest input directly shapes new features and improvements
                        </p>
                    </div>
                </div>

                {/* Body / Form */}
                {submittedSuccess ? (
                    <div className="p-8 text-center space-y-3 my-auto">
                        <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                            <FiCheck className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Thank You for Your Feedback!</h3>
                        <p className="text-sm text-gray-600 max-w-sm mx-auto">
                            Your response has been securely recorded. The IT and leadership teams will review your suggestions to enhance your experience.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-left">
                        {errorMessage && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
                                <FiAlertCircle className="w-4 h-4 shrink-0" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        {/* Overall Experience Rating */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                                1. How is your overall experience using the Site Manager app? <span className="text-red-500">*</span>
                            </label>
                            <div className="flex items-center gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                                            rating === star
                                                ? 'bg-[#f0b100] text-gray-950 border-[#f0b100] shadow-sm font-bold'
                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                        }`}
                                    >
                                        <FiStar className={`w-3.5 h-3.5 ${rating >= star ? 'fill-current' : ''}`} />
                                        <span>{star}</span>
                                    </button>
                                ))}
                                <span className="text-xs text-gray-500 ml-2 font-medium">
                                    {rating === 1 && 'Needs urgent attention'}
                                    {rating === 2 && 'Facing multiple problems'}
                                    {rating === 3 && 'Fair / Manageable'}
                                    {rating === 4 && 'Good'}
                                    {rating === 5 && 'Excellent'}
                                </span>
                            </div>
                        </div>

                        {/* Issues Faced */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                                2. What are the specific issues or challenges you are facing? <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={issues}
                                onChange={(e) => setIssues(e.target.value)}
                                rows={3}
                                required
                                placeholder="Please explain any problems, errors, delays, or difficulties you encounter while working..."
                                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#f0b100] outline-none transition-all placeholder:text-gray-400 font-normal"
                            />
                        </div>

                        {/* Improvements Needed */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                                3. What should be improved or added to make your work easier? <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={improvements}
                                onChange={(e) => setImprovements(e.target.value)}
                                rows={3}
                                required
                                placeholder="What new buttons, reports, automations, or changes would help you the most?..."
                                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#f0b100] outline-none transition-all placeholder:text-gray-400 font-normal"
                            />
                        </div>

                        {/* Submission footer */}
                        <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
                            <button
                                type="submit"
                                disabled={submitting || !issues.trim() || !improvements.trim()}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold bg-[#f0b100] hover:bg-[#d49b00] text-gray-950 rounded-lg shadow-md transition-all disabled:opacity-50 cursor-pointer"
                            >
                                <FiSend className="w-4 h-4" />
                                <span>{submitting ? 'Submitting...' : 'Submit Survey'}</span>
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>,
        document.body
    );
}
