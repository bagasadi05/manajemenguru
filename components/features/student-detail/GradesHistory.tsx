import React from 'react';
import { Database } from '@/services/database.types';
import { Button } from '@/components/ui/Button';
import { PencilIcon, TrashIcon, BarChartIcon } from '@/components/Icons';

type AcademicRecordRow = Database['public']['Tables']['academic_records']['Row'];

export const GradesHistory: React.FC<{ records: AcademicRecordRow[], onEdit: (record: AcademicRecordRow) => void, onDelete: (recordId: string) => void, isOnline: boolean }> = ({ records, onEdit, onDelete, isOnline }) => {
    if (!records || records.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500 dark:text-gray-400">
                <BarChartIcon className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" />
                <h4 className="text-lg font-semibold">Tidak Ada Data Nilai Mata Pelajaran</h4>
                <p className="text-sm">Nilai yang Anda tambahkan akan muncul di sini.</p>
            </div>
        );
    }

    const sortedRecords = [...records].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const getScoreColorClasses = (score: number) => {
        if (score >= 85) return {
            bg: 'bg-green-50 dark:bg-green-900/30',
            border: 'border-green-400 dark:border-green-600',
            shadow: 'hover:shadow-green-500/20',
            scoreBg: 'bg-green-500',
        };
        if (score >= 70) return {
            bg: 'bg-yellow-50 dark:bg-yellow-900/30',
            border: 'border-yellow-400 dark:border-yellow-600',
            shadow: 'hover:shadow-yellow-500/20',
            scoreBg: 'bg-yellow-500',
        };
        return {
            bg: 'bg-red-50 dark:bg-red-900/30',
            border: 'border-red-400 dark:border-red-600',
            shadow: 'hover:shadow-red-500/20',
            scoreBg: 'bg-red-500',
        };
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedRecords.map((record) => {
                const colors = getScoreColorClasses(record.score);
                return (
                    <div key={record.id} className={`group relative p-4 rounded-xl border-2 ${colors.border} ${colors.bg} ${colors.shadow} transition-all duration-300 transform hover:-translate-y-1`}>
                        <div className="flex items-center gap-4">
                             <div className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center font-black text-3xl text-white ${colors.scoreBg} shadow-inner`}>
                                {record.score}
                            </div>
                            <div className="flex-grow">
                                <h4 className="font-extrabold text-lg text-gray-800 dark:text-gray-200">{record.subject}</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-500 font-medium">
                                    {new Date(record.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                        {record.notes && <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 pt-3 border-t-2 border-dashed border-gray-500/10 italic">"{record.notes}"</p>}
                         <div className="absolute top-3 right-3 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/50 dark:bg-gray-900/50" onClick={() => onEdit(record)} aria-label="Edit Catatan Akademik" disabled={!isOnline}><PencilIcon className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 bg-white/50 dark:bg-gray-900/50" onClick={() => onDelete(record.id)} aria-label="Hapus Catatan Akademik" disabled={!isOnline}><TrashIcon className="h-4 w-4" /></Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
