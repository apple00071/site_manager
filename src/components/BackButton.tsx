'use client';

import { useRouter } from 'next/navigation';
import { FiArrowLeft } from 'react-icons/fi';

interface BackButtonProps {
  href?: string;
  className?: string;
}

export default function BackButton({ href, className = '' }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  return (
    <button
      onClick={handleBack}
      className={`lg:hidden flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ${className}`}
      aria-label="Go back"
    >
      <FiArrowLeft className="h-5 w-5" />
    </button>
  );
}
