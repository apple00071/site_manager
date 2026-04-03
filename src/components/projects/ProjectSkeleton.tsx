import React from 'react';

export function ProjectSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Navigation Skeleton - Matches the reserved portal space */}
      <div className="bg-white border-b border-gray-200 sticky top-0 sm:top-[50px] z-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col">
            {/* Stage Navigator Placeholder */}
            <div className="flex gap-4 sm:gap-8 py-3 overflow-x-auto no-scrollbar border-b border-gray-50">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="w-16 h-3 rounded-full modern-skeleton flex-shrink-0" />
              ))}
            </div>
            {/* SubTabNav Placeholder */}
            <div className="flex gap-6 py-3 px-1 overflow-x-auto no-scrollbar">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-12 h-3 rounded modern-skeleton flex-shrink-0" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
              <div className="w-40 h-6 modern-skeleton" />
              <div className="space-y-2">
                <div className="w-full h-4 modern-skeleton" />
                <div className="w-full h-4 modern-skeleton" />
                <div className="w-3/4 h-4 modern-skeleton" />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="h-12 rounded-lg modern-skeleton" />
                <div className="h-12 rounded-lg modern-skeleton" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
              <div className="w-40 h-6 modern-skeleton" />
              <div className="grid grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="w-20 h-3 modern-skeleton" />
                    <div className="w-full h-5 modern-skeleton" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
              <div className="flex justify-between items-center">
                <div className="w-32 h-6 modern-skeleton" />
                <div className="w-20 h-4 modern-skeleton" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full modern-skeleton" />
                    <div className="flex-1 space-y-1">
                      <div className="w-24 h-4 modern-skeleton" />
                      <div className="w-16 h-3 modern-skeleton" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}export function TabSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-48 bg-gray-100 rounded-xl"></div>
        <div className="h-48 bg-gray-100 rounded-xl"></div>
      </div>
      <div className="h-32 bg-gray-50 rounded-xl w-full"></div>
    </div>
  );
}
