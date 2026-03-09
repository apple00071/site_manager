'use client';

import { useState, useEffect } from 'react';
import { FiClock, FiLogIn, FiLogOut, FiCheckCircle } from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';

export default function AttendanceWidget({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
    const { user } = useAuth();
    const [status, setStatus] = useState<'out' | 'in' | 'done' | 'forgotten'>('out');
    const [loading, setLoading] = useState(true);
    const [attendance, setAttendance] = useState<any>(null);
    const [showQuickClose, setShowQuickClose] = useState(false);
    const [quickCloseTime, setQuickCloseTime] = useState('18:00');
    const { showToast } = useToast();

    useEffect(() => {
        if (user) {
            fetchAttendanceStatus();
        }
    }, [user]);

    const fetchAttendanceStatus = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            // Fetch the latest record regardless of date
            const res = await fetch(`/api/attendance?user_id=${user?.id}&latest=true`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    const record = data[0];
                    setAttendance(record);

                    if (record.date === today) {
                        if (record.check_out) {
                            setStatus('done');
                        } else if (record.check_in) {
                            setStatus('in');
                        }
                    } else {
                        // Record is from a previous day
                        if (!record.check_out) {
                            setStatus('forgotten');
                        } else {
                            // Latest record is completed and from previous day, so today is "out"
                            setStatus('out');
                            setAttendance(null);
                        }
                    }
                } else {
                    setStatus('out');
                }
            }
        } catch (error) {
            console.error('Error fetching attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickClose = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'quick_close',
                    date: attendance.date,
                    check_out_time: quickCloseTime
                }),
            });

            if (res.ok) {
                showToast('success', 'Submitted for approval. You can now punch in for today.');
                setShowQuickClose(false);
                setStatus('out');
                setAttendance(null);
            } else {
                const err = await res.json();
                showToast('error', err.error || 'Failed to submit quick close');
            }
        } catch (error) {
            showToast('error', 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const handlePunch = async (action: 'punch_in' | 'punch_out') => {
        setLoading(true);
        try {
            let latitude: number | null = null;
            let longitude: number | null = null;

            // Capture Location - MANDATORY
            if (typeof window !== 'undefined' && 'geolocation' in navigator) {
                try {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: true,
                            timeout: 15000,
                            maximumAge: 0
                        });
                    });
                    latitude = position.coords.latitude;
                    longitude = position.coords.longitude;
                } catch (posError: any) {
                    console.error('Geolocation error details:', posError);
                    let message = 'Could not capture location. Please ensure GPS is enabled.';
                    if (posError.code === 1) {
                        message = 'Location access denied. Since your browser shows "Allowed", please check your Windows/System Privacy Settings for Location.';
                    } else if (posError.code === 3) {
                        message = 'Location request timed out. Please try again (move near a window if indoors).';
                    }

                    showToast('error', message);
                    setLoading(false);
                    return;
                }
            } else {
                showToast('error', 'Geolocation is not supported by your browser.');
                setLoading(false);
                return;
            }

            const res = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    latitude,
                    longitude
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setAttendance(data);
                if (action === 'punch_in') {
                    setStatus('in');
                    showToast('success', 'Punched in successfully!');
                } else {
                    setStatus('done');
                    showToast('success', 'Punched out successfully!');
                }
            } else {
                const err = await res.json();
                showToast('error', err.error || 'Failed to update attendance');
            }
        } catch (_) {
            showToast('error', 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !attendance) {
        return (
            <div className={`${variant === 'compact' ? 'h-8 w-10' : 'h-12 w-48'} bg-gray-100 animate-pulse rounded-xl`}></div>
        );
    }

    if (status === 'forgotten') {
        return (
            <div className={`flex flex-col gap-2 bg-yellow-50 border border-yellow-100 rounded-xl p-3 ${variant === 'compact' ? 'w-full' : 'w-64'}`}>
                <div className="flex items-center gap-2 text-yellow-800">
                    <FiClock className="h-5 w-5" />
                    <span className="text-xs font-bold leading-tight">Missing Punch Out from {new Date(attendance.date).toLocaleDateString()}</span>
                </div>
                {!showQuickClose ? (
                    <button
                        onClick={() => setShowQuickClose(true)}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white text-[10px] font-bold py-1.5 rounded-lg transition-all"
                    >
                        Resolve Now
                    </button>
                ) : (
                    <div className="space-y-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-bold text-yellow-700 uppercase">Logout Time</label>
                            <input
                                type="time"
                                value={quickCloseTime}
                                onChange={(e) => setQuickCloseTime(e.target.value)}
                                className="px-2 py-1 text-xs border border-yellow-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-yellow-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleQuickClose}
                                disabled={loading}
                                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white text-[10px] font-bold py-1.5 rounded-lg transition-all"
                            >
                                Submit
                            </button>
                            <button
                                onClick={() => setShowQuickClose(false)}
                                className="px-2 py-1.5 text-yellow-700 text-[10px] font-bold hover:bg-yellow-100 rounded-lg transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (status === 'done') {
        const checkIn = new Date(attendance.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const checkOut = new Date(attendance.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (variant === 'compact') {
            return (
                <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 px-2 py-1 rounded-lg" title={`Shift: ${checkIn} - ${checkOut}`}>
                    <FiCheckCircle className="text-green-600 h-4 w-4" />
                    <span className="text-[10px] font-bold text-green-900 leading-none">DONE</span>
                </div>
            );
        }

        return (
            <div className="flex items-center gap-3 bg-green-50 border border-green-100 px-4 py-2 rounded-xl">
                <FiCheckCircle className="text-green-600 h-5 w-5" />
                <div className="text-sm">
                    <p className="font-semibold text-green-900 leading-tight">Shift Completed</p>
                    <p className="text-green-700 text-xs">{checkIn} — {checkOut}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            {status === 'out' ? (
                <button
                    onClick={() => handlePunch('punch_in')}
                    disabled={loading}
                    className={`flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 ${variant === 'compact' ? 'px-2 py-2' : 'px-5 py-2.5'}`}
                    title="Punch In"
                >
                    <FiLogIn className={`${variant === 'compact' ? 'h-4 w-4' : 'h-5 w-5'}`} />
                    {variant !== 'compact' && <span>Punch In</span>}
                </button>
            ) : (
                <div className={`flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl ${variant === 'compact' ? 'px-1.5 py-1' : 'pl-4 pr-2 py-1.5'}`}>
                    <div className="flex flex-col items-center">
                        <span className={`${variant === 'compact' ? 'text-[7px]' : 'text-[10px]'} uppercase font-bold text-blue-500`}>{variant === 'compact' ? 'IN' : 'IN SINCE'}</span>
                        <span className={`${variant === 'compact' ? 'text-[10px]' : 'text-sm'} font-bold text-blue-900 leading-tight`}>
                            {new Date(attendance.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <button
                        onClick={() => handlePunch('punch_out')}
                        disabled={loading}
                        className={`flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 ${variant === 'compact' ? 'p-1' : 'p-2'}`}
                        title="Punch Out"
                    >
                        <FiLogOut className={`${variant === 'compact' ? 'h-3 w-3' : 'h-5 w-5'}`} />
                    </button>
                </div>
            )}
        </div>
    );
}
