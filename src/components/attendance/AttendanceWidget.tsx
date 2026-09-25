'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiClock, FiLogIn, FiLogOut, FiCheckCircle, FiRefreshCw } from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { getTodayDateString, formatTimeIST } from '@/lib/dateUtils';
import { acquireLocation } from '@/lib/locationUtils';


export default function AttendanceWidget({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
    const { user } = useAuth();
    const [status, setStatus] = useState<'out' | 'in' | 'done' | 'forgotten'>('out');
    const [loading, setLoading] = useState(true);
    const [punching, setPunching] = useState(false);
    const [attendance, setAttendance] = useState<any>(null);
    const { showToast } = useToast();

    const warmupLocation = useCallback(async (force = false) => {
        try {
            await acquireLocation({ forceFresh: force });
        } catch (_) {
            // Ignore background warmup errors
        }
    }, []);

    const fetchAttendanceStatus = useCallback(async () => {
        try {
            const today = getTodayDateString();
            const res = await fetch('/api/attendance?latest=true');
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    const record = data[0];
                    setAttendance(record);

                    if (!record.check_out) {
                        setStatus('in');
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
                    setAttendance(null);
                }
            }
        } catch (error) {
            console.error('Error fetching attendance:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user) {
            fetchAttendanceStatus();
        }
    }, [user, fetchAttendanceStatus]);

    // Proactively warm up GPS location when the app opens if the user hasn't finished shift
    useEffect(() => {
        if (user && status !== 'done') {
            warmupLocation();
        }
    }, [user, status, warmupLocation]);

    const handlePunch = async (action: 'punch_in' | 'punch_out') => {
        setPunching(true);
        try {
            let coords: { latitude: number; longitude: number } | null = null;
            try {
                coords = await acquireLocation({ forceFresh: true });
                if (!coords?.latitude || !coords?.longitude) {
                    throw new Error('LOCATION_UNAVAILABLE');
                }
            } catch (posError: any) {
                let msg = 'Could not capture your location. Please ensure location is enabled.';
                if (posError?.message === 'PERMISSION_DENIED') {
                    msg = 'Location permission is blocked. Please allow location access in your browser address bar (lock icon) to punch in.';
                } else if (posError?.message === 'GPS_DISABLED') {
                    msg = 'Device location (GPS) is turned off. Please turn ON Location in your device settings to punch in.';
                } else if (posError?.message === 'INSECURE_CONTEXT') {
                    msg = 'Location tracking requires a secure (HTTPS) connection or localhost.';
                }
                showToast('error', msg);
                setPunching(false);
                return;
            }

            const res = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    latitude: coords?.latitude ?? null,
                    longitude: coords?.longitude ?? null
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
                fetchAttendanceStatus();
            }
        } catch (_) {
            showToast('error', 'Something went wrong while recording attendance');
        } finally {
            setPunching(false);
        }
    };

    if (loading && !attendance) {
        return (
            <div className={`${variant === 'compact' ? 'h-8 w-10' : 'h-12 w-48'} bg-gray-100 animate-pulse rounded-xl`}></div>
        );
    }

    if (status === 'done') {
        const checkIn = formatTimeIST(attendance?.check_in);
        const checkOut = formatTimeIST(attendance?.check_out);

        if (variant === 'compact') {
            return (
                <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 px-2 py-1 rounded-lg" title={`Shift: ${checkIn} - ${checkOut}`}>
                    <FiCheckCircle className="text-green-600 h-4 w-4" />
                    <span className="text-[10px] font-bold text-green-900 leading-none">DONE</span>
                </div>
            );
        }

        return (
            <div className="flex items-center gap-3 bg-green-50 border border-green-100 px-4 py-2 rounded-xl shadow-2xs">
                <FiCheckCircle className="text-green-600 h-5 w-5 shrink-0" />
                <div className="text-sm">
                    <p className="font-semibold text-green-900 leading-tight">Shift Completed</p>
                    <p className="text-green-700 text-xs mt-0.5">{checkIn} — {checkOut}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            {status === 'out' ? (
                <div className="flex flex-col gap-1.5">
                    {attendance?.status === 'rejected' && (
                        <div className="px-2 py-1 bg-red-50 border border-red-100 rounded-lg flex items-center gap-1.5 animate-pulse">
                            <FiClock className="text-red-500 w-3 h-3" />
                            <span className="text-[9px] font-bold text-red-600 uppercase">Last Punch Rejected</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handlePunch('punch_in')}
                            disabled={punching}
                            className={`flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-gray-950 font-bold rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-60 ${variant === 'compact' ? 'px-2.5 py-2' : 'px-5 py-2.5'}`}
                            title="Punch In"
                        >
                            {punching ? (
                                <FiRefreshCw className="h-4 w-4 animate-spin text-gray-900" />
                            ) : (
                                <FiLogIn className={`${variant === 'compact' ? 'h-4 w-4' : 'h-5 w-5'} text-gray-950`} />
                            )}
                            {variant !== 'compact' && (
                                <span>{punching ? 'Recording...' : 'Punch In'}</span>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <div className={`flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl ${variant === 'compact' ? 'px-1.5 py-1' : 'pl-4 pr-2 py-1.5'}`}>
                    <div className="flex flex-col items-center">
                        <span className={`${variant === 'compact' ? 'text-[7px]' : 'text-[10px]'} uppercase font-bold text-blue-500`}>{variant === 'compact' ? 'IN' : 'IN SINCE'}</span>
                        <span className={`${variant === 'compact' ? 'text-[10px]' : 'text-sm'} font-bold text-blue-900 leading-tight`}>
                            {formatTimeIST(attendance?.check_in)}
                        </span>
                    </div>
                    <button
                        onClick={() => handlePunch('punch_out')}
                        disabled={punching}
                        className={`flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 ${variant === 'compact' ? 'p-1' : 'p-2'}`}
                        title="Punch Out"
                    >
                        {punching ? (
                            <FiRefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                            <FiLogOut className={`${variant === 'compact' ? 'h-3 w-3' : 'h-5 w-5'}`} />
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
