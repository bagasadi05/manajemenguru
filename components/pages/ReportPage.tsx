import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button } from '../ui/Button';
import { PrinterIcon, ArrowLeftIcon, BrainCircuitIcon, PlusIcon, TrashIcon } from '../Icons';
import { AttendanceStatus } from '../../types';
import { Database } from '../../services/database.types';
import { GoogleGenAI, Type } from '@google/genai';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

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
            className={`w-full p-2 bg-transparent focus:bg-yellow-100 focus:outline-none focus:ring-1 focus:ring-yellow-500 rounded-sm ${className}`}
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
    const [editableExtracurriculars, setEditableExtracurriculars] = useState<any[]>([]);
    const [editableViolations, setEditableViolations] = useState<any[]>([]);
    const [editableAttendanceSummary, setEditableAttendanceSummary] = useState({ Sakit: 0, Izin: 0, Alpha: 0 });
    const [behavioralNote, setBehavioralNote] = useState('Tidak ada catatan pelanggaran. Siswa menunjukkan sikap yang baik.');
    const [teacherNote, setTeacherNote] = useState('');

    const { data, isLoading, isError, error } = useQuery({
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
            
            setEditableQuizPoints(data.quizPoints.sort((a,b) => new Date(b.quiz_date).getTime() - new Date(a.quiz_date).getTime()));
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
                setBehavioralNote("Tidak ada catatan pelanggaran. Siswa menunjukkan sikap yang baik.");
            }
            
            if (data.reports.length > 0) {
                const latestNote = [...data.reports].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].notes;
                setTeacherNote(latestNote);
            } else {
                setTeacherNote('Siswa menunjukkan perkembangan yang baik secara keseluruhan. Disarankan untuk terus mempertahankan semangat belajar dan keaktifan di kelas.');
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
    
    const handleAddRow = (setter: React.Dispatch<React.SetStateAction<any[]>>, newRow: object) => {
        setter(prev => [...prev, newRow]);
    };

    const handleDeleteRow = (setter: React.Dispatch<React.SetStateAction<any[]>>, index: number) => {
        setter(prev => prev.filter((_, i) => i !== index));
    };

    const handleGenerateAiNote = async () => {
        if (!data) return;
        setIsGeneratingNote(true);
        toast.info("AI sedang merangkum catatan guru...");

        try {
            const { student, violations, attendanceRecords, academicRecords, quizPoints } = data;
            
            const totalAttendanceDays = attendanceRecords.length;
            const presentDays = attendanceRecords.filter(r => r.status === 'Hadir').length;
            const attendancePercentage = totalAttendanceDays > 0 ? ((presentDays / totalAttendanceDays) * 100).toFixed(0) : '100';
            const totalViolationPoints = violations.reduce((sum, v) => sum + v.points, 0);

            const averageScore = academicRecords.length > 0 ? Math.round(academicRecords.reduce((sum, r) => sum + r.score, 0) / academicRecords.length) : 'N/A';
            const highestSummative = academicRecords.length > 0 ? { score: Math.max(...academicRecords.map(r => r.score)), subject: academicRecords.find(r => r.score === Math.max(...academicRecords.map(r => r.score)))?.subject } : null;
            const lowestSummative = academicRecords.length > 0 ? { score: Math.min(...academicRecords.map(r => r.score)), subject: academicRecords.find(r => r.score === Math.min(...academicRecords.map(r => r.score)))?.subject } : null;
            
            const averageQuizScore = quizPoints.length > 0 ? Math.round(quizPoints.reduce((sum, q) => sum + (q.points / q.max_points), 0) / quizPoints.length * 100) : 'N/A';
            
            const dataSummary = `
            - Nama Siswa: ${student.name}
            - Kehadiran: ${attendancePercentage}% hadir. Rincian: ${editableAttendanceSummary.Alpha} alpha, ${editableAttendanceSummary.Izin} izin, ${editableAttendanceSummary.Sakit} sakit.
            - Akademik Sumatif: Rata-rata nilai ${averageScore}. Nilai tertinggi: ${highestSummative?.score || 'N/A'} (${highestSummative?.subject || ''}), terendah: ${lowestSummative?.score || 'N/A'} (${lowestSummative?.subject || ''}).
            - Akademik Formatif (Kuis/Tugas): Rata-rata skor dari ${quizPoints.length} penilaian adalah ${averageQuizScore}%.
            - Pelanggaran: Total ${totalViolationPoints} poin dari ${violations.length} pelanggaran.
            `;

            const systemInstruction = `Anda adalah seorang guru wali kelas yang bijaksana dan perhatian. Tugas Anda adalah menulis paragraf "Catatan Wali Kelas" untuk rapor siswa. Berikan output dalam format JSON yang valid. Jangan menambahkan markdown atau format lainnya.`;
            
            const prompt = `Buatkan draf Catatan Wali Kelas untuk siswa bernama ${student.name} berdasarkan ringkasan data berikut. Buat catatan yang seimbang, menyoroti hal positif dan area pengembangan. Gabungkan menjadi narasi yang mengalir dan memotivasi.
    
            Data Siswa:
            ${dataSummary}
            
            Isi skema JSON berikut:`;

            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    opening: {
                        type: Type.STRING,
                        description: "Kalimat pembuka yang positif tentang siswa secara umum. Sebut nama siswa.",
                    },
                    body: {
                        type: Type.STRING,
                        description: "Analisis inti (2-3 kalimat). Sebutkan kekuatan spesifik (misalnya, nilai tinggi di mapel tertentu) dan area yang perlu diperhatikan (misalnya, kehadiran atau pelanggaran) secara konstruktif.",
                    },
                    closing: {
                        type: Type.STRING,
                        description: "Kalimat penutup yang memotivasi dan memberikan semangat untuk semester berikutnya.",
                    },
                },
                required: ["opening", "body", "closing"],
            };
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { systemInstruction, responseMimeType: "application/json", responseSchema }
            });
            
            const parsedNote = JSON.parse(response.text);
            const finalNote = `${parsedNote.opening} ${parsedNote.body} ${parsedNote.closing}`;
            
            setTeacherNote(finalNote);
            toast.success("Catatan guru berhasil dibuat oleh AI!");
        } catch (err) {
            toast.error("Gagal membuat catatan guru. Silakan coba lagi.");
            console.error(err);
        } finally {
            setIsGeneratingNote(false);
        }
    };
    
    const generatePdf = () => {
        if (!data) {
            toast.error("Data laporan belum siap.");
            return;
        }
        setIsExporting(true);
        toast.info("Membuat file PDF...");

        try {
            const doc = new jsPDF('p', 'pt', 'a4');
            const pageW = doc.internal.pageSize.getWidth();
            const margin = 40;
            let y = 60;

            // --- HEADER ---
            doc.setFont('times', 'bold');
            doc.setFontSize(16);
            doc.text(reportHeader.title, pageW / 2, y, { align: 'center' });
            y += 18;

            doc.setFontSize(14);
            doc.text(reportHeader.schoolName, pageW / 2, y, { align: 'center' });
            y += 16;
            
            doc.setFont('times', 'normal');
            doc.setFontSize(11);
            doc.text(reportHeader.academicYear, pageW / 2, y, { align: 'center' });
            y += 10;
            
            doc.setLineWidth(2);
            doc.line(margin, y, pageW - margin, y);
            y += 25;

            // --- STUDENT INFO ---
            doc.setFontSize(10);
            doc.setFont('times', 'normal');
            autoTable(doc, {
                body: [
                    [{content: 'Nama Siswa', styles: {fontStyle: 'bold'}}, `: ${studentInfo.name}`, {content: 'Kelas', styles: {fontStyle: 'bold'}}, `: ${studentInfo.className}`],
                    [{content: 'No. Induk / NISN', styles: {fontStyle: 'bold'}}, `: ${studentInfo.nisn}`, {content: 'Fase', styles: {fontStyle: 'bold'}}, `: ${studentInfo.phase}`],
                ],
                startY: y,
                theme: 'plain',
                styles: { fontSize: 10, font: 'times', cellPadding: 1 },
                columnStyles: { 0: {cellWidth: 100}, 2: {cellWidth: 100} }
            });
            y = (doc as any).lastAutoTable.finalY + 20;

            // --- SECTION A: ACADEMIC ---
            doc.setFont('times', 'bold');
            doc.setFontSize(12);
            doc.text('A. Nilai Akademik (Sumatif)', margin, y);
            y += 5;

            autoTable(doc, {
                head: [['No', 'Mata Pelajaran', 'Nilai', 'Predikat', 'Deskripsi']],
                body: editableAcademicRecords.map((r, i) => [
                    i + 1,
                    r.subject,
                    r.score,
                    r.predikat,
                    r.deskripsi
                ]),
                startY: y,
                theme: 'grid',
                headStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: 'bold', font: 'times' },
                styles: { fontSize: 9, font: 'times', cellPadding: 5, lineColor: [0,0,0], lineWidth: 0.5 },
                columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 2: { halign: 'center', cellWidth: 40 }, 3: { halign: 'center', cellWidth: 50 } }
            });
            y = (doc as any).lastAutoTable.finalY + 15;

            // Formative
            if (editableQuizPoints.length > 0) {
                 doc.setFont('times', 'bold');
                doc.setFontSize(11);
                doc.text('Nilai Formatif (Kuis, Tugas, Harian)', margin, y);
                y += 5;
                autoTable(doc, {
                    head: [['No', 'Tanggal', 'Nama Kuis/Tugas', 'Mapel', 'Skor']],
                    body: editableQuizPoints.map((q, i) => [
                        i + 1, q.quiz_date, q.quiz_name, q.subject, `${q.points}/${q.max_points}`
                    ]),
                    startY: y, theme: 'grid',
                    headStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: 'bold', font: 'times' },
                    styles: { fontSize: 9, font: 'times', cellPadding: 5, lineColor: [0,0,0], lineWidth: 0.5 },
                    columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 4: { halign: 'center' } }
                });
                y = (doc as any).lastAutoTable.finalY + 20;
            }

            // --- SECTION B: EXTRACURRICULARS ---
            if (editableExtracurriculars.length > 0) {
                if (y > doc.internal.pageSize.getHeight() - 150) { doc.addPage(); y = margin; }
                doc.setFont('times', 'bold');
                doc.setFontSize(12);
                doc.text('B. Pengembangan Diri & Ekstrakurikuler', margin, y);
                y += 5;
                autoTable(doc, {
                    head: [['No', 'Kegiatan Ekstrakurikuler', 'Keterangan']],
                    body: editableExtracurriculars.map((e, i) => [i + 1, e.activity, e.description]),
                    startY: y, theme: 'grid',
                    headStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: 'bold', font: 'times' },
                    styles: { fontSize: 9, font: 'times', cellPadding: 5, lineColor: [0,0,0], lineWidth: 0.5 },
                    columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 1: { cellWidth: 150 } }
                });
                y = (doc as any).lastAutoTable.finalY + 20;
            }

            // --- SECTION C: PERSONALITY ---
            if (y > doc.internal.pageSize.getHeight() - 250) { doc.addPage(); y = margin; }
            doc.setFont('times', 'bold');
            doc.setFontSize(12);
            doc.text('C. Kepribadian dan Sikap', margin, y);
            y += 15;

            // Attendance
            doc.setFont('times', 'bold');
            doc.setFontSize(11);
            doc.text('1. Ketidakhadiran', margin, y);
            y+= 5;
            autoTable(doc, {
                body: [
                    [`Sakit (S): ${editableAttendanceSummary.Sakit} hari`, `Izin (I): ${editableAttendanceSummary.Izin} hari`, `Tanpa Keterangan (A): ${editableAttendanceSummary.Alpha} hari`],
                ],
                startY: y, theme: 'plain', styles: { fontSize: 10, font: 'times' }
            });
            y = (doc as any).lastAutoTable.finalY + 15;

            // Behavior
            doc.setFont('times', 'bold');
            doc.setFontSize(11);
            doc.text('2. Catatan Perilaku', margin, y);
            y += 12;
            doc.setFont('times', 'normal');
            doc.setFontSize(10);
            const behaviorLines = doc.splitTextToSize(behavioralNote, pageW - margin * 2);
            doc.text(behaviorLines, margin, y);
            y += behaviorLines.length * 12 + 10;
            
            // Violations
            if (editableViolations.length > 0) {
                 doc.setFont('times', 'bold');
                doc.setFontSize(11);
                doc.text('Rincian Pelanggaran', margin, y);
                y += 5;
                autoTable(doc, {
                    head: [['No', 'Tanggal', 'Deskripsi', 'Poin']],
                    body: editableViolations.map((v, i) => [i + 1, v.date, v.description, v.points]),
                    startY: y, theme: 'grid',
                    headStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: 'bold', font: 'times' },
                    styles: { fontSize: 9, font: 'times', cellPadding: 5, lineColor: [0,0,0], lineWidth: 0.5 },
                    columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 3: { halign: 'center' } }
                });
                 y = (doc as any).lastAutoTable.finalY + 20;
            }

            // --- SECTION D: TEACHER NOTE ---
            if (y > doc.internal.pageSize.getHeight() - 150) { doc.addPage(); y = margin; }
            doc.setFont('times', 'bold');
            doc.setFontSize(12);
            doc.text('D. Catatan Wali Kelas', margin, y);
            y += 12;
            doc.setFont('times', 'normal');
            doc.setFontSize(10);
            const teacherNoteLines = doc.splitTextToSize(teacherNote, pageW - margin * 2 - 20);
            doc.rect(margin, y, pageW - margin * 2, teacherNoteLines.length * 12 + 20, 'S');
            doc.text(teacherNoteLines, margin + 10, y + 15);
            y += teacherNoteLines.length * 12 + 40;

            // --- SIGNATURES ---
            const pageH = doc.internal.pageSize.getHeight();
            if (y > pageH - 120) {
                doc.addPage();
                y = pageH - 120;
            } else {
                 y = pageH - 120;
            }
            const signatureX2 = pageW - margin;
            doc.setFontSize(10);
            doc.text('Orang Tua/Wali Siswa', margin, y);
            doc.text('Wali Kelas', signatureX2, y, { align: 'right' });
            y += 60;
            doc.text('(___________________)', margin, y);
            doc.text(`( ${user?.name || '___________________'} )`, signatureX2, y, { align: 'right' });

            doc.save(`Rapor_${studentInfo.name.replace(/\s/g, '_')}.pdf`);

        } catch (e) {
            console.error(e);
            toast.error("Gagal membuat PDF. Silakan periksa konsol untuk detail.");
        } finally {
            setIsExporting(false);
        }
    }

    const handlePrint = () => {
        generatePdf();
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen bg-gray-100"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    if (isError) {
        return <div className="flex items-center justify-center h-screen bg-gray-100">Error: {(error as Error).message}</div>;
    }

    return (
        <div className="bg-gray-200 dark:bg-gray-800 min-h-screen p-4 sm:p-8 font-sans">
            <div className="print:hidden max-w-4xl mx-auto mb-6 space-y-4">
                <div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-md p-4 rounded-xl shadow-md flex flex-wrap justify-between items-center gap-4">
                    <Button variant="outline" onClick={() => navigate(-1)}>
                        <ArrowLeftIcon className="w-4 h-4 mr-2" />
                        Kembali
                    </Button>
                    <Button onClick={handlePrint} disabled={isExporting}>
                        {isExporting ? 'Membuat PDF...' : <><PrinterIcon className="w-4 h-4 mr-2" /> Cetak / Simpan PDF</>}
                    </Button>
                </div>
            </div>

            <div id="report-card" className="bg-white text-black shadow-2xl max-w-4xl mx-auto font-serif">
                <div className="p-10 sm:p-12 md:p-16">
                    <header className="text-center border-b-4 border-black pb-4 mb-8">
                        <h1 contentEditable={true} onBlur={e => setReportHeader(p => ({...p, title: (e.target as HTMLElement).textContent || ''}))} suppressContentEditableWarning={true} className="text-2xl sm:text-3xl font-bold tracking-wider editable-field">{reportHeader.title}</h1>
                        <h2 contentEditable={true} onBlur={e => setReportHeader(p => ({...p, schoolName: (e.target as HTMLElement).textContent || ''}))} suppressContentEditableWarning={true} className="text-xl sm:text-2xl font-semibold editable-field">{reportHeader.schoolName}</h2>
                        <p contentEditable={true} onBlur={e => setReportHeader(p => ({...p, academicYear: (e.target as HTMLElement).textContent || ''}))} suppressContentEditableWarning={true} className="text-sm mt-1 editable-field">{reportHeader.academicYear}</p>
                    </header>
                    
                    <section className="text-sm">
                        <table className="w-full">
                            <tbody>
                                <tr>
                                    <td className="w-1/4 py-1">Nama Siswa</td>
                                    <td className="w-auto py-1">: <input type="text" value={studentInfo.name} onChange={e => setStudentInfo(p => ({...p, name: e.target.value}))} className="bg-transparent focus:bg-yellow-100 p-1 rounded-sm"/></td>
                                    <td className="w-1/4 py-1 pl-8">Kelas</td>
                                    <td className="w-auto py-1">: <input type="text" value={studentInfo.className} onChange={e => setStudentInfo(p => ({...p, className: e.target.value}))} className="bg-transparent focus:bg-yellow-100 p-1 rounded-sm w-24"/></td>
                                </tr>
                                <tr>
                                    <td className="w-1/4 py-1">No. Induk / NISN</td>
                                    <td className="w-auto py-1">: <input type="text" value={studentInfo.nisn} onChange={e => setStudentInfo(p => ({...p, nisn: e.target.value}))} className="bg-transparent focus:bg-yellow-100 p-1 rounded-sm"/></td>
                                    <td className="w-1/4 py-1 pl-8">Fase</td>
                                    <td className="w-auto py-1">: <input type="text" value={studentInfo.phase} onChange={e => setStudentInfo(p => ({...p, phase: e.target.value}))} className="bg-transparent focus:bg-yellow-100 p-1 rounded-sm w-24"/></td>
                                </tr>
                            </tbody>
                        </table>
                    </section>
                    
                    <section className="mt-8">
                        <h3 className="font-bold text-base mb-2">A. Nilai Akademik (Sumatif)</h3>
                        <table className="w-full text-xs sm:text-sm border-collapse border border-black">
                            <thead>
                                <tr className="bg-gray-100 font-bold text-center">
                                    <td className="border border-black p-2 w-[5%]">No</td>
                                    <td className="border border-black p-2 w-[25%]">Mata Pelajaran</td>
                                    <td className="border border-black p-2 w-[10%]">Nilai</td>
                                    <td className="border border-black p-2 w-[10%]">Predikat</td>
                                    <td className="border border-black p-2">Deskripsi</td>
                                    <td className="border border-black p-1 print:hidden w-[5%]">Aksi</td>
                                </tr>
                            </thead>
                            <tbody>
                                {editableAcademicRecords.map((record, index) => (
                                    <tr key={index}>
                                        <td className="border border-black p-2 text-center">{index + 1}</td>
                                        <td className="border border-black"><EditableCell value={record.subject} onChange={(val) => handleListChange(setEditableAcademicRecords, index, 'subject', val)} /></td>
                                        <td className="border border-black"><EditableCell value={record.score} onChange={(val) => handleListChange(setEditableAcademicRecords, index, 'score', val)} type="number" className="text-center" /></td>
                                        <td className="border border-black text-center"><EditableCell value={record.predikat} onChange={(val) => handleListChange(setEditableAcademicRecords, index, 'predikat', val)} className="text-center" /></td>
                                        <td className="border border-black"><EditableCell value={record.deskripsi} onChange={(val) => handleListChange(setEditableAcademicRecords, index, 'deskripsi', val)} /></td>
                                        <td className="border border-black text-center print:hidden"><Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteRow(setEditableAcademicRecords, index)}><TrashIcon className="w-4 h-4" /></Button></td>
                                    </tr>
                                ))}
                                 <tr className="print:hidden"><td colSpan={6} className="p-1"><Button variant="outline" size="sm" className="w-full" onClick={() => handleAddRow(setEditableAcademicRecords, { subject: 'Mapel Baru', score: 0, predikat: 'D', deskripsi: 'Memerlukan bimbingan.' })}><PlusIcon className="w-4 h-4 mr-2"/>Tambah Baris</Button></td></tr>
                            </tbody>
                        </table>

                        <h4 className="font-semibold text-sm mb-2 mt-4">Nilai Formatif (Kuis, Tugas, Harian)</h4>
                        <table className="w-full text-xs sm:text-sm border-collapse border border-black">
                            <thead>
                                <tr className="bg-gray-100 font-bold text-center">
                                    <td className="border border-black p-2 w-[5%]">No</td>
                                    <td className="border border-black p-2 w-[20%]">Tanggal</td>
                                    <td className="border border-black p-2 w-[35%]">Nama Kuis/Tugas</td>
                                    <td className="border border-black p-2">Mapel</td>
                                    <td className="border border-black p-2 w-[15%]">Skor</td>
                                    <td className="border border-black p-1 print:hidden w-[5%]">Aksi</td>
                                </tr>
                            </thead>
                            <tbody>
                                {editableQuizPoints.map((quiz, index) => (
                                    <tr key={index}>
                                        <td className="border border-black p-2 text-center">{index + 1}</td>
                                        <td className="border border-black"><EditableCell value={quiz.quiz_date} onChange={(val) => handleListChange(setEditableQuizPoints, index, 'quiz_date', val)} type="text" className="text-center" /></td>
                                        <td className="border border-black"><EditableCell value={quiz.quiz_name} onChange={(val) => handleListChange(setEditableQuizPoints, index, 'quiz_name', val)} /></td>
                                        <td className="border border-black"><EditableCell value={quiz.subject} onChange={(val) => handleListChange(setEditableQuizPoints, index, 'subject', val)} /></td>
                                        <td className="border border-black"><EditableCell value={`${quiz.points}/${quiz.max_points}`} onChange={(val) => { const [p, m] = String(val).split('/'); handleListChange(setEditableQuizPoints, index, 'points', Number(p) || 0); handleListChange(setEditableQuizPoints, index, 'max_points', Number(m) || 0); }} className="text-center" /></td>
                                        <td className="border border-black text-center print:hidden"><Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteRow(setEditableQuizPoints, index)}><TrashIcon className="w-4 h-4" /></Button></td>
                                    </tr>
                                ))}
                                 <tr className="print:hidden"><td colSpan={6} className="p-1"><Button variant="outline" size="sm" className="w-full" onClick={() => handleAddRow(setEditableQuizPoints, { quiz_date: new Date().toISOString().slice(0,10), quiz_name: 'Kuis Baru', subject: 'Mapel', points: 0, max_points: 100 })}><PlusIcon className="w-4 h-4 mr-2"/>Tambah Baris</Button></td></tr>
                            </tbody>
