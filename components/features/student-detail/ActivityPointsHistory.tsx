import React from 'react';
import { Database } from '@/services/database.types';
import { Button } from '@/components/ui/Button';
import { PencilIcon, TrashIcon, CheckCircleIcon } from '@/components/Icons';

type QuizPointRow = Database['public']['Tables']['quiz_points']['Row'];

export const ActivityPointsHistory: React.FC<{ records: QuizPointRow[], onEdit: (record: QuizPointRow) => void, onDelete: (recordId: number) => void, isOnline: boolean }> = ({ records, onEdit, onDelete, isOnline }) => {
    if (!records || records.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500 dark:text-gray-400">
                <CheckCircleIcon className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" />
                <h4 className="text-lg font-semibold">Tidak Ada Poin Keaktifan</h4>
                <p className="text-sm">Poin yang Anda tambahkan akan muncul di sini.</p>
            </div>
        );
    }

    const sortedRecords = [...records].sort((a, b) => new Date(b.quiz_date).getTime() - new Date(a.quiz_date).getTime());

    return (
        <div className="space-y-3">
            {sortedRecords.map((record) => (
                <div key={record.id} className="group flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 transition-all shadow-sm hover:shadow-lg border border-transparent hover:border-gray-200 dark:hover:border-gray-700">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-2xl bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200">
                        +1
                    </div>
                    <div className="flex-grow">
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{record.quiz_name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {record.subject} &middot; {new Date(record.quiz_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}
                        </p>
                    </div>
                    <div className="flex items-center self-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(record)} aria-label="Edit Poin Keaktifan" disabled={!isOnline}><PencilIcon className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => onDelete(record.id)} aria-label="Hapus Poin Keaktifan" disabled={!isOnline}><TrashIcon className="h-4 w-4" /></Button>
                    </div>
                </div>
            ))}
        </div>
    );
};
