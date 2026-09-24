'use client';

import { useEffect } from 'react';
import { useHeaderTitle } from '@/contexts/HeaderTitleContext';
import AdminPayrollDashboard from '@/components/payroll/AdminPayrollDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useRouter } from 'next/navigation';

export default function PayrollPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/organization?tab=payroll');
    }, [router]);

    return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
        </div>
    );
}
