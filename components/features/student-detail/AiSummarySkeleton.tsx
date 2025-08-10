import React from 'react';

export const AiSummarySkeleton: React.FC = () => (
    <div className="space-y-6 animate-pulse p-4">
        {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3">
                <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-1/3"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
        ))}
    </div>
);
