'use client';

import React from 'react';

interface PayrollSectionProps {
    isAdmin?: boolean;
}

export default function PayrollSection({ isAdmin = false }: PayrollSectionProps) {
    return (
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Payroll</h2>
            <p className="text-gray-600">
                Payroll functionality will be available soon. Please check back later.
            </p>
        </div>
    );
}
