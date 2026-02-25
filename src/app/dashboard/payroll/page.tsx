'use client';

import { useEffect } from 'react';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import AdminPayrollDashboard from '@/components/payroll/AdminPayrollDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useRouter } from 'next/navigation';

export default function PayrollPage() {
    const { setTitle, clearHeader } = useHeaderTitle();
    const { user, isAdmin, isLoading } = useAuth();
    const { hasPermission } = useUserPermissions();
    const router = useRouter();

    useEffect(() => {
        setTitle('Payroll');
        return () => clearHeader();
    }, [setTitle, clearHeader]);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
        }
    }, [isLoading, user, router]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            </div>
        );
    }

    if (!user) return null;

    if (!isAdmin && !hasPermission('payroll.view')) {
        return (
            <div className="p-6">
                <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm">
                    You do not have permission to view payroll information.
                </div>
            </div>
        );
    }

    return (
        <div className="w-full mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <AdminPayrollDashboard />
        </div>
    );
}
