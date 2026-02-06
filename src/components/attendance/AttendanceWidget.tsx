'use client';

import { useState, useEffect } from 'react';
import { FiClock, FiLogIn, FiLogOut, FiCheckCircle } from 'react-icons/fi';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';

export default function AttendanceWidget({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
    const { user } = useAuth();
    const [status, setStatus] = useState<'out' | 'in' | 'done'>('out');
    const [loading, setLoading] = useState(true);
    const [attendance, setAttendance] = useState<any>(null);
    const { showToast } = useToast();

    useEffect(() => {
        if (user) {
            fetchTodayAttendance();
        }
    }, [user]);

    const fetchTodayAttendance = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await fetch(`/api/attendance?date=${today}&user_id=${user?.id}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    const record = data[0];
                    setAttendance(record);
                    if (record.check_out) {
                        setStatus('done');
                    } else if (record.check_in) {
                        setStatus('in');
                    }
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

            // Capture Location
            if (typeof window !== 'undefined' && 'geolocation' in navigator) {
                try {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: true,
                            timeout: 10000,
                            maximumAge: 0
                        });
                    });
                    latitude = position.coords.latitude;
                    longitude = position.coords.longitude;
                } catch (posError) {
                    console.warn('Geolocation failed or denied:', posError);
                    showToast('warning', 'Could not capture location. Please ensure GPS is enabled.');
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
        } catch (error) {
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
