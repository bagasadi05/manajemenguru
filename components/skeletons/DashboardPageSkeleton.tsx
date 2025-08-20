import React from 'react';
import { Skeleton } from '../ui/Skeleton';

const DashboardPageSkeleton: React.FC = () => {
    return (
        <div className="cosmic-bg w-full min-h-full p-4 sm:p-6 md:p-8 flex flex-col space-y-8">
            {/* Header Skeleton */}
            <div className="space-y-2">
                <Skeleton className="h-10 w-3/4 md:w-1/2" />
                <Skeleton className="h-5 w-1/2 md:w-1/3" />
            </div>

            {/* Stats Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
            </div>

            {/* AI Insight Card Skeleton */}
            <div>
                <Skeleton className="h-64 rounded-2xl" />
            </div>

            {/* Main Content Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Weekly Attendance Skeleton */}
                    <Skeleton className="h-72 rounded-2xl" />
                    {/* Tasks Skeleton */}
                    <Skeleton className="h-64 rounded-2xl" />
                </div>
                <div className="lg:col-span-1">
                    {/* Today's Schedule Skeleton */}
                    <Skeleton className="h-96 rounded-2xl" />
                </div>
            </div>
        </div>
    );
};

export default DashboardPageSkeleton;
