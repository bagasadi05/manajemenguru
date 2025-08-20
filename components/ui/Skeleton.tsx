import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700/50 rounded-md animate-shimmer bg-gradient-to-r from-transparent via-gray-400/20 to-transparent bg-[length:200%_100%] ${className}`}
      {...props}
    />
  );
};
