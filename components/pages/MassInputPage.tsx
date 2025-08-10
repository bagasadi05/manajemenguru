
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Database } from '../../services/database.types';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { ClipboardPenIcon, GraduationCapIcon, PrinterIcon, ShieldAlertIcon, CheckSquareIcon, ArrowLeftIcon, ClipboardPasteIcon, SparklesIcon } from '../Icons';
import { violationList } from '../../services/violations.data';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AttendanceStatus } from '../../types';
import { GoogleGenAI, Type } from '@google/genai';


type ClassRow = Database['public']['Tables']['classes']['Row'];
type StudentRow = Database['public']['Tables']['students']['Row'];
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

type InputMode = 'quiz' | 'subject_grade' | 'violation' | 'bulk_report';
type Step = 1 | 2; // Step 1: Mode selection, Step 2: Configuration & Input

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const actionCards: { mode: InputMode; title: string; description: string; icon: React.FC<any> }[] = [
    { mode: 'subject_grade', title: 'Input Nilai Mapel', description: 'Masukkan nilai sumatif/akhir untuk satu kelas sekaligus.', icon: GraduationCapIcon },
    { mode: 'quiz', title: 'Input Poin Keaktifan', description: 'Beri poin untuk siswa yang aktif di kelas (bertanya, maju, dll).', icon: CheckSquareIcon },
    { mode: 'violation', title: 'Input Pelanggaran', description: 'Catat poin pelanggaran untuk beberapa siswa sekaligus.', icon: ShieldAlertIcon },
    { mode: 'bulk_report', title: 'Cetak Rapor Massal', description: 'Cetak beberapa rapor siswa dari satu kelas dalam satu file.', icon: PrinterIcon },
];

