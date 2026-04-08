'use client';

import { useState, useEffect } from 'react';
import { FiClock, FiLogIn, FiLogOut, FiCheckCircle } from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { getTodayDateString, formatTimeIST } from '@/lib/dateUtils';
import { Capacitor } from '@capacitor/core';

export default function AttendanceWidget({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
    const { user } = useAuth();
    const [status, setStatus] = useState<'out' | 'in' | 'done' | 'forgotten'>('out');
    const [loading, setLoading] = useState(true);
    const [attendance, setAttendance] = useState<any>(null);
    const { showToast } = useToast();

    useEffect(() => {
        if (user) {
            fetchAttendanceStatus();
        }
    }, [user]);

    const fetchAttendanceStatus = async () => {
        try {
            const today = getTodayDateString();
            // Fetch the latest record regardless of date
            const res = await fetch(`/api/attendance?user_id=${user?.id}&latest=true`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    const record = data[0];
                    setAttendance(record);

                    if (!record.check_out) {
                        const checkInDate = new Date(record.check_in);
                        const now = new Date();
                        const diffHours = (now.getTime() - checkInDate.getTime()) / (1000 * 60 * 60);

                        // If it's been more than 20 hours, it will be auto-closed by the system or on next punch-in
                        if (diffHours > 20) {
                            setStatus('out');
                            setAttendance(null);
                        } else {
                            setStatus('in');
                        }
                    } else {
                        if (record.date === today) {
                            setStatus('done');
                        } else {
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


    const handlePunch = async (action: 'punch_in' | 'punch_out') => {
        setLoading(true);
        try {
            let latitude: number | null = null;
            let longitude: number | null = null;

            // Capture Location - MANDATORY
            if (typeof window !== 'undefined') {
                if (Capacitor.isNativePlatform()) {
                    try {
                        const { Geolocation } = await import('@capacitor/geolocation');
                        
                        // Check permissions first
                        const permissions = await Geolocation.checkPermissions();
                        if (permissions.location !== 'granted') {
                            const request = await Geolocation.requestPermissions();
                            if (request.location !== 'granted') {
                                showToast('error', 'Location permission denied. Please enable GPS.');
                                setLoading(false);
                                return;
                            }
                        }

                        const position = await Geolocation.getCurrentPosition({
                            enableHighAccuracy: true,
                            timeout: 15000,
                            maximumAge: 0
                        });
                        latitude = position.coords.latitude;
                        longitude = position.coords.longitude;
                    } catch (posError: any) {
                        console.error('Capacitor Geolocation error:', posError);
                        showToast('error', 'Could not capture precise location via device GPS. Ensure location is enabled.');
                        setLoading(false);
                        return;
                    }
                } else {
                    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
                        showToast('error', 'Location tracking requires a secure (HTTPS) connection. Please use https://app.appleinteriors.in');
                        setLoading(false);
                        return;
                    }

                    if ('geolocation' in navigator) {
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
                                message = 'Location access denied. Please check your browser permission and Windows Location Settings.';
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
                }
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


    if (status === 'done') {
        const checkIn = formatTimeIST(attendance.check_in);
        const checkOut = formatTimeIST(attendance.check_out);

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
                <div className="flex flex-col gap-2">
                    {attendance?.status === 'rejected' && (
                        <div className="px-2 py-1 bg-red-50 border border-red-100 rounded-lg flex items-center gap-1.5 animate-pulse">
                            <FiClock className="text-red-500 w-3 h-3" />
                            <span className="text-[9px] font-bold text-red-600 uppercase">Last Punch Rejected</span>
                        </div>
                    )}
                    <button
                        onClick={() => handlePunch('punch_in')}
                        disabled={loading}
                        className={`flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 ${variant === 'compact' ? 'px-2 py-2' : 'px-5 py-2.5'}`}
                        title="Punch In"
                    >
                        <FiLogIn className={`${variant === 'compact' ? 'h-4 w-4' : 'h-5 w-5'}`} />
                        {variant !== 'compact' && <span>Punch In</span>}
                    </button>
                </div>
            ) : (
                <div className={`flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl ${variant === 'compact' ? 'px-1.5 py-1' : 'pl-4 pr-2 py-1.5'}`}>
                    <div className="flex flex-col items-center">
                        <span className={`${variant === 'compact' ? 'text-[7px]' : 'text-[10px]'} uppercase font-bold text-blue-500`}>{variant === 'compact' ? 'IN' : 'IN SINCE'}</span>
                        <span className={`${variant === 'compact' ? 'text-[10px]' : 'text-sm'} font-bold text-blue-900 leading-tight`}>
                            {formatTimeIST(attendance.check_in)}
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
