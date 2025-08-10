import React from 'react';
import { BarChartIcon } from '@/components/Icons';
import { AttendanceStatus } from '@/types';

export const StackedProgressBar: React.FC<{ summary: Record<string, number>; total: number }> = ({ summary, total }) => {
    const segments = [
        { status: 'Hadir', color: 'bg-green-500', value: summary[AttendanceStatus.Hadir] || 0 },
        { status: 'Izin', color: 'bg-yellow-500', value: summary[AttendanceStatus.Izin] || 0 },
        { status: 'Sakit', color: 'bg-blue-500', value: summary[AttendanceStatus.Sakit] || 0 },
        { status: 'Alpha', color: 'bg-red-500', value: summary[AttendanceStatus.Alpha] || 0 },
    ];

    if (total === 0) {
        return (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                <BarChartIcon className="w-10 h-10 mx-auto text-gray-400 dark:text-gray-500" />
                <p className="mt-2 font-medium">Tidak ada data kehadiran</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex h-4 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" role="progressbar" aria-valuenow={summary[AttendanceStatus.Hadir] || 0} aria-valuemin={0} aria-valuemax={total}>
                {segments.filter(s => s.value > 0).map((segment) => (
                    <div
                        key={segment.status}
                        style={{ width: `${(segment.value / total) * 100}%` }}
                        className={`${segment.color} transition-all duration-500 ease-out`}
                        title={`${segment.status}: ${segment.value} hari`}
                    ></div>
                ))}
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                {segments.map(({ status, color, value }) => (
                    <div key={status} className="flex items-center p-2 rounded-md bg-gray-50 dark:bg-gray-800/50">
                        <span className={`w-3 h-3 rounded-full mr-2.5 ${color} flex-shrink-0`}></span>
                        <div className="flex-1">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{status}</span>
                            <span className="text-gray-600 dark:text-gray-400 ml-1.5">({value})</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
