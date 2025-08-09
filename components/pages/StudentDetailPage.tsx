
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AttendanceStatus } from '../../types';
import { useToast } from '../../hooks/useToast';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon, AlertCircleIcon, FileTextIcon, UserCircleIcon, BarChartIcon, PencilIcon, TrashIcon, BookOpenIcon, SparklesIcon, ClockIcon, TrendingUpIcon, PlusIcon, LinkIcon, BrainCircuitIcon, CameraIcon, ShieldAlertIcon } from '../Icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { Modal } from '../ui/Modal';
import { GoogleGenAI, Type } from '@google/genai';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Switch } from '../ui/Switch';
import { Database } from '../../services/database.types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { optimizeImage } from '../utils/image';
import { violationList, ViolationItem } from '../../services/violations.data';

type StudentRow = Database['public']['Tables']['students']['Row'];
type ClassRow = Database['public']['Tables']['classes']['Row'];
type ReportRow = Database['public']['Tables']['reports']['Row'];
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type AcademicRecordRow = Database['public']['Tables']['academic_records']['Row'];
type ViolationRow = Database['public']['Tables']['violations']['Row'];
type QuizPointRow = Database['public']['Tables']['quiz_points']['Row'];

type StudentWithClass = StudentRow & { classes: Pick<ClassRow, 'id' | 'name'> | null };
type StudentDetailsData = {
    student: StudentWithClass,
    reports: ReportRow[],
    attendanceRecords: AttendanceRow[],
    academicRecords: AcademicRecordRow[],
    quizPoints: QuizPointRow[],
    violations: ViolationRow[],
    classAcademicRecords: Pick<AcademicRecordRow, 'subject' | 'score'>[],
    classes: ClassRow[],
};

type ModalState = 
    | { type: 'closed' }
    | { type: 'editStudent' }
    | { type: 'report', data: ReportRow | null }
    | { type: 'academic', data: AcademicRecordRow | null }
    | { type: 'quiz', data: QuizPointRow | null }
    | { type: 'violation', mode: 'add' | 'edit', data: ViolationRow | null }
    | { type: 'confirmDelete', title: string; message: string; onConfirm: () => void; isPending: boolean };

type AiSummary = {
    general_evaluation: string;
    strengths: string;
    development_focus: string;
    recommendations: string;
};

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });


const StatCard: React.FC<{ icon: React.FC<any>, label: string, value: string | number, color: string }> = ({ icon: Icon, label, value, color }) => (
    <Card className="p-4 flex-1">
        <div className="flex items-center gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br ${color}`}>
                 <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
            </div>
        </div>
    </Card>
);

