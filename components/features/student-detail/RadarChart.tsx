import React, { useState, useMemo } from 'react';
import { Database } from '@/services/database.types';
import { TrendingUpIcon } from '@/components/Icons';

type AcademicRecordRow = Database['public']['Tables']['academic_records']['Row'];

export const RadarChart: React.FC<{ studentRecords: AcademicRecordRow[]; classRecords: Pick<AcademicRecordRow, 'subject' | 'score'>[]; size?: number; }> = ({ studentRecords, classRecords, size = 320 }) => {
    const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

    const data = useMemo(() => {
        const studentSubjects = studentRecords.map(r => r.subject);
        const classSubjects = classRecords.map(r => r.subject);
        const subjects = [...new Set([...studentSubjects, ...classSubjects])];

        return subjects.map(subject => {
            const studentScore = studentRecords.find(r => r.subject === subject)?.score || 0;
            const allScoresForSubject = classRecords.filter(r => r.subject === subject).map(r => r.score);
            const averageScore = allScoresForSubject.length > 0
                ? Math.round(allScoresForSubject.reduce((a, b) => a + b, 0) / allScoresForSubject.length)
                : 0;
            return { subject, studentScore, averageScore };
        });
    }, [studentRecords, classRecords]);

    if (data.length < 3) { return (<div className="flex flex-col items-center justify-center h-64 text-center text-gray-500 dark:text-gray-400"><TrendingUpIcon className="w-12 h-12 mb-4 text-gray-300 dark:text-gray-600" /><h4 className="font-semibold">Data tidak cukup</h4><p className="text-sm">Perlu minimal 3 mata pelajaran dengan nilai untuk menampilkan grafik ini.</p></div>); }

    const maxScore = 100; const center = size / 2; const radius = center * 0.75; const numLevels = 4;
    const angleSlice = (Math.PI * 2) / data.length;
    const getPoint = (value: number, angle: number) => ({ x: center + (value / maxScore) * radius * Math.cos(angle - Math.PI / 2), y: center + (value / maxScore) * radius * Math.sin(angle - Math.PI / 2), });
    const studentPath = data.map((d, i) => getPoint(d.studentScore, angleSlice * i)).map(p => `${p.x},${p.y}`).join(' ');
    const averagePath = data.map((d, i) => getPoint(d.averageScore, angleSlice * i)).map(p => `${p.x},${p.y}`).join(' ');
    const activeData = data.find(d => d.subject === hoveredLabel);

    return (
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="relative">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <g onMouseLeave={() => setHoveredLabel(null)}>{[...Array(numLevels)].map((_, levelIndex) => { const levelRadius = radius * ((levelIndex + 1) / numLevels); const points = data.map((_, i) => { const angle = angleSlice * i - Math.PI / 2; return `${center + levelRadius * Math.cos(angle)},${center + levelRadius * Math.sin(angle)}`; }).join(' '); return <polygon key={levelIndex} points={points} className="fill-gray-100 dark:fill-gray-800/50 stroke-gray-200 dark:stroke-gray-700 stroke-1" />; })}</g>
                    <g>{data.map((_, i) => { const p = getPoint(maxScore, angleSlice * i); return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} className="stroke-gray-200 dark:stroke-gray-700 stroke-1" />; })}</g>
                    <g><polygon points={averagePath} className="fill-gray-400/30 dark:fill-gray-500/30 stroke-gray-500 dark:stroke-gray-400 stroke-1" /><polygon points={studentPath} className="fill-purple-500/30 stroke-purple-600 dark:stroke-purple-400 stroke-2" /></g>
                    <g>{data.map((d, i) => { const p = getPoint(maxScore, angleSlice * i); return <circle key={`dot-${i}`} cx={p.x} cy={p.y} r="10" fill="transparent" onMouseEnter={() => setHoveredLabel(d.subject)} />; })}</g>
                    <g>{data.map((d, i) => { const p = getPoint(maxScore * 1.15, angleSlice * i); const anchor = p.x < center ? 'end' : (p.x > center ? 'start' : 'middle'); return (<text key={d.subject} x={p.x} y={p.y} textAnchor={anchor} alignmentBaseline="middle" onMouseEnter={() => setHoveredLabel(d.subject)} className="text-xs font-semibold fill-current text-gray-600 dark:text-gray-300 cursor-pointer">{d.subject}</text>); })}</g>
                </svg>
                {activeData && (<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-3 bg-gray-800 text-white rounded-lg shadow-xl text-center pointer-events-none z-10 w-48"><h4 className="font-bold text-lg mb-2">{activeData.subject}</h4><div className="flex justify-around text-sm"><div><p className="text-gray-400">Nilai Siswa</p><p className="font-bold text-purple-400 text-2xl">{activeData.studentScore}</p></div><div><p className="text-gray-400">Rata-rata</p><p className="font-bold text-gray-300 text-2xl">{activeData.averageScore}</p></div></div></div>)}
            </div>
             <div className="space-y-4"><div className="flex items-center"><div className="w-4 h-4 rounded-full bg-purple-500/50 border-2 border-purple-600 dark:border-purple-400 mr-3"></div><div><p className="font-semibold text-gray-800 dark:text-gray-200">Nilai Siswa</p><p className="text-sm text-gray-500 dark:text-gray-400">Performa individu siswa.</p></div></div><div className="flex items-center"><div className="w-4 h-4 rounded-full bg-gray-400/50 border-2 border-gray-500 dark:border-gray-400 mr-3"></div><div><p className="font-semibold text-gray-800 dark:text-gray-200">Rata-rata Kelas</p><p className="text-sm text-gray-500 dark:text-gray-400">Performa rata-rata siswa sekelas.</p></div></div></div>
        </div>
    );
};
