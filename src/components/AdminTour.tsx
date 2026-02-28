'use client';

import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuth } from '@/contexts/AuthContext';

interface AdminTourProps {
    setSidebarOpen: (open: boolean) => void;
}

export default function AdminTour({ setSidebarOpen }: AdminTourProps) {
    const { user, isAdmin } = useAuth();

    useEffect(() => {
        // Only run for admins
        if (!isAdmin || !user) return;

        // Check if tour has already been completed
        const tourCompleted = localStorage.getItem('apple_admin_tour_completed');
        if (tourCompleted === 'true') return;

        // Small delay to ensure layout is fully rendered
        const timer = setTimeout(() => {
            const isMobile = window.innerWidth < 1024;

            const driverObj = driver({
                showProgress: true,
                animate: true,
                allowClose: false, // Prevent closing on backdrop click
                steps: [
                    ...(isMobile ? [{
                        element: '#mobile-menu-button',
                        popover: {
                            title: 'Navigation Menu',
                            description: 'Find all your administrative tools in this menu.',
                            side: "bottom" as const,
                            align: 'start' as const
                        }
                    }] : []),
                    {
                        element: '#sidebar-attendance',
                        popover: {
                            title: 'Attendance System (New!)',
                            description: 'Monitor daily attendance and team presence here. This tracks log-in hours for all staff.',
                            side: "right" as const,
                            align: 'start' as const
                        },
                        onHighlightStarted: () => {
                            if (isMobile) {
                                setSidebarOpen(true);
                                setTimeout(() => driverObj.refresh(), 400);
                            }
                        }
                    },
                    {
                        element: '#sidebar-payroll',
                        popover: {
                            title: 'Payroll Generation (New!)',
                            description: 'Generate monthly payroll and view salary slips for the entire organization.',
                            side: "right" as const,
                            align: 'start' as const
                        },
                        onHighlightStarted: () => {
                            if (isMobile) {
                                setSidebarOpen(true);
                                setTimeout(() => driverObj.refresh(), 400);
                            }
                        }
                    },
                    {
                        element: '#sidebar-org',
                        popover: {
                            title: 'Organization Management',
                            description: 'Create new users, manage roles, and customize organization settings from this tab.',
                            side: "right" as const,
                            align: 'start' as const
                        },
                        onHighlightStarted: () => {
                            if (isMobile) {
                                setSidebarOpen(true);
                                setTimeout(() => driverObj.refresh(), 400);
                            }
                        }
                    },
                ],
                onDestroyed: () => {
                    localStorage.setItem('apple_admin_tour_completed', 'true');
                    if (isMobile) setSidebarOpen(false);
                }
            });


            driverObj.drive();
        }, 2000);


        return () => clearTimeout(timer);
    }, [isAdmin, user, setSidebarOpen]);

    return null; // This component doesn't render anything itself
}
