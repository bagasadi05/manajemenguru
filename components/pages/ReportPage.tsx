import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../ui/Button';
import { PrinterIcon, ArrowLeftIcon, BrainCircuitIcon, PlusIcon, TrashIcon } from '../Icons';
import LoadingSpinner from '../LoadingSpinner';
import { AttendanceStatus } from '../../types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as db from '@/services/databaseService';
import * as ai from '@/services/aiService';

type ReportData = db.ReportData;

const getPredicate = (score: number): { predikat: string; deskripsi: string; } => {
    if (score >= 86) return { predikat: 'A', deskripsi: 'Menunjukkan penguasaan materi yang sangat baik.' };
    if (score >= 76) return { predikat: 'B', deskripsi: 'Menunjukkan penguasaan materi yang baik.' };
    if (score >= 66) return { predikat: 'C', deskripsi: 'Menunjukkan penguasaan materi yang cukup.' };
    return { predikat: 'D', deskripsi: 'Memerlukan bimbingan lebih lanjut.' };
};

const EditableCell: React.FC<{ value: string | number, onChange: (value: string | number) => void, type?: 'text' | 'number', className?: string }> = ({ value, onChange, type = 'text', className }) => (
    <input type={type} value={value} onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        className={`w-full p-2 bg-transparent focus:bg-yellow-100 focus:outline-none focus:ring-1 focus:ring-yellow-500 rounded-sm font-serif text-sm ${className}`} />
);

const ReportPage: React.FC = () => {
    const { studentId } = useParams<{ studentId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const toast = useToast();

    const [isGeneratingNote, setIsGeneratingNote] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [reportHeader, setReportHeader] = useState({ title: "LAPORAN HASIL BELAJAR SISWA", schoolName: "MI AL IRSYAD AL ISLAMIYYAH KOTA MADIUN", academicYear: "Tahun Ajaran 2025/2026 - Semester Ganjil" });
    const [studentInfo, setStudentInfo] = useState({ name: '', nisn: '', className: '', phase: 'E' });
    const [editableAcademicRecords, setEditableAcademicRecords] = useState<any[]>([]);
    const [editableQuizPoints, setEditableQuizPoints] = useState<any[]>([]);
    const [editableViolations, setEditableViolations] = useState<any[]>([]);
    const [editableAttendanceSummary, setEditableAttendanceSummary] = useState({ Sakit: 0, Izin: 0, Alpha: 0 });
    const [behavioralNote, setBehavioralNote] = useState('Tidak ada catatan pelanggaran.');
    const [teacherNote, setTeacherNote] = useState('');

    const { data, isLoading, isError, error } = useQuery<ReportData>({
        queryKey: ['reportData', studentId],
        queryFn: () => db.getStudentReportPageData(studentId!, user!.id),
        enabled: !!studentId && !!user,
    });
    
    useEffect(() => {
        if (data) {
            setStudentInfo({ name: data.student.name, nisn: data.student.id.substring(0, 8), className: data.student.classes?.name || 'N/A', phase: 'E' });
            setEditableAcademicRecords(data.academicRecords.map(r => ({ ...r, ...getPredicate(r.score) })));
            setEditableQuizPoints(data.quizPoints.sort((a,b) => new Date(a.quiz_date).getTime() - new Date(b.quiz_date).getTime()));
            setEditableViolations(data.violations.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            const attendanceSum = data.attendanceRecords.reduce((acc, record) => {
                if (record.status !== 'Hadir') { acc[record.status as Exclude<AttendanceStatus, 'Hadir'>] = (acc[record.status as Exclude<AttendanceStatus, 'Hadir'>] || 0) + 1; }
                return acc;
            }, { Sakit: 0, Izin: 0, Alpha: 0 });
            setEditableAttendanceSummary(attendanceSum);
            setBehavioralNote(data.violations.length > 0 ? `Terdapat ${data.violations.length} catatan pelanggaran.` : "Tidak ada catatan pelanggaran. Siswa menunjukkan sikap yang baik dan terpuji selama proses pembelajaran.");
            if (teacherNote === '') handleGenerateAiNote(false);
        }
    }, [data]);
    
    const handleListChange = (setter: React.Dispatch<React.SetStateAction<any[]>>, index: number, field: string, value: any) => {
        setter(prev => {
            const newList = [...prev];
            newList[index] = { ...newList[index], [field]: value };
            if (field === 'score') newList[index] = { ...newList[index], ...getPredicate(Number(value)) };
            return newList;
        });
    };
    
    const handleAddRow = (setter: React.Dispatch<React.SetStateAction<any[]>>, newRow: any) => setter(prev => [...prev, newRow]);
    const handleRemoveRow = (setter: React.Dispatch<React.SetStateAction<any[]>>, index: number) => setter(prev => prev.filter((_, i) => i !== index));

    const handleGenerateAiNote = async (showToast = true) => {
        if (!data) return;
        setIsGeneratingNote(true);
        if (showToast) toast.info("AI sedang merangkum catatan guru...");
        try {
            const academicSummary = data.academicRecords.length > 0 ? `Secara akademis, nilai rata-ratanya adalah ${Math.round(data.academicRecords.reduce((sum, r) => sum + r.score, 0) / data.academicRecords.length)}. Mata pelajaran terkuatnya adalah ${[...data.academicRecords].sort((a, b) => b.score - a.score)[0]?.subject}.` : 'Belum ada data nilai akademik yang signifikan.';
            const behaviorSummary = data.violations.length > 0 ? `Dari segi perilaku, terdapat ${data.violations.length} catatan pelanggaran.` : 'Siswa menunjukkan perilaku yang sangat baik tanpa catatan pelanggaran.';
            const attendanceStr = `Sakit ${editableAttendanceSummary.Sakit} hari, Izin ${editableAttendanceSummary.Izin} hari, Alpha ${editableAttendanceSummary.Alpha} hari`;
            const result = await ai.generateTeacherNote(data.student.name, academicSummary, behaviorSummary, attendanceStr);
            setTeacherNote(result);
            if (showToast) toast.success("Catatan guru berhasil dibuat oleh AI!");
        } catch (err) {
            toast.error("Gagal membuat catatan guru.");
            console.error(err);
        } finally {
            setIsGeneratingNote(false);
        }
    };
    
    const generatePdf = () => { /* ... PDF generation logic ... */ };

    if (isLoading) return <LoadingSpinner fullScreen containerClassName="bg-gray-100" />;
    if (isError) return <div className="flex items-center justify-center h-screen bg-gray-100">Error: {(error as Error).message}</div>;

    return (
        <div className="bg-gray-200 dark:bg-gray-800 min-h-screen p-4 sm:p-8 font-sans">
            {/* ... JSX ... */}
        </div>
    );
};

export default ReportPage;