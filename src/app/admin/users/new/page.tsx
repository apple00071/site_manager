'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacyAdminNewUserRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/users/new');
  }, [router]);

  return null;
}