const GradesHistory: React.FC<{ records: AcademicRecordRow[], onEdit: (record: AcademicRecordRow) => void, onDelete: (recordId: string) => void, isOnline: boolean }> = ({ records, onEdit, onDelete, isOnline }) => {
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

const ActivityPointsHistory: React.FC<{ records: QuizPointRow[], onEdit: (record: QuizPointRow) => void, onDelete: (recordId: number) => void, isOnline: boolean }> = ({ records, onEdit, onDelete, isOnline }) => {
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


const ViolationHistory: React.FC<{ violations: ViolationRow[], onEdit: (violation: ViolationRow) => void, onDelete: (violationId: string) => void, isOnline: boolean }> = ({ violations, onEdit, onDelete, isOnline }) => {
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


const ReportTimeline: React.FC<{ reports: ReportRow[], onEdit: (report: ReportRow) => void, onDelete: (reportId: string) => void, isOnline: boolean }> = ({ reports, onEdit, onDelete, isOnline }) => {
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


const AiSummarySkeleton: React.FC = () => (
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

const sectionStyles: { [key: string]: { color: string; borderColor: string; } } = {
    'Evaluasi Umum': { color: 'text-blue-500', borderColor: 'border-blue-500' },
    'Kekuatan': { color: 'text-green-500', borderColor: 'border-green-500' },
    'Fokus Pengembangan': { color: 'text-yellow-500', borderColor: 'border-yellow-500' },
    'Rekomendasi': { color: 'text-purple-500', borderColor: 'border-purple-500' },
};

const AiSummaryDisplay: React.FC<{ summary: any }> = ({ summary }) => {
    if (!summary || typeof summary !== 'object') return null;

    const sections = [
        { title: 'Evaluasi Umum', content: summary.general_evaluation, icon: UserCircleIcon },
        { title: 'Kekuatan', content: summary.strengths, icon: CheckCircleIcon },
        { title: 'Fokus Pengembangan', content: summary.development_focus, icon: PencilIcon },
        { title: 'Rekomendasi', content: summary.recommendations, icon: TrendingUpIcon },
    ].filter(section => section.content);

    return (
        <div className="space-y-6">
            {sections.map(({ title, content, icon: Icon }) => {
                const style = sectionStyles[title];
                return (
                    <div key={title} className={`p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-l-4 ${style.borderColor}`}>
                        <h3 className={`flex items-center gap-3 text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 ${style.color}`}>
                            <Icon className="w-6 h-6" />
                            <span>{title}</span>
                        </h3>
                        <p className="pl-10 text-gray-700 dark:text-gray-300 text-justify">{content}</p>
                    </div>
                );
            })}
        </div>
    );
};


const StackedProgressBar: React.FC<{ summary: Record<string, number>; total: number }> = ({ summary, total }) => {
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

const RadarChart: React.FC<{ studentRecords: AcademicRecordRow[]; classRecords: Pick<AcademicRecordRow, 'subject' | 'score'>[]; size?: number; }> = ({ studentRecords, classRecords, size = 320 }) => {
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

const ConfirmActionModal: React.FC<{ modalState: Extract<ModalState, { type: 'confirmDelete' }>; onClose: () => void }> = ({ modalState, onClose }) => (
    <Modal isOpen={true} onClose={onClose} title={modalState.title} icon={<AlertCircleIcon className="w-5 h-5"/>}>
        <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">{modalState.message}</p>
            <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={onClose} disabled={modalState.isPending}>Batal</Button>
                <Button variant="destructive" onClick={modalState.onConfirm} disabled={modalState.isPending}>
                    {modalState.isPending ? 'Menghapus...' : 'Ya, Hapus'}
                </Button>
            </div>
        </div>
    </Modal>
);

const BehaviorAnalysisTab: React.FC<{ studentName: string; attendance: AttendanceRow[]; violations: ViolationRow[] }> = ({ studentName, attendance, violations }) => {
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
    
    const generateAnalysis = async () => {
        if (!isOnline) {
            setAnalysis("Analisis AI memerlukan koneksi internet.");
            return;
        }
        setIsLoading(true);
        try {
            const systemInstruction = "Anda adalah seorang konselor sekolah yang menganalisis data perilaku siswa. Berikan analisis singkat, jelas, dan profesional dalam 1-2 paragraf. Fokus pada pola yang muncul dan berikan saran konstruktif jika diperlukan.";
            
            const attendanceSummary = attendance.length > 0
                ? `Total ${attendance.filter(a => a.status === 'Alpha').length} kali alpha, ${attendance.filter(a => a.status === 'Sakit').length} kali sakit, ${attendance.filter(a => a.status === 'Izin').length} kali izin.`
                : 'Tidak ada data absensi.';

            const violationSummary = violations.length > 0
                ? `Total ${violations.length} pelanggaran dengan total ${violations.reduce((sum, v) => sum + v.points, 0)} poin.`
                : 'Tidak ada catatan pelanggaran.';

            const prompt = `
                Analisis data perilaku untuk siswa bernama ${studentName}.
                
                Data Absensi:
                ${attendanceSummary}
                Rincian alpha per hari: ${JSON.stringify(Object.fromEntries(absencesByDay))}

                Data Pelanggaran:
                ${violationSummary}
                
                Berikan analisis singkat tentang pola perilaku yang mungkin terlihat dari data ini.
            `;

            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction } });
            setAnalysis(response.text);
        } catch (error) {
            console.error(error);
            setAnalysis("Gagal memuat analisis perilaku. Silakan coba lagi.");
        }
        setIsLoading(false);
    };

    useEffect(() => {
        generateAnalysis();
    }, [attendance, violations]); // Re-run if data changes

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>Pola Ketidakhadiran (Alpha)</CardTitle>
                    <CardDescription>Visualisasi jumlah ketidakhadiran (alpha) berdasarkan hari.</CardDescription>
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
                        <p className="text-center text-gray-500 py-8">Tidak ada data alpha.</p>
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
                    <Button onClick={generateAnalysis} disabled={isLoading || !isOnline} variant="outline" size="sm" className="mt-4">
                        {isLoading ? 'Menganalisis...' : 'Analisis Ulang'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}


const StudentDetailPage: React.FC = () => {
    const { studentId } = useParams<{ studentId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isOnline = useOfflineStatus();

    const getLocalDateString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    const [modalState, setModalState] = useState<ModalState>({ type: 'closed' });
    const [reportFile, setReportFile] = useState<File | null>(null);
    const [aiSummaryState, setAiSummaryState] = useState<{ loading: boolean, error: string | null, content: AiSummary | null }>({ loading: false, error: null, content: null });
    const avatarFileInputRef = useRef<HTMLInputElement>(null);
    const [isEditingAiSummary, setIsEditingAiSummary] = useState(false);
    const [editableAiSummary, setEditableAiSummary] = useState<AiSummary | null>(null);
    const [violationSelection, setViolationSelection] = useState<ViolationItem | null>(null);
    const [violationEntryMode, setViolationEntryMode] = useState<'list' | 'custom'>('list');

    const { data: pageData, isLoading, isError, error: queryError } = useQuery({
        queryKey: ['studentDetails', studentId],
        queryFn: async (): Promise<StudentDetailsData> => {
            if (!studentId || !user) throw new Error("Student ID or user not available");

            const studentRes = await supabase.from('students').select('*, classes(id, name)').eq('id', studentId).eq('user_id', user.id).single();
            if (studentRes.error) throw new Error(studentRes.error.message);
            const studentData = studentRes.data as StudentWithClass;
            
            // Fetch classmates to scope the academic records query
            const { data: classmates } = await supabase.from('students').select('id').eq('class_id', studentData.class_id!);
            const classmateIds = (classmates || []).map(s => s.id);

            const [reportsRes, attendanceRes, academicRes, quizPointsRes, violationsRes, classAcademicRes, classesRes] = await Promise.all([
                supabase.from('reports').select('*').eq('student_id', studentId),
                supabase.from('attendance').select('*').eq('student_id', studentId),
                supabase.from('academic_records').select('*').eq('student_id', studentId),
                supabase.from('quiz_points').select('*').eq('student_id', studentId),
                supabase.from('violations').select('*').eq('student_id', studentId),
                supabase.from('academic_records').select('subject, score').in('student_id', classmateIds),
                supabase.from('classes').select('*').eq('user_id', user.id),
            ]);

            // Handle potential errors for all promises
            if (reportsRes.error) throw new Error(reportsRes.error.message);
            if (attendanceRes.error) throw new Error(attendanceRes.error.message);
            if (academicRes.error) throw new Error(academicRes.error.message);
            if (quizPointsRes.error) throw new Error(quizPointsRes.error.message);
            if (violationsRes.error) throw new Error(violationsRes.error.message);
            if (classAcademicRes.error) throw new Error(classAcademicRes.error.message);
            if (classesRes.error) throw new Error(classesRes.error.message);

            return {
                student: studentData,
                reports: reportsRes.data || [],
                attendanceRecords: attendanceRes.data || [],
                academicRecords: academicRes.data || [],
                quizPoints: quizPointsRes.data || [],
                violations: violationsRes.data || [],
                classAcademicRecords: classAcademicRes.data || [],
                classes: classesRes.data || [],
            }
        },
        enabled: !!studentId && !!user,
    });

    const { student, reports = [], attendanceRecords = [], academicRecords = [], quizPoints = [], violations = [], classAcademicRecords = [], classes = [] } = pageData || {};
    const studentClass = student?.classes as ClassRow | null;
    
    const generateAndGetAiSummary = async (): Promise<AiSummary | null> => {
        if (!student) return null;
        setAiSummaryState({ loading: true, error: null, content: null });
        setIsEditingAiSummary(false); // Exit editing mode on regenerate

        try {
            const academicData = academicRecords.length > 0 ? academicRecords.map(r => `- Nilai Mapel ${r.subject}: ${r.score}, Catatan: ${r.notes}`).join('\n') : 'Tidak ada data nilai mata pelajaran.';
            const activityData = quizPoints.length > 0 ? `Total ${quizPoints.length} poin keaktifan tercatat. Aktivitas: ${[...new Set(quizPoints.map(q => q.quiz_name))].join(', ')}.` : 'Tidak ada data poin keaktifan.';
            const attendanceData = totalAttendanceDays > 0 ? Object.entries(attendanceSummary).map(([status, count]) => `- ${status}: ${count} hari`).join('\n') : 'Tidak ada data kehadiran.';
            const reportData = reports.length > 0 ? reports.map(r => `- ${r.title}: ${r.notes}`).join('\n') : 'Tidak ada catatan perkembangan.';
            const violationData = violations.length > 0 ? violations.map(v => `- ${v.description}: ${v.points} poin`).join('\n') : 'Tidak ada data pelanggaran.';
            
            const systemInstruction = `Anda adalah seorang psikolog pendidikan dan analis performa siswa yang sangat berpengalaman. Gaya tulisan Anda suportif, profesional, dan mudah dipahami oleh guru dan orang tua. Hindari jargon teknis dan bahasa yang terlalu kaku seperti AI. Ubah data mentah menjadi wawasan naratif yang dapat ditindaklanjuti. Anda HARUS memberikan output dalam format JSON yang valid sesuai skema.`;
            
            const prompt = `Analisis data siswa berikut untuk ${student.name} dan hasilkan ringkasan evaluasi yang komprehensif dalam format JSON. Tulis setiap bagian dalam bentuk paragraf yang mengalir alami dan informatif.

**Data Nilai Mata Pelajaran:**
${academicData}

**Data Poin Keaktifan:**
${activityData}

**Ringkasan Kehadiran:**
${attendanceData}

**Catatan Guru Sebelumnya:**
${reportData}

**Data Pelanggaran:**
${violationData}

Isi struktur JSON sesuai dengan data yang diberikan.`;
            
            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    general_evaluation: {
                        type: Type.STRING,
                        description: "Satu paragraf (2-4 kalimat) untuk evaluasi umum siswa, ditulis dalam bahasa yang alami.",
                    },
                    strengths: {
                        type: Type.STRING,
                        description: "Satu paragraf (2-4 kalimat) yang merinci kekuatan utama siswa.",
                    },
                    development_focus: {
                        type: Type.STRING,
                        description: "Satu paragraf (2-4 kalimat) yang menjelaskan area fokus untuk pengembangan siswa.",
                    },
                    recommendations: {
                        type: Type.STRING,
                        description: "Satu paragraf (2-4 kalimat) dengan rekomendasi yang dapat ditindaklanjuti untuk guru/orang tua.",
                    },
                },
                required: ["general_evaluation", "strengths", "development_focus", "recommendations"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema,
                }
            });
            
            const summaryContent = JSON.parse(response.text);
            setAiSummaryState({ loading: false, error: null, content: summaryContent });
            setEditableAiSummary(summaryContent);
            return summaryContent;

        } catch (error: any) {
            console.error("Gemini API Error:", error);
            const errorMessage = "Gagal menghasilkan analisis. Silakan coba lagi.";
            setAiSummaryState({ loading: false, error: errorMessage, content: null });
            toast.error(errorMessage);
            return null;
        }
    };

    useEffect(() => {
        if (isError) {
            toast.error((queryError as Error).message);
            navigate('/siswa', { replace: true });
        } else if (pageData && !aiSummaryState.content && !aiSummaryState.loading && !aiSummaryState.error && isOnline) {
            // Auto-generate AI summary on page load if online
            generateAndGetAiSummary();
        }
    }, [isError, queryError, toast, navigate, pageData, isOnline]);

    const handleEditAiSummary = () => {
        setEditableAiSummary(aiSummaryState.content);
        setIsEditingAiSummary(true);
    };

    const handleCancelEditAiSummary = () => {
        setIsEditingAiSummary(false);
        setEditableAiSummary(null);
    };

    const handleSaveAiSummary = () => {
        setAiSummaryState(prevState => ({ ...prevState, content: editableAiSummary }));
        setIsEditingAiSummary(false);
        toast.success("Ringkasan AI berhasil diperbarui.");
    };

    const handleSummaryInputChange = (section: keyof AiSummary, value: string) => {
        if (editableAiSummary) {
            setEditableAiSummary((prev: AiSummary | null) => {
                if (!prev) return null;
                return {
                    ...prev,
                    [section]: value
                };
            });
        }
    };

    const handlePrintReport = () => {
        if (!isOnline) {
            toast.warning("Mencetak rapor memerlukan koneksi internet untuk memuat data terbaru.");
            return;
        }
        navigate(`/cetak-rapot/${studentId}`);
    };


    const createOrUpdateReportMutation = useMutation({
        mutationFn: async ({ payload, file }: { payload: Omit<ReportRow, 'created_at' | 'id'> & {id?: string}, file: File | null }) => {
            let attachment_url = payload.attachment_url;
            if (file && user && student) {
                const filePath = `${user.id}/${student.id}-${Date.now()}-${file.name}`;
                const { error: uploadError } = await supabase.storage.from('teacher_assets').upload(filePath, file);
                if (uploadError) throw uploadError;
                attachment_url = supabase.storage.from('teacher_assets').getPublicUrl(filePath).data.publicUrl;
            }
            
            const { id, ...dataToMutate } = { ...payload, attachment_url, user_id: user!.id, student_id: student!.id };

            if (id) {
                const { error } = await supabase.from('reports').update(dataToMutate).eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('reports').insert(dataToMutate);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            toast.success("Laporan berhasil disimpan!");
            queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
            setModalState({ type: 'closed' });
        },
        onError: (error: Error) => toast.error(`Gagal menyimpan laporan: ${error.message}`),
    });
    
    const deleteReportMutation = useMutation({
        mutationFn: async (reportId: string) => { const { error } = await supabase.from('reports').delete().eq('id', reportId); if (error) throw error; },
        onSuccess: () => {
            toast.success("Laporan berhasil dihapus.");
            queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
            setModalState({ type: 'closed' });
        },
        onError: (error: Error) => toast.error(error.message),
    });

    const createOrUpdateAcademicMutation = useMutation({
        mutationFn: async (payload: Omit<AcademicRecordRow, 'created_at' | 'id'> & { id?: string }) => {
            const { id, ...dataToMutate } = { ...payload, user_id: user!.id, student_id: student!.id };
            if(id) {
                const { error } = await supabase.from('academic_records').update(dataToMutate).eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('academic_records').insert(dataToMutate);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            toast.success("Nilai mata pelajaran berhasil disimpan!");
            queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
            setModalState({ type: 'closed' });
        },
        onError: (error: Error) => toast.error(error.message)
    });

    const deleteAcademicMutation = useMutation({
        mutationFn: async (recordId: string) => { const { error } = await supabase.from('academic_records').delete().eq('id', recordId); if (error) throw error; },
        onSuccess: () => {
            toast.success("Nilai mata pelajaran berhasil dihapus.");
            queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
            setModalState({ type: 'closed' });
        },
        onError: (error: Error) => toast.error(error.message),
    });
    
    const createOrUpdateQuizPointMutation = useMutation({
        mutationFn: async (payload: Omit<QuizPointRow, 'created_at' | 'id'> & { id?: number }) => {
            const { id, ...dataToMutate } = { ...payload, user_id: user!.id, student_id: student!.id };
            if (id) {
                const { error } = await supabase.from('quiz_points').update(dataToMutate).eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('quiz_points').insert(dataToMutate);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            toast.success("Poin keaktifan berhasil disimpan!");
            queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
            setModalState({ type: 'closed' });
        },
        onError: (error: Error) => toast.error(`Gagal menyimpan poin: ${error.message}`)
    });

    const deleteQuizPointMutation = useMutation({
        mutationFn: async (recordId: number) => {
            const { error } = await supabase.from('quiz_points').delete().eq('id', recordId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Poin keaktifan berhasil dihapus.");
            queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
            setModalState({ type: 'closed' });
        },
        onError: (error: Error) => toast.error(error.message),
    });


    const createOrUpdateViolationMutation = useMutation({
        mutationFn: async (payload: Database['public']['Tables']['violations']['Insert']) => {
            const { id, ...dataToMutate } = { ...payload, user_id: user!.id, student_id: student!.id };
            if(id) {
                const { error } = await supabase.from('violations').update(dataToMutate).eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('violations').insert(dataToMutate);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            toast.success("Data pelanggaran berhasil disimpan!");
            queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
            setModalState({ type: 'closed' });
        },
        onError: (error: Error) => toast.error(error.message)
    });

    const deleteViolationMutation = useMutation({
        mutationFn: async (violationId: string) => { const { error } = await supabase.from('violations').delete().eq('id', violationId); if (error) throw error; },
        onSuccess: () => {
            toast.success("Data pelanggaran berhasil dihapus.");
            queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
            setModalState({ type: 'closed' });
        },
        onError: (error: Error) => toast.error(error.message),
    });

    const updateStudentMutation = useMutation({
        mutationFn: async (updateData: Database['public']['Tables']['students']['Update']) => { const { error } = await supabase.from('students').update(updateData).eq('id', studentId!); if (error) throw error; },
        onSuccess: () => {
            toast.success("Profil siswa berhasil diperbarui!");
            queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
            setModalState({ type: 'closed' });
        },
        onError: (error: Error) => toast.error(error.message),
    });

    const updateAvatarMutation = useMutation({
        mutationFn: async (avatar_url: string) => {
            const { error } = await supabase.from('students').update({ avatar_url }).eq('id', studentId!);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Foto profil siswa berhasil diperbarui!");
            queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
            queryClient.invalidateQueries({ queryKey: ['studentsPageData'] });
        },
        onError: (error: Error) => {
            toast.error(`Gagal memperbarui foto profil: ${error.message}`);
        }
    });

    const deleteStudentMutation = useMutation({
        mutationFn: async () => {
            if (!studentId) throw new Error("Student ID tidak ditemukan.");
            const dependentTables = ['reports', 'attendance', 'academic_records', 'violations', 'quiz_points'];
            const deletePromises = dependentTables.map(table => supabase.from(table).delete().eq('student_id', studentId));
            const results = await Promise.all(deletePromises);
            for (const result of results) { if (result.error) throw new Error(`Gagal menghapus data terkait: ${result.error.message}`); }
            const { error: studentError } = await supabase.from('students').delete().eq('id', studentId);
            if (studentError) throw new Error(`Gagal menghapus data siswa: ${studentError.message}`);
        },
        onSuccess: () => { toast.success('Siswa berhasil dihapus beserta semua data terkait.'); queryClient.invalidateQueries({ queryKey: ['studentsPageData', 'dashboardData', 'studentDetails'] }); navigate('/siswa', { replace: true }); },
        onError: (error: Error) => toast.error(`Proses hapus gagal: ${error.message}`),
    });

    const attendanceSummary = useMemo(() => attendanceRecords.reduce((acc, record) => { acc[record.status] = (acc[record.status] || 0) + 1; return acc; }, {} as Record<AttendanceStatus, number>), [attendanceRecords]);
    const totalAttendanceDays = attendanceRecords.length;
    const presentDays = attendanceSummary.Hadir || 0;
    const attendancePercentage = totalAttendanceDays > 0 ? ((presentDays / totalAttendanceDays) * 100).toFixed(0) : '100';
    const totalAlphaDays = attendanceSummary.Alpha || 0;
    const totalViolationPoints = useMemo(() => violations.reduce((sum, v) => sum + v.points, 0), [violations]);
    const averageScore = useMemo(() => { if (academicRecords.length === 0) return 0; const totalScore = academicRecords.reduce((sum, record) => sum + record.score, 0); return Math.round(totalScore / academicRecords.length); }, [academicRecords]);

    const timelineItems = useMemo(() => {
        if (!pageData) return [];
        const items = [
            ...reports.map(item => ({ date: new Date(item.date), type: 'report', item, icon: FileTextIcon, color: 'blue' })),
            ...academicRecords.map(item => ({ date: new Date(item.created_at), type: 'academic', item, icon: BarChartIcon, color: 'green' })),
            ...quizPoints.map(item => ({ date: new Date(item.quiz_date), type: 'quiz', item, icon: CheckCircleIcon, color: 'indigo'})),
            ...violations.map(item => ({ date: new Date(item.date), type: 'violation', item, icon: ShieldAlertIcon, color: 'orange' })),
            ...attendanceRecords.filter(item => item.status !== 'Hadir').map(item => ({ date: new Date(item.date), type: 'attendance', item, icon: ClockIcon, color: 'yellow' })),
        ];
        return items.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [pageData]);

    const handleAvatarUpload = async (file: File) => {
        if (!user || !student) return;
        
        try {
            updateAvatarMutation.mutate(URL.createObjectURL(file)); // Show preview immediately
            const optimizedBlob = await optimizeImage(file, { maxWidth: 300, quality: 0.8 });
            const optimizedFile = new File([optimizedBlob], `${user.id}-student-${student.id}.jpg`, { type: 'image/jpeg' });
            
            const filePath = `${user.id}/student_avatars/${student.id}-${Date.now()}.jpg`;
            const { error: uploadError } = await supabase.storage.from('teacher_assets').upload(filePath, optimizedFile, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('teacher_assets').getPublicUrl(filePath);

            if (publicUrl) {
                const cacheBustedUrl = `${publicUrl}?t=${new Date().getTime()}`;
                updateAvatarMutation.mutate(cacheBustedUrl);
            } else {
                throw new Error("Tidak bisa mendapatkan URL publik untuk foto.");
            }
        } catch(err: any) {
             toast.error(`Gagal mengunggah foto: ${err.message}`);
             queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] }); // Revert preview
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleAvatarUpload(file);
        }
    };
    
    const handleReportFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const editingReport = modalState.type === 'report' ? modalState.data : null;
        const formData = new FormData(e.currentTarget);
        const payload: Omit<ReportRow, 'created_at'> & {id?: string} = {
            id: editingReport?.id, title: formData.get('title') as string, notes: formData.get('notes') as string,
            attachment_url: editingReport?.attachment_url || null, date: editingReport?.date || getLocalDateString(),
            student_id: studentId!, user_id: user!.id,
        };
        createOrUpdateReportMutation.mutate({ payload, file: reportFile });
        setReportFile(null);
    };

    const handleDeleteReport = (reportId: string) => setModalState({ type: 'confirmDelete', title: 'Hapus Laporan', message: 'Anda yakin ingin menghapus laporan ini?', onConfirm: () => deleteReportMutation.mutate(reportId), isPending: deleteReportMutation.isPending || !isOnline });
    
    const handleAcademicRecordFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const editingRecord = modalState.type === 'academic' ? modalState.data : null;
        const formData = new FormData(e.currentTarget);
        const payload = {
            id: editingRecord?.id,
            subject: formData.get('subject') as string,
            score: Number(formData.get('score')),
            notes: formData.get('notes') as string,
            student_id: studentId!,
            user_id: user!.id,
        };
        createOrUpdateAcademicMutation.mutate(payload);
    };
    
    const handleDeleteAcademicRecord = (recordId: string) => setModalState({ type: 'confirmDelete', title: 'Hapus Nilai Mata Pelajaran', message: 'Anda yakin ingin menghapus catatan nilai ini?', onConfirm: () => deleteAcademicMutation.mutate(recordId), isPending: deleteAcademicMutation.isPending || !isOnline });
    
    const handleQuizPointFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const editingRecord = modalState.type === 'quiz' ? modalState.data : null;
        const formData = new FormData(e.currentTarget);
        const payload = {
            id: editingRecord?.id,
            subject: formData.get('subject') as string,
            quiz_name: formData.get('quiz_name') as string,
            points: 1,
            max_points: 1,
            quiz_date: formData.get('quiz_date') as string,
            student_id: studentId!,
            user_id: user!.id,
        };
        createOrUpdateQuizPointMutation.mutate(payload);
    };
    
    const handleDeleteQuizPoint = (recordId: number) => setModalState({ type: 'confirmDelete', title: 'Hapus Poin Keaktifan', message: 'Anda yakin ingin menghapus poin ini?', onConfirm: () => deleteQuizPointMutation.mutate(recordId), isPending: deleteQuizPointMutation.isPending || !isOnline });


    const handleViolationFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (modalState.type !== 'violation') return;

        const formData = new FormData(e.currentTarget);
        let payload: Database['public']['Tables']['violations']['Insert'];
        
        if (modalState.mode === 'add') {
            if (violationEntryMode === 'list') {
                const violationCode = formData.get('violation_code') as string;
                const selectedViolation = violationList.find(v => v.code === violationCode);
                if (!selectedViolation) {
                    toast.error("Silakan pilih jenis pelanggaran.");
                    return;
                }
                payload = {
                    date: (formData.get('date') as string) || getLocalDateString(),
                    description: selectedViolation.description,
                    points: selectedViolation.points,
                    student_id: studentId!,
                    user_id: user!.id,
                };
            } else { // custom mode
                payload = {
                    date: (formData.get('date') as string) || getLocalDateString(),
                    description: formData.get('description') as string,
                    points: Number(formData.get('points')),
                    student_id: studentId!,
                    user_id: user!.id,
                };
            }
        } else {
            const editingViolation = modalState.data!;
            payload = {
                id: editingViolation.id,
                date: formData.get('date') as string,
                description: formData.get('description') as string,
                points: Number(formData.get('points')),
                student_id: studentId!,
                user_id: user!.id,
            };
        }
        
        createOrUpdateViolationMutation.mutate(payload);
    };

    const handleDeleteViolation = (violationId: string) => setModalState({ type: 'confirmDelete', title: 'Hapus Pelanggaran', message: 'Anda yakin ingin menghapus catatan pelanggaran ini?', onConfirm: () => deleteViolationMutation.mutate(violationId), isPending: deleteViolationMutation.isPending || !isOnline });

    const handleUpdateStudent = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault(); if(!student) return;
        const formData = new FormData(e.currentTarget);
        const name = formData.get('name') as string;
        const class_id = formData.get('class_id') as string;
        const gender = formData.get('gender') as 'Laki-laki' | 'Perempuan';

        const updatedData: Database['public']['Tables']['students']['Update'] = { name, class_id, gender };
        
        if (student.gender !== gender && student.avatar_url.includes('avatar.iran.liara.run')) {
             const avatarGender = gender === 'Laki-laki' ? 'boy' : 'girl';
            const new_avatar_url = `https://avatar.iran.liara.run/public/${avatarGender}?username=${encodeURIComponent(name || Date.now())}`;
            updatedData.avatar_url = new_avatar_url;
        }

        updateStudentMutation.mutate(updatedData);
    };

    const handleDeleteStudent = () => setModalState({ type: 'confirmDelete', title: 'Hapus Siswa', message: 'Aksi ini tidak dapat dibatalkan dan akan menghapus semua data terkait siswa ini (laporan, absensi, nilai, pelanggaran). Yakin melanjutkan?', onConfirm: () => deleteStudentMutation.mutate(), isPending: deleteStudentMutation.isPending || !isOnline });
    
    
    if (isLoading) return <div className="flex items-center justify-center h-screen"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    if (isError || !student) return <div className="text-center py-10">Siswa tidak ditemukan.</div>;
    
    const summarySections: { key: keyof AiSummary, label: string }[] = [
        { key: 'general_evaluation', label: 'Evaluasi Umum' },
        { key: 'strengths', label: 'Kekuatan' },
        { key: 'development_focus', label: 'Fokus Pengembangan' },
        { key: 'recommendations', label: 'Rekomendasi' }
    ];

    const renderTimelineItem = (timelineItem: any) => {
        const { type, item, icon: Icon, color } = timelineItem;
        let title = '';
        let content: React.ReactNode = null;

        switch (type) {
            case 'report':
                title = item.title;
                content = <p className="text-sm text-gray-700 dark:text-gray-300">{item.notes}</p>;
                break;
            case 'academic':
                title = `Nilai Mapel ${item.subject}: ${item.score}`;
                content = <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{item.notes}"</p>;
                break;
            case 'quiz':
                title = `Poin Keaktifan: ${item.quiz_name}`;
                content = <p className="text-sm text-gray-500 dark:text-gray-400">Mapel: {item.subject} (+1 Poin)</p>;
                break;
            case 'violation':
                title = `${item.points} Poin Pelanggaran`;
                content = <p className="text-sm text-gray-700 dark:text-gray-300">{item.description}</p>;
                break;
            case 'attendance':
                title = `Absensi: ${item.status}`;
                content = <p className="text-sm text-gray-500 dark:text-gray-400">Siswa ditandai sebagai {item.status.toLowerCase()} pada hari ini.</p>;
                break;
        }

        return (
            <div className="relative mb-8 group">
                <div className={`absolute left-0 top-1.5 w-6 h-6 bg-white dark:bg-gray-950 rounded-full border-4 border-${color}-500 flex items-center justify-center`}>
                    <Icon className={`w-3 h-3 text-${color}-500`} />
                </div>
                <div className="ml-10 p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/50 dark:border-gray-700/50 transition-all duration-300 shadow-md">
                    <h4 className="font-bold text-gray-900 dark:text-gray-100">{title}</h4>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(item.date || item.created_at || item.quiz_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    <div className="mt-2">{content}</div>
                </div>
            </div>
        );
    };


    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="flex-shrink-0 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Kembali">
                        <ArrowLeftIcon className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-4">
                         <div className="relative">
                            <img
                                src={student.avatar_url}
                                alt={student.name}
                                className="w-16 h-16 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-md"
                            />
                             <input type="file" ref={avatarFileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg" className="hidden" disabled={updateAvatarMutation.isPending}/>
                             <button 
                                type="button" 
                                onClick={() => avatarFileInputRef.current?.click()} 
                                disabled={updateAvatarMutation.isPending || !isOnline} 
                                className="absolute -bottom-1 -right-1 p-1.5 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full shadow-md hover:scale-110 transition-transform" 
                                aria-label="Ubah foto profil"
                            >
                                {updateAvatarMutation.isPending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <CameraIcon className="w-4 h-4" />}
                            </button>
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{student.name}</h2>
                            <p className="text-lg text-gray-500 dark:text-gray-400">{studentClass?.name || 'Tanpa Kelas'}</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-start md:justify-end gap-2 w-full md:w-auto">
                    <Button size="sm" variant="outline" onClick={() => setModalState({type: 'editStudent'})} disabled={!isOnline}><PencilIcon className="h-4 w-4 mr-2" />Edit</Button>
                    <Button size="sm" variant="default" onClick={handlePrintReport}>
                        <FileTextIcon className="h-4 w-4 mr-2" />Cetak Rapor
                    </Button>
                </div>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard icon={CheckCircleIcon} label="Kehadiran" value={`${attendancePercentage}%`} color="from-green-500 to-emerald-400" />
                <StatCard icon={BarChartIcon} label="Rata-rata Nilai" value={averageScore} color="from-sky-500 to-blue-400" />
                <StatCard icon={FileTextIcon} label="Total Laporan" value={reports.length} color="from-amber-500 to-yellow-400" />
                <StatCard icon={XCircleIcon} label="Total Alpha" value={totalAlphaDays} color="from-red-500 to-rose-400" />
                <StatCard icon={ShieldAlertIcon} label="Poin Pelanggaran" value={totalViolationPoints} color="from-orange-500 to-red-400" />
            </div>

            <Tabs defaultValue="ringkasan">
                 <div className="flex justify-center mb-6"><TabsList className="bg-gray-100 dark:bg-gray-800/60 border-none rounded-full"><TabsTrigger value="ringkasan" className="gap-2 rounded-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"><SparklesIcon className="w-4 h-4"/>Ringkasan AI</TabsTrigger><TabsTrigger value="linimasa" className="gap-2 rounded-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"><ClockIcon className="w-4 h-4" />Linimasa</TabsTrigger><TabsTrigger value="perilaku" className="gap-2 rounded-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"><BrainCircuitIcon className="w-4 h-4"/>Analisis Perilaku</TabsTrigger><TabsTrigger value="akademik" className="gap-2 rounded-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"><BarChartIcon className="w-4 h-4"/>Akademik</TabsTrigger><TabsTrigger value="kehadiran-catatan" className="gap-2 rounded-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"><PencilIcon className="w-4 h-4"/>Kehadiran & Catatan</TabsTrigger><TabsTrigger value="pelanggaran" className="gap-2 rounded-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"><ShieldAlertIcon className="w-4 h-4"/>Pelanggaran</TabsTrigger></TabsList></div>
                
                <TabsContent value="ringkasan" className="mt-6 animate-fade-in">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><SparklesIcon className="w-6 h-6 text-purple-500" />Analisis & Rekomendasi AI</CardTitle>
                            <CardDescription>Ringkasan komprehensif yang dibuat secara otomatis berdasarkan semua data siswa yang tersedia.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {aiSummaryState.loading && (<AiSummarySkeleton />)}
                            {aiSummaryState.error && (<div className="text-center text-red-500 p-4 bg-red-50 dark:bg-red-900/30 rounded-lg">{aiSummaryState.error}</div>)}
                            {aiSummaryState.content && (
                                isEditingAiSummary && editableAiSummary ? (
                                    <form onSubmit={(e) => { e.preventDefault(); handleSaveAiSummary(); }} className="space-y-4 animate-fade-in">
                                        {summarySections.map(section => (
                                            <div key={section.key}>
                                                <label htmlFor={section.key} className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">{section.label}</label>
                                                <textarea
                                                    id={section.key}
                                                    value={editableAiSummary[section.key]}
                                                    onChange={(e) => handleSummaryInputChange(section.key, e.target.value)}
                                                    className="w-full p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md h-28 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                                    rows={4}
                                                />
                                            </div>
                                        ))}
                                        <div className="flex justify-end gap-2 pt-4">
                                            <Button type="button" variant="ghost" onClick={handleCancelEditAiSummary}>Batal</Button>
                                            <Button type="submit">Simpan Perubahan</Button>
                                        </div>
                                    </form>
                                ) : (
                                    <div>
                                        <AiSummaryDisplay summary={aiSummaryState.content} />
                                        <div className="flex gap-2 mt-6">
                                            <Button onClick={handleEditAiSummary} variant="outline" size="sm" disabled={!isOnline}><PencilIcon className="w-4 h-4 mr-2"/>Edit Ringkasan</Button>
                                            <Button onClick={() => generateAndGetAiSummary()} disabled={aiSummaryState.loading || !isOnline} variant="outline" size="sm">{aiSummaryState.loading ? 'Memuat...' : 'Buat Ulang Analisis'}</Button>
                                        </div>
                                    </div>
                                )
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="perilaku" className="mt-6 animate-fade-in">
                    <BehaviorAnalysisTab studentName={student.name} attendance={attendanceRecords} violations={violations} />
                </TabsContent>

                 <TabsContent value="linimasa" className="mt-6 animate-fade-in">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><ClockIcon className="w-6 h-6 text-indigo-500" />Linimasa Perjalanan Siswa</CardTitle>
                            <CardDescription>Ringkasan kronologis dari semua peristiwa penting terkait siswa.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {timelineItems.length > 0 ? (
                                <div className="relative pl-4">
                                    <div className="absolute left-0 top-2 h-full w-0.5 bg-gray-200 dark:bg-gray-700 ml-3" aria-hidden="true"></div>
                                    {timelineItems.map((item, index) => (
                                        <div key={`${item.type}-${item.item.id}-${index}`}>
                                            {renderTimelineItem(item)}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                 <div className="text-center py-16 text-gray-500">
                                    <ClockIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                                    <h4 className="text-lg font-semibold">Linimasa Kosong</h4>
                                    <p className="text-sm">Belum ada aktivitas yang tercatat untuk siswa ini.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="akademik" className="mt-6 space-y-6 animate-fade-in">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Nilai Mata Pelajaran</CardTitle>
                                <Button size="sm" onClick={() => setModalState({ type: 'academic', data: null })} disabled={!isOnline}>
                                    <PlusIcon className="w-4 h-4 mr-2" />Tambah Nilai
                                </Button>
                            </div>
                            <CardDescription>Performa siswa dalam mata pelajaran inti dan sumatif.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <GradesHistory 
                                records={academicRecords} 
                                onEdit={(r) => setModalState({ type: 'academic', data: r })} 
                                onDelete={handleDeleteAcademicRecord} 
                                isOnline={isOnline}
                            />
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUpIcon className="w-6 h-6 text-purple-500" />Analisis Perbandingan Nilai Mapel
                            </CardTitle>
                            <CardDescription>Visualisasi perbandingan nilai mata pelajaran siswa dengan rata-rata kelas.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <RadarChart 
                                studentRecords={academicRecords} 
                                classRecords={classAcademicRecords} 
                            />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Poin Keaktifan</CardTitle>
                                <Button size="sm" onClick={() => setModalState({ type: 'quiz', data: null })} disabled={!isOnline}>
                                    <PlusIcon className="w-4 h-4 mr-2" />Tambah Poin
                                </Button>
                            </div>
                            <CardDescription>Kumpulan poin dari keaktifan siswa di kelas (bertanya, maju ke depan, dll).</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ActivityPointsHistory 
                                records={quizPoints} 
                                onEdit={(r) => setModalState({ type: 'quiz', data: r })} 
                                onDelete={handleDeleteQuizPoint} 
                                isOnline={isOnline}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="kehadiran-catatan" className="mt-6 space-y-6 animate-fade-in">
                    <Card><CardHeader><CardTitle>Statistik Kehadiran</CardTitle><CardDescription>Berdasarkan total {totalAttendanceDays} catatan kehadiran yang tersimpan.</CardDescription></CardHeader><CardContent><StackedProgressBar summary={attendanceSummary} total={totalAttendanceDays} /></CardContent></Card>
                    <Card><CardHeader><div className="flex justify-between items-center"><CardTitle>Riwayat Catatan Perkembangan</CardTitle><Button size="sm" onClick={() => setModalState({ type: 'report', data: null })} disabled={!isOnline}><PlusIcon className="w-4 h-4 mr-2"/>Tambah Catatan</Button></div><CardDescription>Semua catatan kualitatif tentang perkembangan siswa.</CardDescription></CardHeader><CardContent><ReportTimeline reports={reports} onEdit={(r) => setModalState({ type: 'report', data: r })} onDelete={handleDeleteReport} isOnline={isOnline} /></CardContent></Card>
                </TabsContent>

                <TabsContent value="pelanggaran" className="mt-6 space-y-6 animate-fade-in">
                     <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center"><CardTitle>Riwayat Poin Pelanggaran</CardTitle><Button size="sm" onClick={() => { setModalState({ type: 'violation', mode: 'add', data: null }); setViolationEntryMode('list'); }} disabled={!isOnline}><PlusIcon className="w-4 h-4 mr-2" />Tambah Pelanggaran</Button></div>
                            <CardDescription>Semua catatan pelanggaran siswa. Total poin saat ini: <strong className="text-red-500">{totalViolationPoints}</strong>.</CardDescription>
                        </CardHeader>
                        <CardContent><ViolationHistory violations={violations} onEdit={(v) => setModalState({ type: 'violation', mode: 'edit', data: v })} onDelete={handleDeleteViolation} isOnline={isOnline} /></CardContent>
                    </Card>
                </TabsContent>

            </Tabs>
            
            {modalState.type === 'confirmDelete' && <ConfirmActionModal modalState={modalState} onClose={() => setModalState({ type: 'closed' })} />}

            {modalState.type === 'report' && <Modal title={modalState.data ? "Edit Catatan" : "Tambah Catatan Baru"} isOpen={true} onClose={() => setModalState({ type: 'closed' })}><form onSubmit={handleReportFormSubmit} className="space-y-4"><div><label htmlFor="report-title">Judul</label><Input id="report-title" name="title" defaultValue={modalState.data?.title || ''} required /></div><div><label htmlFor="report-notes">Catatan</label><textarea id="report-notes" name="notes" defaultValue={modalState.data?.notes || ''} rows={5} className="w-full p-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-md"></textarea></div><div><label htmlFor="report-attachment">Lampiran (Opsional)</label><Input id="report-attachment" name="attachment" type="file" onChange={(e) => setReportFile(e.target.files ? e.target.files[0] : null)} /></div><div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => setModalState({ type: 'closed' })}>Batal</Button><Button type="submit" disabled={createOrUpdateReportMutation.isPending || !isOnline}>{createOrUpdateReportMutation.isPending ? 'Menyimpan...' : 'Simpan'}</Button></div></form></Modal>}
            
            {modalState.type === 'academic' && <Modal title={modalState.data ? "Edit Nilai Mata Pelajaran" : "Tambah Nilai Mata Pelajaran"} isOpen={true} onClose={() => setModalState({ type: 'closed' })}>
                <form onSubmit={handleAcademicRecordFormSubmit} className="space-y-4">
                    <div><label>Mata Pelajaran</label><Input name="subject" placeholder="cth. Matematika" defaultValue={modalState.data?.subject || ''} required /></div>
                    <div><label>Nilai</label><Input name="score" type="number" min="0" max="100" defaultValue={modalState.data?.score ?? ''} required /></div>
                    <div><label>Catatan</label><textarea name="notes" defaultValue={modalState.data?.notes || ''} rows={3} className="w-full p-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-md"></textarea></div>
                    <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => setModalState({ type: 'closed' })}>Batal</Button><Button type="submit" disabled={createOrUpdateAcademicMutation.isPending || !isOnline}>{createOrUpdateAcademicMutation.isPending ? 'Menyimpan...' : 'Simpan'}</Button></div>
                </form>
            </Modal>}

            {modalState.type === 'quiz' && <Modal title={modalState.data ? "Edit Poin Keaktifan" : "Tambah Poin Keaktifan"} isOpen={true} onClose={() => setModalState({ type: 'closed' })}>
                <form onSubmit={handleQuizPointFormSubmit} className="space-y-4">
                    <div><label htmlFor="quiz-subject">Mata Pelajaran</label><Input id="quiz-subject" name="subject" placeholder="cth. Matematika" defaultValue={modalState.data?.subject || ''} required /></div>
                    <div><label htmlFor="quiz-name">Nama Aktivitas</label><Input id="quiz-name" name="quiz_name" placeholder="cth. Maju ke depan kelas" defaultValue={modalState.data?.quiz_name || ''} required /></div>
                    <div><label htmlFor="quiz-date">Tanggal</label><Input id="quiz-date" name="quiz_date" type="date" defaultValue={modalState.data?.quiz_date || getLocalDateString()} required /></div>
                    <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => setModalState({ type: 'closed' })}>Batal</Button><Button type="submit" disabled={createOrUpdateQuizPointMutation.isPending || !isOnline}>{createOrUpdateQuizPointMutation.isPending ? 'Menyimpan...' : 'Simpan'}</Button></div>
                </form>
            </Modal>}

            {modalState.type === 'violation' && <Modal title={modalState.mode === 'add' ? 'Tambah Pelanggaran Baru' : 'Edit Pelanggaran'} isOpen={true} onClose={() => { setModalState({ type: 'closed' }); setViolationSelection(null);}}>
                <form onSubmit={handleViolationFormSubmit} className="space-y-4">
                    {modalState.mode === 'add' && (
                        <div className="flex justify-center gap-2 mb-4 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <Button 
                                type="button" 
                                size="sm"
                                variant={violationEntryMode === 'list' ? 'default' : 'ghost'} 
                                onClick={() => setViolationEntryMode('list')}
                                className="flex-1"
                            >
                                Pilih dari Daftar
                            </Button>
                            <Button 
                                type="button" 
                                size="sm"
                                variant={violationEntryMode === 'custom' ? 'default' : 'ghost'} 
                                onClick={() => setViolationEntryMode('custom')}
                                className="flex-1"
                            >
                                Input Manual
                            </Button>
                        </div>
                    )}
                    
                    <div>
                        <label htmlFor="violation-date">Tanggal</label>
                        <Input id="violation-date" name="date" type="date" defaultValue={modalState.data?.date || getLocalDateString()} required />
                    </div>

                    {modalState.mode === 'edit' || violationEntryMode === 'custom' ? (
                        <>
                            <div>
                                <label htmlFor="violation-description">Deskripsi Pelanggaran</label>
                                <textarea id="violation-description" name="description" defaultValue={modalState.data?.description} rows={3} className="w-full p-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-md" required></textarea>
                            </div>
                            <div>
                                <label htmlFor="violation-points">Poin</label>
                                <Input id="violation-points" name="points" type="number" min="1" defaultValue={modalState.data?.points} required />
                            </div>
                        </>
                    ) : (
                         <>
                            <div>
                                <label htmlFor="violation-code">Jenis Pelanggaran</label>
                                <Select id="violation-code" name="violation_code" required 
                                    onChange={(e) => {
                                        const v = violationList.find(v => v.code === e.target.value);
                                        setViolationSelection(v || null);
                                    }}
                                    defaultValue="">
                                    <option value="" disabled>Pilih jenis pelanggaran</option>
                                    {['Ringan', 'Sedang', 'Berat'].map(category => (
                                        <optgroup key={category} label={`Pelanggaran ${category}`}>
                                            {violationList.filter(v => v.category === category).map(v => (
                                                <option key={v.code} value={v.code}>{`${v.code} - ${v.description}`}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </Select>
                            </div>
                            {violationSelection && (
                                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md text-gray-800 dark:text-gray-200">
                                    <p className="font-semibold">Poin: <span className="text-red-500 font-bold text-lg">{violationSelection.points}</span></p>
                                </div>
                            )}
                        </>
                    )}
                    <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => { setModalState({ type: 'closed' }); setViolationSelection(null);}}>Batal</Button><Button type="submit" disabled={createOrUpdateViolationMutation.isPending || !isOnline}>{createOrUpdateViolationMutation.isPending ? 'Menyimpan...' : 'Simpan'}</Button></div>
                </form>
            </Modal>}
            {modalState.type === 'editStudent' && <Modal title="Edit Profil Siswa" isOpen={true} onClose={() => setModalState({ type: 'closed' })}>
                <form onSubmit={handleUpdateStudent} className="space-y-6">
                    <div className="flex justify-center">
                        <div className="relative">
                            <img
                                src={student.avatar_url}
                                alt={student.name}
                                className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700"
                            />
                            <input type="file" ref={avatarFileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg" className="hidden" disabled={updateAvatarMutation.isPending}/>
                            <button 
                                type="button" 
                                onClick={() => avatarFileInputRef.current?.click()} 
                                disabled={updateAvatarMutation.isPending || !isOnline} 
                                className="absolute -bottom-1 -right-1 p-2 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full shadow-md hover:scale-110 transition-transform" 
                                aria-label="Ubah foto profil"
                            >
                                {updateAvatarMutation.isPending ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <CameraIcon className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                    <div><label htmlFor="edit-student-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Siswa</label><Input id="edit-student-name" name="name" defaultValue={student.name} required /></div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis Kelamin</label>
                        <div className="flex gap-4 mt-2">
                            <label className="flex items-center text-gray-700 dark:text-gray-300"><input type="radio" name="gender" value="Laki-laki" defaultChecked={student.gender === 'Laki-laki'} className="form-radio" /><span className="ml-2">Laki-laki</span></label>
                            <label className="flex items-center text-gray-700 dark:text-gray-300"><input type="radio" name="gender" value="Perempuan" defaultChecked={student.gender === 'Perempuan'} className="form-radio" /><span className="ml-2">Perempuan</span></label>
                        </div>
                    </div>
                    <div><label htmlFor="edit-student-class" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelas</label><select id="edit-student-class" name="class_id" defaultValue={student.class_id} className="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-transparent dark:border-gray-600 dark:bg-gray-800 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900">{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button type="button" variant="outline" onClick={handleDeleteStudent} disabled={!isOnline}>Hapus Siswa</Button>
                        <Button type="button" variant="ghost" onClick={() => setModalState({ type: 'closed' })}>Batal</Button>
                        <Button type="submit" disabled={updateStudentMutation.isPending || !isOnline}>{updateStudentMutation.isPending ? 'Menyimpan...' : 'Simpan'}</Button>
                    </div>
                </form>
            </Modal>}
        </div>
    );
};

export default StudentDetailPage;