</table>
                    </section>

                    <section className="mt-8">
                        <h3 className="font-bold text-base mb-2">B. Pengembangan Diri & Ekstrakurikuler</h3>
                        <table className="w-full text-xs sm:text-sm border-collapse border border-black">
                            <thead>
                                <tr className="bg-gray-100 font-bold text-center">
                                    <td className="border border-black p-2 w-[5%]">No</td>
                                    <td className="border border-black p-2 w-[35%]">Kegiatan Ekstrakurikuler</td>
                                    <td className="border border-black p-2">Keterangan</td>
                                    <td className="border border-black p-1 print:hidden w-[5%]">Aksi</td>
                                </tr>
                            </thead>
                            <tbody>
                                {editableExtracurriculars.map((extra, index) => (
                                    <tr key={index}>
                                        <td className="border border-black p-2 text-center">{index + 1}</td>
                                        <td className="border border-black"><EditableCell value={extra.activity} onChange={(val) => handleListChange(setEditableExtracurriculars, index, 'activity', val)} /></td>
                                        <td className="border border-black"><EditableCell value={extra.description} onChange={(val) => handleListChange(setEditableExtracurriculars, index, 'description', val)} /></td>
                                        <td className="border border-black text-center print:hidden"><Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteRow(setEditableExtracurriculars, index)}><TrashIcon className="w-4 h-4" /></Button></td>
                                    </tr>
                                ))}
                                <tr className="print:hidden"><td colSpan={4} className="p-1"><Button variant="outline" size="sm" className="w-full" onClick={() => handleAddRow(setEditableExtracurriculars, { activity: 'Kegiatan Baru', description: 'Deskripsi singkat kegiatan.' })}><PlusIcon className="w-4 h-4 mr-2"/>Tambah Baris</Button></td></tr>
                            </tbody>
                        </table>
                    </section>

                    <section className="mt-8">
                        <h3 className="font-bold text-base mb-2">C. Kepribadian dan Sikap</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            <div>
                                <h4 className="font-semibold text-sm mb-2">1. Ketidakhadiran</h4>
                                <table className="w-full text-sm">
                                    <tbody>
                                        <tr>
                                            <td className="py-1 w-2/3">Sakit (S)</td>
                                            <td className="py-1">: <input type="number" min="0" value={editableAttendanceSummary.Sakit} onChange={e => setEditableAttendanceSummary(p => ({...p, Sakit: Number(e.target.value)}))} className="w-16 bg-transparent focus:bg-yellow-100 p-1 rounded-sm"/> hari</td>
                                        </tr>
                                        <tr>
                                            <td className="py-1">Izin (I)</td>
                                            <td className="py-1">: <input type="number" min="0" value={editableAttendanceSummary.Izin} onChange={e => setEditableAttendanceSummary(p => ({...p, Izin: Number(e.target.value)}))} className="w-16 bg-transparent focus:bg-yellow-100 p-1 rounded-sm"/> hari</td>
                                        </tr>
                                        <tr>
                                            <td className="py-1">Tanpa Keterangan (A)</td>
                                            <td className="py-1">: <input type="number" min="0" value={editableAttendanceSummary.Alpha} onChange={e => setEditableAttendanceSummary(p => ({...p, Alpha: Number(e.target.value)}))} className="w-16 bg-transparent focus:bg-yellow-100 p-1 rounded-sm"/> hari</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div>
                                <h4 className="font-semibold text-sm mb-2">2. Catatan Perilaku</h4>
                                <textarea 
                                    value={behavioralNote}
                                    onChange={(e) => setBehavioralNote(e.target.value)}
                                    className="border border-black p-2 text-sm w-full h-full min-h-[90px] bg-transparent focus:bg-yellow-100 focus:outline-none focus:ring-1 focus:ring-yellow-500 rounded-sm"
                                />
                            </div>
                        </div>
                        {editableViolations.length > 0 && (
                            <div className="mt-4">
                                <h4 className="font-semibold text-sm mb-2">Rincian Pelanggaran</h4>
                                <table className="w-full text-xs sm:text-sm border-collapse border border-black">
                                    <thead>
                                        <tr className="bg-gray-100 font-bold text-center">
                                            <td className="border border-black p-2 w-[5%]">No</td>
                                            <td className="border border-black p-2 w-[20%]">Tanggal</td>
                                            <td className="border border-black p-2">Deskripsi</td>
                                            <td className="border border-black p-2 w-[10%]">Poin</td>
                                            <td className="border border-black p-1 print:hidden w-[5%]">Aksi</td>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {editableViolations.map((violation, index) => (
                                            <tr key={index}>
                                                <td className="border border-black p-2 text-center">{index + 1}</td>
                                                <td className="border border-black"><EditableCell value={violation.date} onChange={(val) => handleListChange(setEditableViolations, index, 'date', val)} className="text-center" /></td>
                                                <td className="border border-black"><EditableCell value={violation.description} onChange={(val) => handleListChange(setEditableViolations, index, 'description', val)} /></td>
                                                <td className="border border-black"><EditableCell value={violation.points} onChange={(val) => handleListChange(setEditableViolations, index, 'points', val)} type="number" className="text-center" /></td>
                                                <td className="border border-black text-center print:hidden"><Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteRow(setEditableViolations, index)}><TrashIcon className="w-4 h-4" /></Button></td>
                                            </tr>
                                        ))}
                                         <tr className="print:hidden"><td colSpan={5} className="p-1"><Button variant="outline" size="sm" className="w-full" onClick={() => handleAddRow(setEditableViolations, { date: new Date().toISOString().slice(0,10), description: 'Pelanggaran baru', points: 0 })}><PlusIcon className="w-4 h-4 mr-2"/>Tambah Baris</Button></td></tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                    
                    <section className="mt-8">
                         <div className="flex justify-between items-center mb-2 print:hidden">
                            <h3 className="font-bold text-base text-black">D. Catatan Wali Kelas</h3>
                            <Button size="sm" variant="outline" onClick={handleGenerateAiNote} disabled={isGeneratingNote}>
                                {isGeneratingNote ? 'Membuat...' : <><BrainCircuitIcon className="w-4 h-4 mr-2" /> Buat dengan AI</>}
                            </Button>
                        </div>
                        <h3 className="font-bold text-base mb-2 hidden print:block">D. Catatan Wali Kelas</h3>
                        <textarea
                            value={teacherNote}
                            onChange={(e) => setTeacherNote(e.target.value)}
                            className="w-full p-2 border border-black min-h-[100px] text-sm bg-transparent focus:bg-yellow-100 focus:outline-none focus:ring-1 focus:ring-yellow-500 rounded-sm"
                        />
                    </section>
                    
                </div>
            </div>
        </div>
    );
};

export default ReportPage;