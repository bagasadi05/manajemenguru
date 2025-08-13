import React, { useState, useMemo, useEffect } from 'react';
import { Database } from '@/services/database.types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { generateBehaviorAnalysis } from '@/services/aiService';

type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type ViolationRow = Database['public']['Tables']['violations']['Row'];

export const BehaviorAnalysisTab: React.FC<{ studentName: string; attendance: AttendanceRow[]; violations: ViolationRow[] }> = ({ studentName, attendance, violations }) => {
    const [analysis, setAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const isOnline = useOfflineStatus();

    const absencesByDay = useMemo(() => {
        const dayMap: { [key: string]: number } = { Senin: 0, Selasa: 0, Rabu: 0, Kamis: 0, Jumat: 0 };
        const dayIndexes = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

        attendance.forEach(record => {
            if (record.status === 'Alpha') {
                const dayName = dayIndexes[new Date(record.date).getUTCDay()];
                if (dayMap.hasOwnProperty(dayName)) {
                    dayMap[dayName]++;
                }
            }
        });
        return Object.entries(dayMap);
    }, [attendance]);

    const maxAbsences = useMemo(() => Math.max(...absencesByDay.map(([, count]) => count), 0), [absencesByDay]);

    const runAnalysis = async () => {
        if (!isOnline) {
            setAnalysis("Analisis AI memerlukan koneksi internet.");
            return;
        }
        setIsLoading(true);
        try {
            const result = await generateBehaviorAnalysis(studentName, attendance, violations);
            setAnalysis(result);
        } catch (error) {
            console.error(error);
            setAnalysis("Gagal memuat analisis perilaku. Silakan coba lagi.");
        }
        setIsLoading(false);
    };

    useEffect(() => {
        runAnalysis();
    }, [studentName, attendance, violations]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>Pola Ketidakhadiran (Alpa)</CardTitle>
                    <CardDescription>Visualisasi jumlah ketidakhadiran (alpa) berdasarkan hari.</CardDescription>
                </CardHeader>
                <CardContent>
                    {attendance.filter(a=>a.status === 'Alpha').length > 0 ? (
                        <div className="space-y-4">
                            {absencesByDay.map(([day, count]) => (
                                <div key={day} className="flex items-center gap-4">
                                    <span className="w-16 font-semibold text-sm text-gray-600 dark:text-gray-400">{day}</span>
                                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6">
                                        <div
                                            className="bg-gradient-to-r from-red-400 to-orange-500 h-6 rounded-full flex items-center justify-end pr-2 text-white font-bold text-sm"
                                            style={{ width: maxAbsences > 0 ? `${(count / maxAbsences) * 100}%` : '0%' }}
                                        >
                                            {count > 0 && count}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 py-8">Tidak ada data alpa.</p>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Analisis Perilaku oleh AI</CardTitle>
                    <CardDescription>Ringkasan otomatis berdasarkan data yang ada.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-2 animate-pulse">
                            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
                            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
                            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
                        </div>
                    ) : (
                        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{analysis}</p>
                    )}
                    <Button onClick={runAnalysis} disabled={isLoading || !isOnline} variant="outline" size="sm" className="mt-4">
                        {isLoading ? 'Menganalisis...' : 'Analisis Ulang'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
};