const MassInputPage: React.FC = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const toast = useToast();
    const isOnline = useOfflineStatus();

    const [step, setStep] = useState<Step>(1);
    const [mode, setMode] = useState<InputMode>('subject_grade');
    const [selectedClass, setSelectedClass] = useState<string>('');
    
    const [quizInfo, setQuizInfo] = useState({ name: '', subject: '', date: new Date().toISOString().slice(0, 10) });
    const [subjectGradeInfo, setSubjectGradeInfo] = useState({ subject: '', notes: '' });
    const [scores, setScores] = useState<Record<string, string>>({});
    const [pasteData, setPasteData] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    
    const [selectedViolationCode, setSelectedViolationCode] = useState<string>('');
    const [violationDate, setViolationDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState('');

    const { data: classes, isLoading: isLoadingClasses } = useQuery({
        queryKey: ['classes', user?.id],
        queryFn: async (): Promise<ClassRow[]> => {
            const { data, error } = await supabase.from('classes').select('*').eq('user_id', user!.id); if (error) throw error; return data || [];
        },
        enabled: !!user,
    });
    
    const { data: students, isLoading: isLoadingStudents } = useQuery({
        queryKey: ['studentsOfClass', selectedClass],
        queryFn: async (): Promise<StudentRow[]> => {
            if (!selectedClass) return [];
            const { data, error } = await supabase.from('students').select('*').eq('class_id', selectedClass).order('name'); if (error) throw error; return data || [];
        },
        enabled: !!selectedClass,
    });
    
    useEffect(() => { setScores({}); setSelectedStudentIds(new Set()); setPasteData(''); }, [selectedClass, mode]);
    useEffect(() => { if (classes && classes.length > 0 && !selectedClass) setSelectedClass(classes[0].id) }, [classes]);

    const handleModeSelect = (selectedMode: InputMode) => { setMode(selectedMode); setStep(2); };
    const handleBack = () => { setStep(1); setSelectedClass(classes?.[0]?.id || ''); };
    
    const handleInfoChange = <T extends Record<string, any>>(
        setter: React.Dispatch<React.SetStateAction<T>>,
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        setter((prev: T) => ({ ...prev, [e.target.name]: e.target.value }) as T);
    };
    const handleScoreChange = (studentId: string, value: string) => setScores(prev => ({ ...prev, [studentId]: value }));

    const handleAiParse = async () => {
        if (!pasteData.trim() || !students || students.length === 0) {
            toast.warning("Harap masukkan data untuk diproses dan pilih kelas.");
            return;
        }
        setIsParsing(true); toast.info("AI sedang memproses data Anda...");
        
        try {
            const studentNames = students.map(s => s.name);
            const systemInstruction = `Anda adalah asisten pemrosesan data. Tugas Anda adalah membaca teks yang berisi nama siswa dan nilai, lalu mencocokkannya dengan daftar nama siswa yang diberikan. Hasilnya harus dalam format JSON yang valid, di mana kunci adalah nama siswa yang cocok dari daftar, dan nilainya adalah skor numerik yang ditemukan. Abaikan nama yang tidak ada dalam daftar.`;
            const prompt = `
                Daftar Siswa: ${JSON.stringify(studentNames)}
                
                Teks Data Nilai:
                """
                ${pasteData}
                """
                
                Proses teks di atas dan kembalikan JSON berisi pasangan nama dan nilai.
            `;
            
            const responseSchema = {
                type: Type.OBJECT,
                properties: {},
                description: "An object where keys are student names (string) and values are their scores (number)."
            }

            const response = await ai.models.generateContent({ 
                model: 'gemini-2.5-flash', 
                contents: prompt, 
                config: { systemInstruction, responseMimeType: "application/json", responseSchema } 
            });
            
            const parsedScores: Record<string, number> = JSON.parse(response.text ?? '');
            const studentMapByName = new Map(students.map(s => [s.name, s.id]));
            
            let updatedCount = 0;
            const newScores = { ...scores };
            Object.entries(parsedScores).forEach(([name, score]) => {
                const studentId = studentMapByName.get(name);
                if (studentId) {
                    newScores[studentId] = String(score);
                    updatedCount++;
                }
            });
            setScores(newScores);
            toast.success(`${updatedCount} nilai berhasil diisi oleh AI!`);
            
        } catch (error) {
            console.error(error);
            toast.error("Gagal memproses data dengan AI. Pastikan format data Anda benar.");
        } finally {
            setIsParsing(false);
        }
    };
    
    const selectedViolation = useMemo(() => violationList.find(v => v.code === selectedViolationCode) || null, [selectedViolationCode]);
    const handleSelectAllStudents = (checked: boolean) => setSelectedStudentIds(new Set(checked ? students?.map(s => s.id) : []));
    const handleStudentSelect = (studentId: string) => setSelectedStudentIds(prev => { const newSet = new Set(prev); newSet.has(studentId) ? newSet.delete(studentId) : newSet.add(studentId); return newSet; });
    const isAllSelected = students ? selectedStudentIds.size === students.length && students.length > 0 : false;
    
    // Mutations
    const saveQuizScoresMutation = useMutation({
        mutationFn: async (records: Database['public']['Tables']['quiz_points']['Insert'][]) => { const { error } = await supabase.from('quiz_points').insert(records); if (error) throw error; },
        onSuccess: () => { toast.success("Poin keaktifan berhasil disimpan!"); setSelectedStudentIds(new Set()); },
        onError: (error: Error) => toast.error(`Gagal: ${error.message}`),
    });
    const saveSubjectGradesMutation = useMutation({
        mutationFn: async (records: Database['public']['Tables']['academic_records']['Insert'][]) => { const { error } = await supabase.from('academic_records').insert(records); if (error) throw error; },
        onSuccess: () => { toast.success("Nilai mata pelajaran berhasil disimpan!"); setScores({}); queryClient.invalidateQueries({ queryKey: ['studentDetails'] }); },
        onError: (error: Error) => toast.error(`Gagal: ${error.message}`),
    });
    const saveViolationsMutation = useMutation({
        mutationFn: async (records: Database['public']['Tables']['violations']['Insert'][]) => { const { error } = await supabase.from('violations').insert(records); if (error) throw error; },
        onSuccess: () => { toast.success("Pelanggaran berhasil disimpan!"); setSelectedStudentIds(new Set()); queryClient.invalidateQueries({ queryKey: ['studentDetails'] }); },
        onError: (error: Error) => toast.error(`Gagal: ${error.message}`),
    });
    
    const handleSubmit = () => {
        if (!user || !students) return;
        if (mode === 'quiz') {
            if (!quizInfo.name || !quizInfo.subject) { toast.warning("Harap isi Nama Aktivitas dan Mata Pelajaran."); return; }
            if (selectedStudentIds.size === 0) { toast.warning("Pilih minimal satu siswa."); return; }
            const records = Array.from(selectedStudentIds).map(studentId => ({ student_id: studentId, user_id: user.id, quiz_name: quizInfo.name, subject: quizInfo.subject, points: 1, max_points: 1, quiz_date: quizInfo.date, }));
            saveQuizScoresMutation.mutate(records);
        } else if (mode === 'subject_grade') {
            if (!subjectGradeInfo.subject) { toast.warning("Harap isi Mata Pelajaran."); return; }
            const records = students.filter(student => scores[student.id]?.trim()).map(student => ({ student_id: student.id, user_id: user.id, subject: subjectGradeInfo.subject, score: Number(scores[student.id]), notes: subjectGradeInfo.notes || 'Nilai dari input massal.' }));
            if (records.length === 0) { toast.warning("Tidak ada nilai untuk disimpan."); return; }
            saveSubjectGradesMutation.mutate(records);
        } else if (mode === 'violation') {
            if (!selectedViolation) { toast.warning("Pilih jenis pelanggaran."); return; }
            if (selectedStudentIds.size === 0) { toast.warning("Pilih minimal satu siswa."); return; }
            const records = Array.from(selectedStudentIds).map(studentId => ({ student_id: studentId, user_id: user.id, date: violationDate, description: selectedViolation.description, points: selectedViolation.points }));
            saveViolationsMutation.mutate(records);
        }
    };

    // Bulk Report Logic
    const fetchBulkReportData = async (studentIds: string[], userId: string): Promise<ReportData[]> => {
        const { data: studentsData, error: sErr } = await supabase.from('students').select('*, classes(id, name)').in('id', studentIds).eq('user_id', userId);
        if (sErr) throw sErr;
        const [rep, att, aca, vio, qui] = await Promise.all([
            supabase.from('reports').select('*').in('student_id', studentIds), supabase.from('attendance').select('*').in('student_id', studentIds),
            supabase.from('academic_records').select('*').in('student_id', studentIds), supabase.from('violations').select('*').in('student_id', studentIds),
            supabase.from('quiz_points').select('*').in('student_id', studentIds)
        ]);
        if (rep.error || att.error || aca.error || vio.error || qui.error) throw new Error('Gagal ambil data rapor.');
        return studentsData.map(s => ({ student: s as StudentWithClass, reports: (rep.data||[]).filter(r=>r.student_id===s.id), attendanceRecords: (att.data||[]).filter(r=>r.student_id===s.id), academicRecords: (aca.data||[]).filter(r=>r.student_id===s.id), violations: (vio.data||[]).filter(r=>r.student_id===s.id), quizPoints: (qui.data||[]).filter(r=>r.student_id===s.id) }));
    };
    
    const getPredicate = (score: number): { p: string; d: string; } => {
        if (score >= 86) return { p: 'A', d: 'Menunjukkan penguasaan materi yang sangat baik.' };
        if (score >= 76) return { p: 'B', d: 'Menunjukkan penguasaan materi yang baik.' };
        if (score >= 66) return { p: 'C', d: 'Menunjukkan penguasaan materi yang cukup.' };
        return { p: 'D', d: 'Memerlukan bimbingan lebih lanjut.' };
    };

    const generateSingleReportPage = (doc: jsPDF, data: ReportData, reportHeader: any) => {
        const { student, academicRecords, violations, attendanceRecords } = data;
        const studentInfo = { name: student.name, nisn: student.id.substring(0, 8), className: student.classes?.name || 'N/A', phase: 'E' };
        const pageW = doc.internal.pageSize.getWidth(); const margin = 40; let y = 60;

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
        const academicDataBody = academicRecords.map((r, i) => { const predicate = getPredicate(r.score); return [i + 1, r.subject, r.score, predicate.p, predicate.d]; });
        autoTable(doc, {
            head: [['No', 'Mata Pelajaran', 'Nilai', 'Predikat', 'Deskripsi']], body: academicDataBody, startY: y, theme: 'grid',
            headStyles: { fillColor: [229, 231, 235], textColor: 20, fontStyle: 'bold', font: 'Tinos' }, styles: { fontSize: 9, font: 'Tinos', cellPadding: 5, lineColor: [0,0,0], lineWidth: 0.5 },
            columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 2: { halign: 'center', cellWidth: 40 }, 3: { halign: 'center', cellWidth: 50 }, 4: { halign: 'justify' } }
        });
        y = (doc as any).lastAutoTable.finalY + 20;

        const attendanceSummary = attendanceRecords.reduce((acc, record) => { if (record.status !== 'Hadir') { acc[record.status] = (acc[record.status] || 0) + 1; } return acc; }, { Sakit: 0, Izin: 0, Alpha: 0 } as Record<Exclude<AttendanceStatus, 'Hadir'>, number>);
        const behavioralNote = violations.length > 0 ? `Terdapat ${violations.length} catatan pelanggaran.` : "Tidak ada catatan pelanggaran. Siswa menunjukkan sikap yang baik dan terpuji selama proses pembelajaran.";
        
        doc.setFont('Tinos', 'bold'); doc.setFontSize(12); doc.text('C. Kepribadian dan Sikap', margin, y); y += 15;
        doc.setFontSize(11); doc.text('1. Ketidakhadiran', margin, y); y += 15;
        autoTable(doc, { body: [[{ content: `Sakit: ${attendanceSummary.Sakit} hari`, styles: { halign: 'center' } }, { content: `Izin: ${attendanceSummary.Izin} hari`, styles: { halign: 'center' } }, { content: `Alpha: ${attendanceSummary.Alpha} hari`, styles: { halign: 'center' } }]], startY: y, theme: 'grid', styles: { font: 'Tinos', fontSize: 10, cellPadding: 5 } });
        y = (doc as any).lastAutoTable.finalY + 15;

        doc.setFont('Tinos', 'bold'); doc.setFontSize(11); doc.text('2. Catatan Perilaku', margin, y); y += 12;
        doc.setFont('Tinos', 'normal'); doc.setFontSize(10);
        const behaviorLines = doc.splitTextToSize(behavioralNote, pageW - margin * 2 - 30);
        doc.text(behaviorLines, margin + 15, y, { align: 'justify' });
        y += (behaviorLines.length * 12) + (violations.length > 0 ? 15 : 25);

        if (violations.length > 0) {
            doc.setFont('Tinos', 'bold'); doc.setFontSize(10); doc.text('Rincian Pelanggaran', margin + 15, y); y += 5;
            autoTable(doc, {
                head: [['No', 'Tanggal', 'Deskripsi', 'Poin']], body: violations.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((v, i) => [i + 1, v.date, v.description, v.points]), startY: y, theme: 'grid',
                headStyles: { fillColor: [229, 231, 235], textColor: 20, fontStyle: 'bold', font: 'Tinos' }, styles: { fontSize: 9, font: 'Tinos', cellPadding: 5, lineColor: [0,0,0], lineWidth: 0.5 },
                columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 3: { halign: 'center', cellWidth: 40 } }
            });
            y = (doc as any).lastAutoTable.finalY + 20;
        }

        const teacherNote = `Ananda ${student.name.split(' ')[0]} menunjukkan perkembangan yang baik. Terus tingkatkan prestasi dan semangat belajar!`;
        doc.setFont('Tinos', 'bold'); doc.setFontSize(12); doc.text('D. Catatan Wali Kelas', margin, y); y += 12;
        doc.setFont('Tinos', 'normal');
        const teacherNoteLines = doc.splitTextToSize(teacherNote, pageW - margin * 2 - 20);
        doc.setDrawColor(0); doc.setLineWidth(0.5); doc.rect(margin, y - 5, pageW - margin * 2, teacherNoteLines.length * 12 + 20, 'S');
        doc.text(teacherNoteLines, margin + 10, y + 10, { align: 'justify', maxWidth: pageW - margin * 2 - 20 });
    };

    const handlePrintBulkReports = async () => {
        if (selectedStudentIds.size === 0) { toast.warning("Pilih minimal satu siswa."); return; }
        if (!user) return;
        setIsExporting(true);
        try {
            const doc = new jsPDF('p', 'pt', 'a4');
            const studentIds = Array.from(selectedStudentIds);
            const reportHeader = { title: "LAPORAN HASIL BELAJAR SISWA", schoolName: "MI AL IRSYAD AL ISLAMIYYAH KOTA MADIUN", academicYear: "Tahun Ajaran 2025/2026 - Semester Ganjil" };
            
            for (let i = 0; i < studentIds.length; i++) {
                const id = studentIds[i];
                setExportProgress(`${i + 1}/${studentIds.length}`);
                const studentReportDataArray = await fetchBulkReportData([id], user.id);
                
                if (studentReportDataArray && studentReportDataArray.length > 0) {
                    generateSingleReportPage(doc, studentReportDataArray[0], reportHeader);
                    if (i < studentIds.length - 1) {
                        doc.addPage();
                    }
                }
            }

            doc.save(`Rapor_Massal_${classes?.find(c => c.id === selectedClass)?.name || 'Kelas'}.pdf`);
            toast.success("Rapor massal berhasil diunduh!");
        } catch(e: any) {
            toast.error(`Gagal membuat PDF massal: ${e.message}`);
        } finally {
            setIsExporting(false);
            setExportProgress('');
        }
    };
    
    const isSubmitting = saveQuizScoresMutation.isPending || saveSubjectGradesMutation.isPending || saveViolationsMutation.isPending;
    const gradedCount = Object.values(scores).filter(s => s?.trim()).length;
    
    // UI Components
    const Step1_ModeSelection = () => (
        <div className="animate-fade-in">
             <header className="text-center mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Pusat Input Cerdas</h1>
                <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">Pilih aksi massal yang ingin Anda lakukan.</p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {actionCards.map(card => (
                    <Card key={card.mode} onClick={() => handleModeSelect(card.mode)} className="cursor-pointer group hover:border-purple-500 hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-2">
                        <CardContent className="p-6 text-center">
                            <div className="flex justify-center mb-4">
                                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-200 dark:from-purple-900/50 dark:to-indigo-900/70 rounded-full flex items-center justify-center transition-transform group-hover:scale-110">
                                    <card.icon className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                                </div>
                            </div>
                            <h3 className="text-lg font-bold">{card.title}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{card.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
    
    const Step2_ConfigurationAndInput = () => {
        const currentAction = actionCards.find(c => c.mode === mode)!;
        return (
            <div className="space-y-6 animate-fade-in">
                <header className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={handleBack}><ArrowLeftIcon className="w-4 h-4" /></Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{currentAction.title}</h1>
                        <p className="mt-1 text-gray-500 dark:text-gray-400">{currentAction.description}</p>
                    </div>
                </header>

                <Card>
                    <CardHeader><CardTitle>Tahap 1: Konfigurasi</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-3">
                            <label htmlFor="class-select" className="block text-sm font-medium mb-1">Pilih Kelas</label>
                            <Select id="class-select" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} disabled={isLoadingClasses}>
                                <option value="" disabled>-- Pilih Kelas --</option>{classes?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </Select>
                        </div>
                        {mode === 'quiz' && <>
                            <div><label className="block text-sm font-medium mb-1">Nama Aktivitas</label><Input name="name" value={quizInfo.name} onChange={e => handleInfoChange(setQuizInfo, e)} placeholder="cth. Menjawab Pertanyaan" /></div>
                            <div><label className="block text-sm font-medium mb-1">Mata Pelajaran</label><Input name="subject" value={quizInfo.subject} onChange={e => handleInfoChange(setQuizInfo, e)} placeholder="cth. Matematika" /></div>
                            <div><label className="block text-sm font-medium mb-1">Tanggal</label><Input name="date" type="date" value={quizInfo.date} onChange={e => handleInfoChange(setQuizInfo, e)} /></div>
                        </>}
                        {mode === 'subject_grade' && <>
                            <div className="lg:col-span-1"><label className="block text-sm font-medium mb-1">Mata Pelajaran</label><Input name="subject" value={subjectGradeInfo.subject} onChange={e => handleInfoChange(setSubjectGradeInfo, e)} placeholder="cth. Bahasa Indonesia" /></div>
                            <div className="lg:col-span-2"><label className="block text-sm font-medium mb-1">Catatan (Opsional)</label><Input name="notes" value={subjectGradeInfo.notes} onChange={e => handleInfoChange(setSubjectGradeInfo, e)} placeholder="cth. Penilaian Akhir Semester" /></div>
                        </>}
                        {mode === 'violation' && <>
                            <div>
                                <label className="block text-sm font-medium mb-1">Jenis Pelanggaran</label>
                                <Select value={selectedViolationCode} onChange={(e) => setSelectedViolationCode(e.target.value)}>
                                    <option value="" disabled>-- Pilih Pelanggaran --</option>
                                    {['Ringan', 'Sedang', 'Berat'].map(cat => (<optgroup key={cat} label={`Pelanggaran ${cat}`}>{violationList.filter(v => v.category === cat).map(v => (<option key={v.code} value={v.code}>{v.description}</option>))}</optgroup>))}
                                </Select>
                                {selectedViolation && <p className="text-xs text-red-500 mt-1">Poin: {selectedViolation.points}</p>}
                            </div>
                            <div><label className="block text-sm font-medium mb-1">Tanggal</label><Input type="date" value={violationDate} onChange={e => setViolationDate(e.target.value)} /></div>
                        </>}
                    </CardContent>
                </Card>

                {mode === 'subject_grade' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-purple-500"/>Tempel Data Nilai (AI Powered)</CardTitle>
                            <CardDescription>Salin data dari spreadsheet (cth. kolom nama dan nilai) dan tempel di sini untuk pengisian otomatis.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <textarea value={pasteData} onChange={e => setPasteData(e.target.value)} placeholder="Contoh:&#10;Budi Santoso   95&#10;Ani Wijaya      88&#10;Cici Paramida   76" rows={4} className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"></textarea>
                            <Button onClick={handleAiParse} disabled={isParsing || !isOnline} className="mt-2"><ClipboardPasteIcon className="w-4 h-4 mr-2"/>{isParsing ? 'Memproses...' : 'Proses dengan AI'}</Button>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader><CardTitle>Tahap 2: Input Data Siswa</CardTitle></CardHeader>
                    <CardContent>
                        {isLoadingStudents && <div className="text-center p-8">Memuat siswa...</div>}
                        {!selectedClass && <div className="text-center p-8 text-gray-500">Pilih kelas untuk menampilkan daftar siswa.</div>}
                        {students && students.length > 0 && (
                             <div className="overflow-x-auto"><table className="w-full text-sm">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400"><tr>
                                    <th scope="col" className="p-4">{mode !== 'subject_grade' && mode !== 'bulk_report' && <Checkbox checked={isAllSelected} onChange={e => handleSelectAllStudents(e.target.checked)} />}</th>
                                    <th scope="col" className="px-6 py-3">Nama Siswa</th>
                                    <th scope="col" className="px-6 py-3">{mode === 'subject_grade' ? 'Nilai (0-100)' : 'Pilih'}</th>
                                </tr></thead>
                                <tbody>{students.map(s => (<tr key={s.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                    <td className="w-4 p-4">{mode !== 'subject_grade' && <Checkbox checked={selectedStudentIds.has(s.id)} onChange={() => handleStudentSelect(s.id)} />}</td>
                                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{s.name}</th>
                                    <td className="px-6 py-4">{mode === 'subject_grade' ? <Input type="number" min="0" max="100" value={scores[s.id] || ''} onChange={e => handleScoreChange(s.id, e.target.value)} className="w-24 h-8" /> : <Checkbox checked={selectedStudentIds.has(s.id)} onChange={() => handleStudentSelect(s.id)} />}</td>
                                </tr>))}</tbody>
                            </table></div>
                        )}
                    </CardContent>
                    {students && students.length > 0 && <CardFooter className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50 dark:bg-gray-900/50">
                        {mode === 'subject_grade' ? (
                            <div className="text-sm text-gray-500">{gradedCount} / {students.length} siswa dinilai</div>
                        ) : (
                            <div className="text-sm text-gray-500">{selectedStudentIds.size} / {students.length} siswa dipilih</div>
                        )}
                        {mode === 'bulk_report' ? (
                            <Button onClick={handlePrintBulkReports} disabled={isExporting || selectedStudentIds.size === 0 || !isOnline}><PrinterIcon className="w-4 h-4 mr-2" />{isExporting ? `Mencetak ${exportProgress}...` : `Cetak ${selectedStudentIds.size} Rapor`}</Button>
                        ) : (
                            <Button onClick={handleSubmit} disabled={isSubmitting || !isOnline}>{isSubmitting ? 'Menyimpan...' : 'Simpan Semua'}</Button>
                        )}
                    </CardFooter>}
                </Card>
            </div>
        )
    };
    
    return (
        <div className="space-y-6">
            {step === 1 ? <Step1_ModeSelection /> : <Step2_ConfigurationAndInput />}
        </div>
    );
};

export default MassInputPage;
