import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Database } from '../../services/database.types';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { GraduationCapIcon, PrinterIcon, ShieldAlertIcon, CheckSquareIcon, ArrowLeftIcon, ClipboardPasteIcon, SparklesIcon } from '../Icons';
import { violationList } from '../../services/violations.data';
import { parseScoresWithAi } from '@/services/aiService';
import { generateBulkReport } from '@/services/pdfService';
import * as db from '@/services/databaseService';

type ClassRow = Database['public']['Tables']['classes']['Row'];
type StudentRow = Database['public']['Tables']['students']['Row'];
type InputMode = 'quiz' | 'subject_grade' | 'violation' | 'bulk_report';
type Step = 1 | 2;

const actionCards: { mode: InputMode; title: string; description: string; icon: React.FC<any> }[] = [
    { mode: 'subject_grade', title: 'Input Nilai Mapel', description: 'Masukkan nilai sumatif/akhir untuk satu kelas sekaligus.', icon: GraduationCapIcon },
    { mode: 'quiz', title: 'Input Poin Keaktifan', description: 'Beri poin untuk siswa yang aktif di kelas (bertanya, maju, dll).', icon: CheckSquareIcon },
    { mode: 'violation', title: 'Input Pelanggaran', description: 'Catat poin pelanggaran untuk beberapa siswa sekaligus.', icon: ShieldAlertIcon },
    { mode: 'bulk_report', title: 'Cetak Rapor Massal', description: 'Cetak beberapa rapor siswa dari satu kelas dalam satu file.', icon: PrinterIcon },
];

interface Step1Props { onModeSelect: (mode: InputMode) => void; }

