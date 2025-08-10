import React from 'react';
import { Database } from '@/services/database.types';
import { Button } from '@/components/ui/Button';
import { PencilIcon, TrashIcon, FileTextIcon, LinkIcon } from '@/components/Icons';

type ReportRow = Database['public']['Tables']['reports']['Row'];

export const ReportTimeline: React.FC<{ reports: ReportRow[], onEdit: (report: ReportRow) => void, onDelete: (reportId: string) => void, isOnline: boolean }> = ({ reports, onEdit, onDelete, isOnline }) => {
    if (reports.length === 0) {
        return (
            <div className="text-center py-16 text-gray-500">
                <FileTextIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <h4 className="text-lg font-semibold">Belum Ada Catatan Perkembangan</h4>
                <p className="text-sm">Catatan yang Anda buat akan ditampilkan di sini.</p>
            </div>
        );
    }

    const sortedReports = [...reports].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="relative pl-4">
            <div className="absolute left-0 top-2 h-full w-0.5 bg-gray-200 dark:bg-gray-700 ml-3" aria-hidden="true"></div>
            {sortedReports.map((report) => (
                <div key={report.id} className="relative mb-8 group">
                    <div className="absolute left-0 top-1.5 w-6 h-6 bg-white dark:bg-gray-950 rounded-full border-4 border-gray-200 dark:border-gray-700 flex items-center justify-center transition-transform duration-300 group-hover:scale-125 group-hover:bg-blue-500 group-hover:border-blue-300">
                        <FileTextIcon className="w-3 h-3 text-gray-500 dark:text-gray-400 group-hover:text-white" />
                    </div>
                    <div className="ml-10 p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/50 dark:border-gray-700/50 transition-all duration-300 shadow-md hover:shadow-xl hover:border-blue-400/50 dark:hover:border-blue-500/50">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-gray-100">{report.title}</h4>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(report.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(report)} aria-label="Edit Laporan" disabled={!isOnline}>
                                    <PencilIcon className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => onDelete(report.id)} aria-label="Hapus Laporan" disabled={!isOnline}>
                                    <TrashIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{report.notes}</p>
                        {report.attachment_url && (
                            <a href={report.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2">
                                <LinkIcon className="h-4 w-4" />
                                Lihat Lampiran
                            </a>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
