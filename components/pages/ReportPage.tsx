import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../ui/Button';
import { PrinterIcon, ArrowLeftIcon, BrainCircuitIcon, PlusIcon, TrashIcon, SparklesIcon } from '../Icons';
import LoadingSpinner from '../LoadingSpinner';
import { AttendanceStatus } from '../../types';
import { Database } from '../../services/database.types';
import { GoogleGenAI, Type } from '@google/genai';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'jspdf-autotable';


type StudentRow = Database['public']['Tables']['students']['Row'];
type ClassRow = Database['public']['Tables']['classes']['Row'];
type ReportRow = Database['public']['Tables']['reports']['Row'];
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type AcademicRecordRow = Database['public']['Tables']['academic_records']['Row'];
type ViolationRow = Database['public']['Tables']['violations']['Row'];
type QuizPointRow = Database['public']['Tables']['quiz_points']['Row'];

type StudentWithClass = StudentRow & { classes: Pick<ClassRow, 'id' | 'name'> | null };

type ReportData = {
    student: StudentWithClass,
    reports: ReportRow[],
    attendanceRecords: AttendanceRow[],
    academicRecords: AcademicRecordRow[],
    violations: ViolationRow[],
    quizPoints: QuizPointRow[],
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fetchReportData = async (studentId: string | undefined, userId: string): Promise<ReportData> => {
    if (!studentId) throw new Error("Student ID is required.");
    
    const studentRes = await supabase.from('students').select('*, classes(id, name)').eq('id', studentId).eq('user_id', userId).single();
    if (studentRes.error) throw new Error(studentRes.error.message);
    
    const [reportsRes, attendanceRes, academicRes, violationsRes, quizPointsRes] = await Promise.all([
        supabase.from('reports').select('*').eq('student_id', studentId),
        supabase.from('attendance').select('*').eq('student_id', studentId),
        supabase.from('academic_records').select('*').eq('student_id', studentId),
        supabase.from('violations').select('*').eq('student_id', studentId),
        supabase.from('quiz_points').select('*').eq('student_id', studentId)
    ]);

    if (reportsRes.error || attendanceRes.error || academicRes.error || violationsRes.error || quizPointsRes.error) {
        throw new Error('Failed to fetch one or more report data components.');
    }

    return {
        student: studentRes.data as StudentWithClass,
        reports: reportsRes.data || [],
        attendanceRecords: attendanceRes.data || [],
        academicRecords: academicRes.data || [],
        violations: violationsRes.data || [],
        quizPoints: quizPointsRes.data || [],
    };
};

const getPredicate = (score: number): { predikat: string; deskripsi: string; } => {
    if (score >= 86) return { predikat: 'A', deskripsi: 'Menunjukkan penguasaan materi yang sangat baik.' };
    if (score >= 76) return { predikat: 'B', deskripsi: 'Menunjukkan penguasaan materi yang baik.' };
    if (score >= 66) return { predikat: 'C', deskripsi: 'Menunjukkan penguasaan materi yang cukup.' };
    return { predikat: 'D', deskripsi: 'Memerlukan bimbingan lebih lanjut.' };
};

const EditableCell: React.FC<{ value: string | number, onChange: (value: string | number) => void, type?: 'text' | 'number', className?: string }> = ({ value, onChange, type = 'text', className }) => {
    return (
        <input 
            type={type} 
            value={value}
            onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
            className={`w-full p-2 bg-transparent focus:bg-yellow-100 focus:outline-none focus:ring-1 focus:ring-yellow-500 rounded-sm font-serif text-sm ${className}`}
        />
    );
};

const ReportPage: React.FC = () => {
    const { studentId } = useParams<{ studentId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const toast = useToast();

    const [isGeneratingNote, setIsGeneratingNote] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    const [reportHeader, setReportHeader] = useState({
        title: "LAPORAN HASIL BELAJAR SISWA",
        schoolName: "MI AL IRSYAD AL ISLAMIYYAH KOTA MADIUN",
        academicYear: "Tahun Ajaran 2025/2026 - Semester Ganjil"
    });
    const [studentInfo, setStudentInfo] = useState({ name: '', nisn: '', className: '', phase: 'E' });
    const [editableAcademicRecords, setEditableAcademicRecords] = useState<any[]>([]);
    const [editableQuizPoints, setEditableQuizPoints] = useState<any[]>([]);
    const [editableViolations, setEditableViolations] = useState<any[]>([]);
    const [editableAttendanceSummary, setEditableAttendanceSummary] = useState({ Sakit: 0, Izin: 0, Alpha: 0 });
    const [behavioralNote, setBehavioralNote] = useState('Tidak ada catatan pelanggaran.');
    const [teacherNote, setTeacherNote] = useState('');

    const { data, isLoading, isError, error } = useQuery<ReportData>({
        queryKey: ['reportData', studentId],
        queryFn: () => fetchReportData(studentId, user!.id),
        enabled: !!studentId && !!user,
    });
    
    useEffect(() => {
        if (data) {
            setStudentInfo({
                name: data.student.name,
                nisn: data.student.id.substring(0, 8),
                className: data.student.classes?.name || 'N/A',
                phase: 'E'
            });

            const processedAcademicRecords = data.academicRecords.map(r => ({
                ...r,
                ...getPredicate(r.score)
            }));
            setEditableAcademicRecords(processedAcademicRecords);
            
            setEditableQuizPoints(data.quizPoints.sort((a,b) => new Date(a.quiz_date).getTime() - new Date(b.quiz_date).getTime()));

            setEditableViolations(data.violations.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            
            const attendanceSum = data.attendanceRecords.reduce((acc, record) => {
                if (record.status !== 'Hadir') {
                    acc[record.status] = (acc[record.status] || 0) + 1;
                }
                return acc;
            }, { Sakit: 0, Izin: 0, Alpha: 0 } as Record<Exclude<AttendanceStatus, 'Hadir'>, number>);
            setEditableAttendanceSummary(attendanceSum);
            
            if (data.violations.length > 0) {
                setBehavioralNote(`Terdapat ${data.violations.length} catatan pelanggaran.`);
            } else {
                setBehavioralNote("Tidak ada catatan pelanggaran. Siswa menunjukkan sikap yang baik dan terpuji selama proses pembelajaran.");
            }
            
            if (teacherNote === '') {
                handleGenerateAiNote(false); // Auto-generate note on first load without toast
            }
        }
    }, [data]);
    
    const handleListChange = (setter: React.Dispatch<React.SetStateAction<any[]>>, index: number, field: string, value: any) => {
        setter(prev => {
            const newList = [...prev];
            newList[index] = { ...newList[index], [field]: value };
            if (field === 'score') {
                const predicateInfo = getPredicate(Number(value));
                newList[index] = { ...newList[index], ...predicateInfo };
            }
            return newList;
        });
    };
    
    const handleAddAcademicRecordRow = () => {
        setEditableAcademicRecords(prev => [...prev, {
            id: `new-${Date.now()}`,
            subject: '',
            score: 0,
            predikat: 'D',
            deskripsi: 'Memerlukan bimbingan lebih lanjut.',
        }]);
    };

    const handleRemoveAcademicRecordRow = (index: number) => {
        setEditableAcademicRecords(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddQuizPointRow = () => {
        setEditableQuizPoints(prev => [...prev, {
            id: `new-${Date.now()}`,
            quiz_date: new Date().toISOString().slice(0, 10),
            subject: '',
            quiz_name: '',
        }]);
    };

    const handleRemoveQuizPointRow = (index: number) => {
        setEditableQuizPoints(prev => prev.filter((_, i) => i !== index));
    };


    const handleGenerateAiNote = async (showToast = true) => {
        if (!data) return;
        setIsGeneratingNote(true);
        if (showToast) {
            toast.info("AI sedang merangkum catatan guru...");
        }
        try {
            const systemInstruction = `Anda adalah seorang guru wali kelas yang bijaksana, suportif, dan profesional. Tugas Anda adalah menulis paragraf "Catatan Wali Kelas" untuk rapor siswa. Catatan ini harus komprehensif, merangkum performa siswa secara holistik, dan memberikan motivasi. Tulis dalam satu paragraf yang mengalir (3-5 kalimat). Hindari penggunaan daftar atau poin.`;
            
            const academicSummary = data.academicRecords.length > 0
                ? `Secara akademis, nilai rata-ratanya adalah ${Math.round(data.academicRecords.reduce((sum, r) => sum + r.score, 0) / data.academicRecords.length)}. Mata pelajaran terkuatnya adalah ${[...data.academicRecords].sort((a, b) => b.score - a.score)[0]?.subject}.`
                : 'Belum ada data nilai akademik yang signifikan.';

            const behaviorSummary = data.violations.length > 0
                ? `Dari segi perilaku, terdapat ${data.violations.length} catatan pelanggaran dengan total ${data.violations.reduce((sum, v) => sum + v.points, 0)} poin.`
                : 'Siswa menunjukkan perilaku yang sangat baik tanpa catatan pelanggaran.';

            const prompt = `Buatkan draf "Catatan Wali Kelas" untuk siswa bernama ${data.student.name}.
            
            Berikut adalah data ringkas sebagai dasar analisis Anda:
            - **Analisis Akademik:** ${academicSummary}
            - **Analisis Perilaku:** ${behaviorSummary}
            - **Kehadiran:** Sakit ${editableAttendanceSummary.Sakit} hari, Izin ${editableAttendanceSummary.Izin} hari, Alpha ${editableAttendanceSummary.Alpha} hari.
            
            Tugas Anda:
            Sintesis semua informasi di atas menjadi satu paragraf catatan wali kelas yang kohesif. Pastikan catatan tersebut mencakup evaluasi umum, menyoroti kekuatan atau area yang perlu ditingkatkan, dan diakhiri dengan kalimat rekomendasi atau motivasi yang positif.
            `;

            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction }});
            setTeacherNote((response.text ?? '').replace(/\\n/g, ' '));
            if (showToast) {
                toast.success("Catatan guru berhasil dibuat oleh AI!");
            }
        } catch (err) {
            toast.error("Gagal membuat catatan guru.");
            console.error(err);
        } finally {
            setIsGeneratingNote(false);
        }
    };
    
    const generatePdf = () => {
        if (!data) { toast.error("Data laporan belum siap."); return; }
        setIsExporting(true); toast.info("Membuat file PDF...");

        try {
            const doc = new jsPDF('p', 'pt', 'a4');
            const pageW = doc.internal.pageSize.getWidth();
            const margin = 40;
            let y = 60;

            doc.setFont('Tinos', 'bold');
            doc.setFontSize(16); doc.text(reportHeader.title, pageW / 2, y, { align: 'center' }); y += 18;
            doc.setFontSize(14); doc.text(reportHeader.schoolName, pageW / 2, y, { align: 'center' }); y += 16;
            
            doc.setFont('Tinos', 'normal');
            doc.setFontSize(11); doc.text(reportHeader.academicYear, pageW / 2, y, { align: 'center' }); y += 10;
            doc.setLineWidth(2); doc.line(margin, y, pageW - margin, y); y += 25;

            doc.setFontSize(10);
            autoTable(doc, {
                body: [
                    [{content: 'Nama Siswa', styles: {fontStyle: 'bold'}}, `: ${studentInfo.name}`, {content: 'Kelas', styles: {fontStyle: 'bold'}}, `: ${studentInfo.className}`],
                    [{content: 'No. Induk / NISN', styles: {fontStyle: 'bold'}}, `: ${studentInfo.nisn}`, {content: 'Fase', styles: {fontStyle: 'bold'}}, `: ${studentInfo.phase}`],
                ],
                startY: y, theme: 'plain', styles: { fontSize: 10, font: 'Tinos', cellPadding: 1 },
                columnStyles: { 0: {cellWidth: 100}, 2: {cellWidth: 100} }
            });
            y = (doc as any).lastAutoTable.finalY + 20;

            doc.setFont('Tinos', 'bold'); doc.setFontSize(12); doc.text('A. Nilai Akademik (Sumatif)', margin, y); y += 5;
            autoTable(doc, {
                head: [['No', 'Mata Pelajaran', 'Nilai', 'Predikat', 'Deskripsi']],
                body: editableAcademicRecords.map((r, i) => [i + 1, r.subject, r.score, r.predikat, r.deskripsi]),
                startY: y, theme: 'grid',
                headStyles: { fillColor: [229, 231, 235], textColor: 20, fontStyle: 'bold', font: 'Tinos' },
                styles: { fontSize: 9, font: 'Tinos', cellPadding: 5, lineColor: [0,0,0], lineWidth: 0.5 },
                columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 2: { halign: 'center', cellWidth: 40 }, 3: { halign: 'center', cellWidth: 50 }, 4: { halign: 'justify' } }
            });
            y = (doc as any).lastAutoTable.finalY + 20;

            doc.setFont('Tinos', 'bold'); doc.setFontSize(12); doc.text('B. Poin Keaktifan & Ekstrakurikuler', margin, y); y += 5;
            if (editableQuizPoints.length > 0) {
                autoTable(doc, {
                    head: [['No', 'Tanggal', 'Mata Pelajaran', 'Aktivitas / Kegiatan']],
                    body: editableQuizPoints.map((r, i) => [i + 1, r.quiz_date, r.subject, r.quiz_name]),
                    startY: y, theme: 'grid',
                    headStyles: { fillColor: [229, 231, 235], textColor: 20, fontStyle: 'bold', font: 'Tinos' },
                    styles: { fontSize: 9, font: 'Tinos', cellPadding: 5, lineColor: [0,0,0], lineWidth: 0.5 },
                    columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 1: { halign: 'center', cellWidth: 70 }, 2: { cellWidth: 100 } }
                });
                y = (doc as any).lastAutoTable.finalY + 20;
            } else {
                doc.setFont('Tinos', 'normal');
                doc.setFontSize(10);
                doc.text('Tidak ada poin keaktifan yang dicatat.', margin, y + 10);
                y += 25;
            }

            doc.setFont('Tinos', 'bold'); doc.setFontSize(12); doc.text('C. Kepribadian dan Sikap', margin, y); y += 15;
            doc.setFontSize(11); doc.text('1. Ketidakhadiran', margin, y); y += 15;
            
            autoTable(doc, {
                body: [[
                    { content: `Sakit: ${editableAttendanceSummary.Sakit} hari`, styles: { halign: 'center' } },
                    { content: `Izin: ${editableAttendanceSummary.Izin} hari`, styles: { halign: 'center' } },
                    { content: `Alpha: ${editableAttendanceSummary.Alpha} hari`, styles: { halign: 'center' } }
                ]],
                startY: y,
                theme: 'grid',
                styles: { font: 'Tinos', fontSize: 10, cellPadding: 5 }
            });
            y = (doc as any).lastAutoTable.finalY + 15;

            doc.setFont('Tinos', 'bold'); doc.setFontSize(11); doc.text('2. Catatan Perilaku', margin, y); y += 12;
            doc.setFont('Tinos', 'normal'); doc.setFontSize(10);
            const behaviorLines = doc.splitTextToSize(behavioralNote, pageW - margin * 2 - 30);
            doc.text(behaviorLines, margin + 15, y, { align: 'justify' });
            y += (behaviorLines.length * 12) + (editableViolations.length > 0 ? 15 : 25);

            if (editableViolations.length > 0) {
                doc.setFont('Tinos', 'bold'); doc.setFontSize(10); doc.text('Rincian Pelanggaran', margin + 15, y); y += 5;
                autoTable(doc, {
                    head: [['No', 'Tanggal', 'Deskripsi', 'Poin']],
                    body: editableViolations.map((v, i) => [i + 1, v.date, v.description, v.points]),
                    startY: y, theme: 'grid',
                    headStyles: { fillColor: [229, 231, 235], textColor: 20, fontStyle: 'bold', font: 'Tinos' },
                    styles: { fontSize: 9, font: 'Tinos', cellPadding: 5, lineColor: [0,0,0], lineWidth: 0.5 },
                    columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 3: { halign: 'center', cellWidth: 40 } }
                });
                y = (doc as any).lastAutoTable.finalY + 20;
            }

            doc.setFont('Tinos', 'bold'); doc.setFontSize(12); doc.text('D. Catatan Wali Kelas', margin, y); y += 12;
            doc.setFont('Tinos', 'normal');
            const teacherNoteLines = doc.splitTextToSize(teacherNote, pageW - margin * 2 - 20);
            doc.setDrawColor(0); doc.setLineWidth(0.5); doc.rect(margin, y - 5, pageW - margin * 2, teacherNoteLines.length * 12 + 20, 'S');
            doc.text(teacherNoteLines, margin + 10, y + 10, { align: 'justify', maxWidth: pageW - margin * 2 - 20 });
            y += teacherNoteLines.length * 12 + 30;

            doc.save(`Rapor_${studentInfo.name.replace(/\s/g, '_')}.pdf`);
            toast.success("PDF berhasil diunduh!");
        } catch (e) {
            console.error(e);
            toast.error("Gagal membuat PDF.");
        } finally {
            setIsExporting(false);
        }
    };


    if (isLoading) {
        return <LoadingSpinner fullScreen containerClassName="bg-gray-100" />;
    }
    if (isError) { return <div className="flex items-center justify-center h-screen bg-gray-100">Error: {(error as Error).message}</div>; }

    return (
        <div className="bg-gray-200 dark:bg-gray-800 min-h-screen p-4 sm:p-8 font-sans">
            <div className="print:hidden max-w-4xl mx-auto mb-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
                <Button variant="outline" onClick={() => navigate(-1)} className="w-full sm:w-auto"><ArrowLeftIcon className="w-4 h-4 mr-2" />Kembali</Button>
                <Button onClick={generatePdf} disabled={isExporting} className="w-full sm:w-auto">{isExporting ? 'Membuat PDF...' : <><PrinterIcon className="w-4 h-4 mr-2" /> Cetak / Simpan PDF</>}</Button>
            </div>

            <div id="report-card" className="bg-white text-black shadow-2xl max-w-4xl mx-auto font-serif p-10 sm:p-12 md:p-16">
                <header className="text-center mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-wider">{reportHeader.title}</h1>
                    <h2 className="text-xl sm:text-2xl font-semibold">{reportHeader.schoolName}</h2>
                    <p className="text-sm mt-1">{reportHeader.academicYear}</p>
                    <div className="mt-4 border-b-4 border-black"></div>
                </header>
                
                <section className="text-sm mb-8">
                    <table className="w-full">
                        <tbody>
                            <tr>
                                <td className="font-bold py-1 pr-2">Nama Siswa</td>
                                <td className="py-1 pr-8">: {studentInfo.name}</td>
                                <td className="font-bold py-1 pr-2">Kelas</td>
                                <td className="py-1">: {studentInfo.className}</td>
                            </tr>
                            <tr>
                                <td className="font-bold py-1 pr-2">No. Induk / NISN</td>
                                <td className="py-1 pr-8">: {studentInfo.nisn}</td>
                                <td className="font-bold py-1 pr-2">Fase</td>
                                <td className="py-1">: {studentInfo.phase}</td>
                            </tr>
                        </tbody>
                    </table>
                </section>
                
                <section className="mt-6">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-base">A. Nilai Akademik (Sumatif)</h3>
                        <Button size="sm" variant="outline" onClick={handleAddAcademicRecordRow} className="print:hidden">
                            <PlusIcon className="w-4 h-4 mr-2" />
                            Tambah Baris
                        </Button>
                    </div>
                    <table className="w-full text-sm border-collapse border border-black">
                        <thead className="bg-gray-100 font-bold text-center">
                            <tr className="border border-black">
                                <td className="border border-black p-2 w-[5%]">No</td>
                                <td className="border border-black p-2">Mata Pelajaran</td>
                                <td className="border border-black p-2 w-[10%]">Nilai</td>
                                <td className="border border-black p-2 w-[10%]">Predikat</td>
                                <td className="border border-black p-2">Deskripsi</td>
                                <td className="border border-black p-2 w-[10%] print:hidden">Aksi</td>
                            </tr>
                        </thead>
                        <tbody>
                            {editableAcademicRecords.map((record, index) => (
                                <tr key={record.id || index} className="border border-black">
                                    <td className="border border-black p-2 text-center">{index + 1}</td>
                                    <td className="border border-black p-0">
                                        <EditableCell value={record.subject} onChange={(val) => handleListChange(setEditableAcademicRecords, index, 'subject', val)} />
                                    </td>
                                    <td className="border border-black p-0">
                                        <EditableCell value={record.score} type="number" onChange={(val) => handleListChange(setEditableAcademicRecords, index, 'score', val)} className="text-center" />
                                    </td>
                                    <td className="border border-black p-2 text-center">{record.predikat}</td>
                                    <td className="border border-black p-0">
                                        <EditableCell value={record.deskripsi} onChange={(val) => handleListChange(setEditableAcademicRecords, index, 'deskripsi', val)} className="text-justify" />
                                    </td>
                                    <td className="border border-black p-1 text-center print:hidden">
                                        <Button size="icon" variant="ghost" onClick={() => handleRemoveAcademicRecordRow(index)} className="w-8 h-8 text-red-500">
                                            <TrashIcon className="w-4 h-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                <section className="mt-6">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-base">B. Poin Keaktifan & Ekstrakurikuler</h3>
                        <Button size="sm" variant="outline" onClick={handleAddQuizPointRow} className="print:hidden">
                            <PlusIcon className="w-4 h-4 mr-2" />
                            Tambah Baris
                        </Button>
                    </div>
                    <table className="w-full text-sm border-collapse border border-black">
                        <thead className="bg-gray-100 font-bold text-center">
                            <tr className="border border-black">
                                <td className="border border-black p-2 w-[5%]">No</td>
                                <td className="border border-black p-2 w-[20%]">Tanggal</td>
                                <td className="border border-black p-2 w-[25%]">Mata Pelajaran</td>
                                <td className="border border-black p-2">Aktivitas / Kegiatan</td>
                                <td className="border border-black p-2 w-[10%] print:hidden">Aksi</td>
                            </tr>
                        </thead>
                        <tbody>
                            {editableQuizPoints.length > 0 ? (
                                editableQuizPoints.map((record, index) => (
                                    <tr key={record.id} className="border border-black">
                                        <td className="border border-black p-2 text-center">{index + 1}</td>
                                        <td className="border border-black p-0">
                                            <EditableCell 
                                                value={record.quiz_date} 
                                                type="text"
                                                onChange={(val) => handleListChange(setEditableQuizPoints, index, 'quiz_date', val)} 
                                            />
                                        </td>
                                        <td className="border border-black p-0">
                                            <EditableCell 
                                                value={record.subject} 
                                                onChange={(val) => handleListChange(setEditableQuizPoints, index, 'subject', val)} 
                                            />
                                        </td>
                                        <td className="border border-black p-0">
                                            <EditableCell 
                                                value={record.quiz_name} 
                                                onChange={(val) => handleListChange(setEditableQuizPoints, index, 'quiz_name', val)} 
                                            />
                                        </td>
                                        <td className="border border-black p-1 text-center print:hidden">
                                            <Button size="icon" variant="ghost" onClick={() => handleRemoveQuizPointRow(index)} className="w-8 h-8 text-red-500">
                                                <TrashIcon className="w-4 h-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr className="border border-black">
                                    <td colSpan={5} className="p-4 text-center text-gray-500">
                                        Belum ada poin keaktifan yang dicatat.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </section>
                
                <section className="mt-6">
                    <h3 className="font-bold text-base mb-3">C. Kepribadian dan Sikap</h3>
                    <h4 className="font-semibold text-sm mb-2">1. Ketidakhadiran</h4>
                     <div className="grid grid-cols-3 gap-4 text-sm pl-4">
                        {Object.entries(editableAttendanceSummary).map(([status, count]) => (
                            <div key={status} className="border border-black p-2 text-center">
                                <p className="font-bold">{status}</p>
                                <p>{count} hari</p>
                            </div>
                        ))}
                    </div>

                    <h4 className="font-semibold text-sm mb-2 mt-4">2. Catatan Perilaku</h4>
                    <p className="text-sm pl-4 text-justify">{behavioralNote}</p>
                    {editableViolations.length > 0 && (
                        <div className="pl-4 mt-2">
                            <h5 className="font-semibold text-sm mb-1 italic">Rincian Pelanggaran</h5>
                            <table className="w-full text-sm border-collapse border border-black">
                                <thead className="bg-gray-100 font-bold text-center"><tr className="border border-black"><td className="border border-black p-2 w-[5%]">No</td><td className="border border-black p-2 w-[20%]">Tanggal</td><td className="border border-black p-2">Deskripsi</td><td className="border border-black p-2 w-[10%]">Poin</td></tr></thead>
                                <tbody>{editableViolations.map((v, i) => (<tr key={i} className="border border-black"><td className="border border-black p-2 text-center">{i + 1}</td><td className="border border-black p-2 text-center">{v.date}</td><td className="border border-black p-2">{v.description}</td><td className="border border-black p-2 text-center">{v.points}</td></tr>))}</tbody>
                            </table>
                        </div>
                    )}
                </section>
                
                <section className="mt-6">
                    <div className="flex justify-between items-center mb-2 print:hidden"><h3 className="font-bold text-base">D. Catatan Wali Kelas</h3><Button size="sm" variant="outline" onClick={() => handleGenerateAiNote()} disabled={isGeneratingNote}>{isGeneratingNote ? 'Membuat...' : <><BrainCircuitIcon className="w-4 h-4 mr-2" /> Buat dengan AI</>}</Button></div>
                    <h3 className="font-bold text-base mb-2 hidden print:block">D. Catatan Wali Kelas</h3>
                    <div className="border border-black p-3 text-sm min-h-[80px]">
                        <textarea value={teacherNote} onChange={(e) => setTeacherNote(e.target.value)} className="w-full h-full bg-transparent focus:bg-yellow-100 p-1 rounded-sm font-serif text-justify"/>
                    </div>
                </section>

            </div>
        </div>
    );
};

export default ReportPage;