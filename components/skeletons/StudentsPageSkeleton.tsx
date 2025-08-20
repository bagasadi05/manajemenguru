import React from 'react';
import { Skeleton } from '../ui/Skeleton';

const StudentsPageSkeleton: React.FC = () => {
    return (
        <div className="cosmic-bg w-full min-h-full p-4 sm:p-6 md:p-8 relative text-white flex flex-col">
            {/* Header Skeleton */}
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="w-full md:w-1/2 space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-5 w-3/4" />
                </div>
                <div className="flex w-full md:w-auto items-center gap-2">
                    <Skeleton className="h-10 w-full md:w-48" />
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-28" />
                </div>
            </div>

            {/* Class Management Skeleton */}
            <div className="relative z-10 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6 mb-8">
                <Skeleton className="h-8 w-1/3 mb-4" />
                <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </div>

            {/* Students Grid Skeleton */}
            <div className="relative z-10 flex-grow">
                <div className="mb-8">
                    <Skeleton className="h-12 w-1/4 mb-6" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[...Array(8)].map((_, i) => (
                           <div key={i} className="relative p-6 h-full rounded-2xl bg-black/20 border border-white/20">
                                <div className="flex flex-col items-center text-center">
                                    <Skeleton className="w-28 h-28 rounded-full mb-4" />
                                    <Skeleton className="h-6 w-3/4" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentsPageSkeleton;