const Step1_ModeSelection: React.FC<Step1Props> = ({ onModeSelect }) => (
    <div className="animate-fade-in">
         <header className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Pusat Input Cerdas</h1>
            <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">Pilih aksi massal yang ingin Anda lakukan.</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {actionCards.map(card => (
                <Card key={card.mode} onClick={() => onModeSelect(card.mode)} className="cursor-pointer group hover:border-purple-500 hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-2">
                    <CardContent className="p-6 text-center">
                        <div className="flex justify-center mb-4"><div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-200 dark:from-purple-900/50 dark:to-indigo-900/70 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"><card.icon className="w-8 h-8 text-purple-600 dark:text-purple-400" /></div></div>
                        <h3 className="text-lg font-bold">{card.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{card.description}</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    </div>
);

interface Step2Props {
    mode: InputMode; onBack: () => void; classes: ClassRow[] | undefined; isLoadingClasses: boolean; selectedClass: string;
    onClassChange: (value: string) => void; students: StudentRow[] | undefined; isLoadingStudents: boolean;
    quizInfo: any; handleQuizInfoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    subjectGradeInfo: any; handleSubjectGradeInfoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    scores: Record<string, string>; handleScoreChange: (studentId: string, value: string) => void;
    pasteData: string; setPasteData: (value: string) => void; handleAiParse: () => void; isParsing: boolean;
    selectedViolationCode: string; setSelectedViolationCode: (value: string) => void;
    violationDate: string; setViolationDate: (value: string) => void;
    selectedStudentIds: Set<string>; handleSelectAllStudents: (checked: boolean) => void;
    handleStudentSelect: (studentId: string) => void; isAllSelected: boolean;
    isSubmitting: boolean; handleSubmit: () => void; isExporting: boolean; exportProgress: string;
    handlePrintBulkReports: () => void; isOnline: boolean;
}

const Step2_ConfigurationAndInput: React.FC<Step2Props> = (props) => {
    const {
        mode, onBack, classes, isLoadingClasses, selectedClass, onClassChange, students, isLoadingStudents,
        quizInfo, handleQuizInfoChange, subjectGradeInfo, handleSubjectGradeInfoChange,
        scores, handleScoreChange, pasteData, setPasteData, handleAiParse, isParsing,
        selectedViolationCode, setSelectedViolationCode, violationDate, setViolationDate,
        selectedStudentIds, handleSelectAllStudents, handleStudentSelect, isAllSelected,
        isSubmitting, handleSubmit, isExporting, exportProgress, handlePrintBulkReports, isOnline
    } = props;

    const currentAction = actionCards.find(c => c.mode === mode)!;
    const selectedViolation = useMemo(() => violationList.find(v => v.code === selectedViolationCode) || null, [selectedViolationCode]);
    const gradedCount = Object.values(scores).filter(s => s?.trim()).length;

    return (
        <div className="space-y-6 animate-fade-in">
            <header className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={onBack}><ArrowLeftIcon className="w-4 h-4" /></Button>
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
                        <Select id="class-select" value={selectedClass} onChange={e => onClassChange(e.target.value)} disabled={isLoadingClasses}>
                            <option value="" disabled>-- Pilih Kelas --</option>{classes?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                    </div>
                    {mode === 'quiz' && <>
                        <div><label htmlFor="quiz-name-input" className="block text-sm font-medium mb-1">Nama Aktivitas</label><Input id="quiz-name-input" name="name" value={quizInfo.name} onChange={handleQuizInfoChange} placeholder="cth. Menjawab Pertanyaan" /></div>
                        <div><label htmlFor="quiz-subject-input" className="block text-sm font-medium mb-1">Mata Pelajaran</label><Input id="quiz-subject-input" name="subject" value={quizInfo.subject} onChange={handleQuizInfoChange} placeholder="cth. Matematika" /></div>
                        <div><label htmlFor="quiz-date-input" className="block text-sm font-medium mb-1">Tanggal</label><Input id="quiz-date-input" name="date" type="date" value={quizInfo.date} onChange={handleQuizInfoChange} /></div>
                    </>}
                    {mode === 'subject_grade' && <>
                        <div className="lg:col-span-1"><label htmlFor="subject-input" className="block text-sm font-medium mb-1">Mata Pelajaran</label><Input id="subject-input" name="subject" value={subjectGradeInfo.subject} onChange={handleSubjectGradeInfoChange} placeholder="cth. Bahasa Indonesia" /></div>
                        <div className="lg:col-span-2"><label htmlFor="notes-input" className="block text-sm font-medium mb-1">Catatan (Opsional)</label><Input id="notes-input" name="notes" value={subjectGradeInfo.notes} onChange={handleSubjectGradeInfoChange} placeholder="cth. Penilaian Akhir Semester" /></div>
                    </>}
                    {mode === 'violation' && <>
                        <div>
                            <label className="block text-sm font-medium mb-1">Jenis Pelanggaran</label>
                            <Select value={selectedViolationCode} onChange={(e) => setSelectedViolationCode(e.target.value)}><option value="" disabled>-- Pilih Pelanggaran --</option>{['Ringan', 'Sedang', 'Berat'].map(cat => (<optgroup key={cat} label={`Pelanggaran ${cat}`}>{violationList.filter(v => v.category === cat).map(v => (<option key={v.code} value={v.code}>{v.description}</option>))}</optgroup>))}</Select>
                            {selectedViolation && <p className="text-xs text-red-500 mt-1">Poin: {selectedViolation.points}</p>}
                        </div>
                        <div><label className="block text-sm font-medium mb-1">Tanggal</label><Input type="date" value={violationDate} onChange={e => setViolationDate(e.target.value)} /></div>
                    </>}
                </CardContent>
            </Card>

            {mode === 'subject_grade' && (<Card><CardHeader><CardTitle className="flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-purple-500"/>Tempel Data Nilai (AI Powered)</CardTitle><CardDescription>Salin data dari spreadsheet dan tempel di sini untuk pengisian otomatis.</CardDescription></CardHeader><CardContent><textarea value={pasteData} onChange={e => setPasteData(e.target.value)} placeholder="Contoh:&#10;Budi Santoso   95&#10;Ani Wijaya      88" rows={4} className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"></textarea><Button onClick={handleAiParse} disabled={isParsing || !isOnline} className="mt-2"><ClipboardPasteIcon className="w-4 h-4 mr-2"/>{isParsing ? 'Memproses...' : 'Proses dengan AI'}</Button></CardContent></Card>)}

            <Card>
                <CardHeader><CardTitle>Tahap 2: Input Data Siswa</CardTitle></CardHeader>
                <CardContent>
                    {isLoadingStudents && <div className="text-center p-8">Memuat siswa...</div>}
                    {!selectedClass && <div className="text-center p-8 text-gray-500">Pilih kelas untuk menampilkan daftar siswa.</div>}
                    {students && students.length > 0 && (<div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400"><tr><th scope="col" className="p-4">{mode !== 'subject_grade' && mode !== 'bulk_report' && <Checkbox checked={isAllSelected} onChange={e => handleSelectAllStudents(e.target.checked)} />}</th><th scope="col" className="px-6 py-3">Nama Siswa</th><th scope="col" className="px-6 py-3">{mode === 'subject_grade' ? 'Nilai (0-100)' : 'Pilih'}</th></tr></thead><tbody>{students.map(s => (<tr key={s.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"><td className="w-4 p-4">{mode !== 'subject_grade' && <Checkbox checked={selectedStudentIds.has(s.id)} onChange={() => handleStudentSelect(s.id)} />}</td><th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">{s.name}</th><td className="px-6 py-4">{mode === 'subject_grade' ? <Input type="number" min="0" max="100" value={scores[s.id] || ''} onChange={e => handleScoreChange(s.id, e.target.value)} className="w-24 h-8" /> : <Checkbox checked={selectedStudentIds.has(s.id)} onChange={() => handleStudentSelect(s.id)} />}</td></tr>))}</tbody></table></div>)}
                </CardContent>
                {students && students.length > 0 && <CardFooter className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50 dark:bg-gray-900/50">
                    {mode === 'subject_grade' ? (<div className="text-sm text-gray-500">{gradedCount} / {students.length} siswa dinilai</div>) : (<div className="text-sm text-gray-500">{selectedStudentIds.size} / {students.length} siswa dipilih</div>)}
                    {mode === 'bulk_report' ? (<Button onClick={handlePrintBulkReports} disabled={isExporting || selectedStudentIds.size === 0 || !isOnline}><PrinterIcon className="w-4 h-4 mr-2" />{isExporting ? `Mencetak ${exportProgress}...` : `Cetak ${selectedStudentIds.size} Rapor`}</Button>) : (<Button onClick={handleSubmit} disabled={isSubmitting || !isOnline}>{isSubmitting ? 'Menyimpan...' : 'Simpan Semua'}</Button>)}
                </CardFooter>}
            </Card>
        </div>
    );
};

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
        queryFn: async () => { const { data, error } = await db.getClasses(user!.id); if (error) throw error; return data || []; },
        enabled: !!user,
    });
    
    const { data: students, isLoading: isLoadingStudents } = useQuery({
        queryKey: ['studentsOfClass', selectedClass],
        queryFn: async () => { if (!selectedClass) return []; const { data, error } = await db.getStudentsByClass(selectedClass); if (error) throw error; return data || []; },
        enabled: !!selectedClass,
    });
    
    useEffect(() => { setScores({}); setSelectedStudentIds(new Set()); setPasteData(''); }, [selectedClass, mode]);
    useEffect(() => { if (classes && classes.length > 0 && !selectedClass) setSelectedClass(classes[0].id) }, [classes]);

    const handleModeSelect = (selectedMode: InputMode) => { setMode(selectedMode); setStep(2); };
    const handleBack = () => { setStep(1); setSelectedClass(classes?.[0]?.id || ''); };
    
    const handleQuizInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => setQuizInfo(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleSubjectGradeInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => setSubjectGradeInfo(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleScoreChange = (studentId: string, value: string) => setScores(prev => ({ ...prev, [studentId]: value }));

    const handleAiParse = async () => {
        if (!pasteData.trim() || !students || students.length === 0) { toast.warning("Harap masukkan data untuk diproses dan pilih kelas."); return; }
        setIsParsing(true); toast.info("AI sedang memproses data Anda...");
        try {
            const studentNames = students.map(s => s.name);
            const parsedScores = await parseScoresWithAi(pasteData, studentNames);
            const studentMapByName = new Map(students.map(s => [s.name, s.id]));
            let updatedCount = 0;
            const newScores = { ...scores };
            Object.entries(parsedScores).forEach(([name, score]) => {
                const studentId = studentMapByName.get(name);
                if (studentId) { newScores[studentId] = String(score); updatedCount++; }
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
    
    const handleSelectAllStudents = (checked: boolean) => setSelectedStudentIds(new Set(checked ? students?.map(s => s.id) : []));
    const handleStudentSelect = (studentId: string) => setSelectedStudentIds(prev => { const newSet = new Set(prev); newSet.has(studentId) ? newSet.delete(studentId) : newSet.add(studentId); return newSet; });
    const isAllSelected = students ? selectedStudentIds.size === students.length && students.length > 0 : false;
    
    const saveQuizScoresMutation = useMutation({
        mutationFn: (records: Omit<Database['public']['Tables']['quiz_points']['Row'], 'id' | 'created_at'>[]) => db.addQuizPoints(records),
        onSuccess: () => { toast.success("Poin keaktifan berhasil disimpan!"); setSelectedStudentIds(new Set()); },
        onError: (error: Error) => toast.error(`Gagal: ${error.message}`),
    });
    const saveSubjectGradesMutation = useMutation({
        mutationFn: (records: Omit<Database['public']['Tables']['academic_records']['Row'], 'id' | 'created_at'>[]) => db.addAcademicRecords(records),
        onSuccess: () => { toast.success("Nilai mata pelajaran berhasil disimpan!"); setScores({}); queryClient.invalidateQueries({ queryKey: ['studentDetails'] }); },
        onError: (error: Error) => toast.error(`Gagal: ${error.message}`),
    });
    const saveViolationsMutation = useMutation({
        mutationFn: (records: Omit<Database['public']['Tables']['violations']['Row'], 'id' | 'created_at'>[]) => db.addViolations(records),
        onSuccess: () => { toast.success("Pelanggaran berhasil disimpan!"); setSelectedStudentIds(new Set()); queryClient.invalidateQueries({ queryKey: ['studentDetails'] }); },
        onError: (error: Error) => toast.error(`Gagal: ${error.message}`),
    });
    
    const handleSubmit = () => {
        if (!user || !students) return;
        const selectedViolation = violationList.find(v => v.code === selectedViolationCode) || null;
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

    const handlePrintBulkReports = async () => {
        if (selectedStudentIds.size === 0) { toast.warning("Pilih minimal satu siswa."); return; }
        if (!user) return;
        setIsExporting(true);
        try {
            await generateBulkReport(
                Array.from(selectedStudentIds),
                user.id,
                classes?.find(c => c.id === selectedClass)?.name,
                setExportProgress
            );
            toast.success("Rapor massal berhasil diunduh!");
        } catch(e: any) {
            toast.error(`Gagal membuat PDF massal: ${e.message}`);
        } finally {
            setIsExporting(false);
            setExportProgress('');
        }
    };
    
    const isSubmitting = saveQuizScoresMutation.isPending || saveSubjectGradesMutation.isPending || saveViolationsMutation.isPending;
    
    const step2Props: Step2Props = {
        mode, onBack: handleBack, classes, isLoadingClasses, selectedClass, onClassChange: setSelectedClass, students, isLoadingStudents,
        quizInfo, handleQuizInfoChange, subjectGradeInfo, handleSubjectGradeInfoChange,
        scores, handleScoreChange, pasteData, setPasteData, handleAiParse, isParsing,
        selectedViolationCode, setSelectedViolationCode, violationDate, setViolationDate,
        selectedStudentIds, handleSelectAllStudents, handleStudentSelect, isAllSelected: isAllSelected,
        isSubmitting, handleSubmit, isExporting, exportProgress, handlePrintBulkReports, isOnline
    };

    return (
        <div className="space-y-6">
            {step === 1 ? <Step1_ModeSelection onModeSelect={handleModeSelect} /> : <Step2_ConfigurationAndInput {...step2Props} />}
        </div>
    );
};

export default MassInputPage;
