import React from 'react';
import { Database } from '@/services/database.types';
import { Button } from '@/components/ui/Button';
import { PencilIcon, TrashIcon, ShieldAlertIcon } from '@/components/Icons';

type ViolationRow = Database['public']['Tables']['violations']['Row'];

export const ViolationHistory: React.FC<{ violations: ViolationRow[], onEdit: (violation: ViolationRow) => void, onDelete: (violationId: string) => void, isOnline: boolean }> = ({ violations, onEdit, onDelete, isOnline }) => {
    if (!violations || violations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500 dark:text-gray-400">
                <ShieldAlertIcon className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" />
                <h4 className="text-lg font-semibold">Tidak Ada Data Pelanggaran</h4>
                <p className="text-sm">Catatan pelanggaran yang Anda tambahkan akan muncul di sini.</p>
            </div>
        );
    }

    const sortedViolations = [...violations].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="space-y-3">
            {sortedViolations.map((violation) => (
                <div key={violation.id} className="group flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 transition-all shadow-sm hover:shadow-lg border border-transparent hover:border-gray-200 dark:hover:border-gray-700">
                    <div className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center font-bold text-2xl bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200">
                        {violation.points}
                    </div>
                    <div className="flex-grow">
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{violation.description}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {new Date(violation.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                    <div className="flex items-center self-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(violation)} aria-label="Edit Pelanggaran" disabled={!isOnline}><PencilIcon className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => onDelete(violation.id)} aria-label="Hapus Pelanggaran" disabled={!isOnline}><TrashIcon className="h-4 w-4" /></Button>
                    </div>
                </div>
            ))}
        </div>
    );
};
