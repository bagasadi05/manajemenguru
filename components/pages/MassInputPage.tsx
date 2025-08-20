import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Database } from '../../services/database.types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { ClipboardPenIcon, GraduationCapIcon, PrinterIcon, ShieldAlertIcon, CheckSquareIcon, ArrowLeftIcon, ClipboardPasteIcon, SparklesIcon, AlertCircleIcon, PencilIcon } from '../Icons';
import { violationList } from '../../services/violations.data';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AttendanceStatus } from '../../types';
import { GoogleGenAI, Type } from '@google/genai';
import { Modal } from '../ui/Modal';


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

type ReviewDataItem = { studentId: string; studentName: string; score: string; originalLine: string; };

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const actionCards: { mode: InputMode; title: string; description: string; icon: React.FC<any> }[] = [
    { mode: 'subject_grade', title: 'Input Nilai Mapel', description: 'Masukkan nilai sumatif/akhir untuk satu kelas sekaligus.', icon: GraduationCapIcon },
    { mode: 'quiz', title: 'Input Poin Keaktifan', description: 'Beri poin untuk siswa yang aktif di kelas (bertanya, maju, dll).', icon: CheckSquareIcon },
    { mode: 'violation', title: 'Input Pelanggaran', description: 'Catat poin pelanggaran untuk beberapa siswa sekaligus.', icon: ShieldAlertIcon },
    { mode: 'bulk_report', title: 'Cetak Rapor Massal', description: 'Cetak beberapa rapor siswa dari satu kelas dalam satu file.', icon: PrinterIcon },
];

// --- Sub-components extracted for stability ---

const Step1_ModeSelection: React.FC<{ handleModeSelect: (mode: InputMode) => void }> = ({ handleModeSelect }) => (
    <div className="animate-fade-in">
         <header className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white text-shadow-md">Pusat Input Cerdas</h1>
            <p className="mt-2 text-lg text-indigo-200">Pilih aksi massal yang ingin Anda lakukan.</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {actionCards.map(card => (
                <div key={card.mode} onClick={() => handleModeSelect(card.mode)} className="relative overflow-hidden cursor-pointer group bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6 text-center transition-all duration-300 hover:bg-white/10 hover:border-purple-400 hover:-translate-y-2 holographic-shine-hover">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 border border-white/10">
                            <card.icon className="w-8 h-8 text-purple-400" />
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-white">{card.title}</h3>
                    <p className="text-sm text-gray-300 mt-1">{card.description}</p>
                </div>
            ))}
        </div>
    </div>
);

interface Step2Props {
    mode: InputMode;
    handleBack: () => void;
    classes: ClassRow[] | undefined;
    selectedClass: string;
    setSelectedClass: (value: string) => void;
    isLoadingClasses: boolean;
    quizInfo: { name: string; subject: string; date: string; };
    setQuizInfo: React.Dispatch<React.SetStateAction<{ name: string; subject: string; date: string; }>>;
    subjectGradeInfo: { subject: string; notes: string; };
    setSubjectGradeInfo: React.Dispatch<React.SetStateAction<{ subject: string; notes: string; }>>;
    scores: Record<string, string>;
    setScores: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    pasteData: string;
    setPasteData: (value: string) => void;
    handleAiParse: () => Promise<void>;
    isParsing: boolean;
    selectedViolationCode: string;
    setSelectedViolationCode: (value: string) => void;
    violationDate: string;
    setViolationDate: (value: string) => void;
    selectedViolation: typeof violationList[number] | null;
    students: StudentRow[] | undefined;
    isLoadingStudents: boolean;
    selectedStudentIds: Set<string>;
    handleSelectAllStudents: (checked: boolean) => void;
    handleStudentSelect: (studentId: string) => void;
    isAllSelected: boolean;
    isExporting: boolean;
    exportProgress: string;
    handlePrintBulkReports: () => Promise<void>;
    handleSubmit: () => void;
    isSubmitting: boolean;
    isOnline: boolean;
    gradedCount: number;
    searchTerm: string;
    setSearchTerm: (value: string) => void;
}

const Step2_ConfigurationAndInput: React.FC<Step2Props> = ({
    mode, handleBack, classes, selectedClass, setSelectedClass, isLoadingClasses,
    quizInfo, setQuizInfo, subjectGradeInfo, setSubjectGradeInfo, scores, setScores,
    pasteData, setPasteData, handleAiParse, isParsing, selectedViolationCode,
    setSelectedViolationCode, violationDate, setViolationDate, selectedViolation,
    students, isLoadingStudents, selectedStudentIds, handleSelectAllStudents,
    handleStudentSelect, isAllSelected, isExporting, exportProgress,
    handlePrintBulkReports, handleSubmit, isSubmitting, isOnline, gradedCount,
    searchTerm, setSearchTerm
}) => {
    const currentAction = actionCards.find(c => c.mode === mode)!;

    const handleInfoChange = (setter: React.Dispatch<React.SetStateAction<any>>, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setter(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleScoreChange = (studentId: string, value: string) => {
        setScores(prev => ({ ...prev, [studentId]: value }));
    };
    
    const inputStyles = "bg-white/10 border-white/20 placeholder:text-gray-400 focus:bg-white/20 focus:border-purple-400";

    return (
        <div className="space-y-6 animate-fade-in">
            <header className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={handleBack} className="bg-white/10 border-white/20 hover:bg-white/20 text-white"><ArrowLeftIcon className="w-4 h-4" /></Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">{currentAction.title}</h1>
                    <p className="mt-1 text-gray-300">{currentAction.description}</p>
                </div>
            </header>

            <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10">
                <div className="p-6 border-b border-white/10"><h3 className="font-bold text-lg text-white">Tahap 1: Konfigurasi</h3></div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-3">
                        <label htmlFor="class-select" className="block text-sm font-medium mb-1 text-gray-200">Pilih Kelas</label>
                        <Select id="class-select" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} disabled={isLoadingClasses} className={inputStyles}>
                            <option value="" disabled>-- Pilih Kelas --</option>{classes?.map(c => <option key={c.id} value={c.id} className="bg-gray-800 text-white">{c.name}</option>)}
                        </Select>
                    </div>
                    {mode === 'quiz' && <>
                        <div><label className="block text-sm font-medium mb-1 text-gray-200">Nama Aktivitas</label><Input name="name" value={quizInfo.name} onChange={e => handleInfoChange(setQuizInfo, e)} placeholder="cth. Menjawab Pertanyaan" className={inputStyles}/></div>
                        <div><label className="block text-sm font-medium mb-1 text-gray-200">Mata Pelajaran</label><Input name="subject" value={quizInfo.subject} onChange={e => handleInfoChange(setQuizInfo, e)} placeholder="cth. Matematika" className={inputStyles}/></div>
                        <div><label className="block text-sm font-medium mb-1 text-gray-200">Tanggal</label><Input name="date" type="date" value={quizInfo.date} onChange={e => handleInfoChange(setQuizInfo, e)} className={inputStyles}/></div>
                    </>}
                    {mode === 'subject_grade' && <>
                        <div className="lg:col-span-1"><label className="block text-sm font-medium mb-1 text-gray-200">Mata Pelajaran</label><Input name="subject" value={subjectGradeInfo.subject} onChange={e => handleInfoChange(setSubjectGradeInfo, e)} placeholder="cth. Bahasa Indonesia" className={inputStyles}/></div>
                        <div className="lg:col-span-2"><label className="block text-sm font-medium mb-1 text-gray-200">Catatan (Opsional)</label><Input name="notes" value={subjectGradeInfo.notes} onChange={e => handleInfoChange(setSubjectGradeInfo, e)} placeholder="cth. Penilaian Akhir Semester" className={inputStyles}/></div>
                    </>}
                    {mode === 'violation' && <>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-200">Jenis Pelanggaran</label>
                            <Select value={selectedViolationCode} onChange={(e) => setSelectedViolationCode(e.target.value)} className={inputStyles}>
                                <option value="" disabled>-- Pilih Pelanggaran --</option>
                                {['Ringan', 'Sedang', 'Berat'].map(cat => (<optgroup key={cat} label={`Pelanggaran ${cat}`} className="bg-gray-800 text-white">{violationList.filter(v => v.category === cat).map(v => (<option key={v.code} value={v.code} className="bg-gray-800 text-white">{v.description}</option>))}</optgroup>))}
                            </Select>
                            {selectedViolation && <p className="text-xs text-red-400 mt-1">Poin: {selectedViolation.points}</p>}
                        </div>
                        <div><label className="block text-sm font-medium mb-1 text-gray-200">Tanggal</label><Input type="date" value={violationDate} onChange={e => setViolationDate(e.target.value)} className={inputStyles}/></div>
                    </>}
                </div>
            </div>

            {mode === 'subject_grade' && (
                <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10">
                    <div className="p-6 border-b border-white/10"><h3 className="font-bold text-lg flex items-center gap-2 text-white"><SparklesIcon className="w-5 h-5 text-purple-400"/>Tempel Data Nilai (AI Powered)</h3><p className="text-sm text-gray-300 mt-1">Salin data dari spreadsheet (cth. kolom nama dan nilai) dan tempel di sini untuk pengisian otomatis.</p></div>
                    <div className="p-6">
                        <textarea value={pasteData} onChange={e => setPasteData(e.target.value)} placeholder="Contoh:&#10;Budi Santoso   95&#10;Ani Wijaya      88&#10;Cici Paramida   76" rows={4} className={`w-full p-2 border rounded-md text-white ${inputStyles}`}></textarea>
                        <Button onClick={handleAiParse} disabled={isParsing || !isOnline} className="mt-2 bg-white/10 border-white/20 hover:bg-white/20 text-white"><ClipboardPasteIcon className="w-4 h-4 mr-2"/>{isParsing ? 'Memproses...' : 'Proses dengan AI'}</Button>
                    </div>
                </div>
            )}

            <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10">
                <div className="p-6 border-b border-white/10"><h3 className="font-bold text-lg text-white">Tahap 2: Input Data Siswa</h3></div>
                <div className="p-6">
                    <div className="mb-4 relative">
                        <svg className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <Input type="text" placeholder="Cari nama siswa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`pl-10 ${inputStyles}`}/>
                    </div>
                    {isLoadingStudents && <div className="text-center p-8">Memuat siswa...</div>}
                    {!selectedClass && <div className="text-center p-8 text-gray-400">Pilih kelas untuk menampilkan daftar siswa.</div>}
                    {students && students.length > 0 && (
                         <div className="overflow-x-auto"><table className="w-full text-sm text-left text-gray-300">
                            <thead className="text-xs text-gray-200 uppercase bg-white/10"><tr>
                                <th scope="col" className="p-4">{mode !== 'subject_grade' && <Checkbox checked={isAllSelected} onChange={e => handleSelectAllStudents(e.target.checked)} />}</th>
                                <th scope="col" className="px-6 py-3">Nama Siswa</th>
                                <th scope="col" className="px-6 py-3">{mode === 'subject_grade' ? 'Nilai (0-100)' : 'Pilih'}</th>
                            </tr></thead>
                            <tbody>{students.map(s => (<tr key={s.id} className="border-b border-white/10 hover:bg-white/5">
                                <td className="w-4 p-4">{mode !== 'subject_grade' && <Checkbox checked={selectedStudentIds.has(s.id)} onChange={() => handleStudentSelect(s.id)} />}</td>
                                <th scope="row" className="px-6 py-4 font-medium whitespace-nowrap text-white">{s.name}</th>
                                <td className="px-6 py-4">{mode === 'subject_grade' ? <Input type="number" min="0" max="100" value={scores[s.id] || ''} onChange={e => handleScoreChange(s.id, e.target.value)} className={`w-24 h-8 ${inputStyles}`}/> : <Checkbox checked={selectedStudentIds.has(s.id)} onChange={() => handleStudentSelect(s.id)} />}</td>
                            </tr>))}</tbody>
                        </table></div>
                    )}
                    {students && students.length === 0 && selectedClass && (
                        <div className="text-center p-8 text-gray-400">
                            {searchTerm ? 'Tidak ada siswa yang cocok dengan pencarian Anda.' : 'Tidak ada siswa di kelas ini.'}
                        </div>
                    )}
                </div>
                {students && students.length > 0 && <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-black/20 p-4 -m-6 mt-6 rounded-b-2xl">
                    {mode === 'subject_grade' ? (
                        <div className="text-sm text-gray-300">{gradedCount} / {students.length} siswa dinilai</div>
                    ) : (
                        <div className="text-sm text-gray-300">{selectedStudentIds.size} / {students.length} siswa dipilih</div>
                    )}
                    {mode === 'bulk_report' ? (
                        <Button onClick={handlePrintBulkReports} disabled={isExporting || selectedStudentIds.size === 0 || !isOnline} className="bg-gradient-to-r from-purple-600 to-blue-500 text-white font-semibold shadow-lg hover:shadow-blue-500/40 transition-all duration-300 hover:-translate-y-0.5"><PrinterIcon className="w-4 h-4 mr-2" />{isExporting ? `Mencetak ${exportProgress}...` : `Cetak ${selectedStudentIds.size} Rapor`}</Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={isSubmitting || !isOnline} className="bg-gradient-to-r from-purple-600 to-blue-500 text-white font-semibold shadow-lg hover:shadow-blue-500/40 transition-all duration-300 hover:-translate-y-0.5">{isSubmitting ? 'Menyimpan...' : 'Simpan Semua'}</Button>
                    )}
                </div>}
            </div>
        </div>
    );
};


// --- Main Page Component ---

const MassInputPage: React.FC = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const toast = useToast();
    const isOnline = useOfflineStatus();

    const [step, setStep] = useState<Step>(1);
    const [mode, setMode] = useState<InputMode>('subject_grade');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    
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
    const [reviewData, setReviewData] = useState<ReviewDataItem[] | null>(null);

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

    const filteredStudents = useMemo(() => {
        if (!students) return [];
        if (!searchTerm.trim()) return students;
        return students.filter(student =>
            student.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [students, searchTerm]);
    
    useEffect(() => { setScores({}); setSelectedStudentIds(new Set()); setPasteData(''); setSearchTerm(''); }, [selectedClass, mode]);
    useEffect(() => { if (classes && classes.length > 0 && !selectedClass) setSelectedClass(classes[0].id) }, [classes]);

    const handleModeSelect = (selectedMode: InputMode) => { setMode(selectedMode); setStep(2); };
    const handleBack = () => { setStep(1); setSelectedClass(classes?.[0]?.id || ''); };

    const handleAiParse = async () => {
        if (!pasteData.trim() || !students || students.length === 0) {
            toast.warning("Harap masukkan data untuk diproses dan pilih kelas.");
            return;
        }
        setIsParsing(true); toast.info("AI sedang memproses data Anda...");
        
        try {
            const studentNames = students.map(s => s.name);
            const systemInstruction = `Anda adalah asisten pemrosesan data. Baca teks yang berisi nama siswa dan nilai. Cocokkan nama dengan daftar siswa yang diberikan. Hasilnya harus berupa array JSON dari objek, di mana setiap objek berisi 'matched_name', 'score' numerik, dan 'original_line' dari input. Abaikan baris yang tidak dapat Anda cocokkan dengan nama siswa.`;
            const prompt = `Daftar Siswa: ${JSON.stringify(studentNames)}\n\nTeks Data Nilai:\n"""\n${pasteData}\n"""\n\nProses teks di atas dan kembalikan array JSON.`;
            
            const responseSchema = {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        matched_name: { type: Type.STRING },
                        score: { type: Type.NUMBER },
                        original_line: { type: Type.STRING }
                    },
                    required: ["matched_name", "score", "original_line"]
                }
            };

            const response = await ai.models.generateContent({ 
                model: 'gemini-2.5-flash', 
                contents: prompt, 
                config: { systemInstruction, responseMimeType: "application/json", responseSchema } 
            });
            
            const parsedScores: { matched_name: string; score: number; original_line: string }[] = JSON.parse(response.text);
            const studentMapByName = new Map(students.map(s => [s.name, s.id]));
            
            const reviewList: ReviewDataItem[] = [];
            parsedScores.forEach(item => {
                const studentId = studentMapByName.get(item.matched_name);
                if (studentId) {
                    reviewList.push({ studentId, studentName: item.matched_name, score: String(item.score), originalLine: item.original_line });
                }
            });

            if (reviewList.length === 0) {
                toast.warning("AI tidak dapat menemukan siswa yang cocok dari data yang Anda berikan.");
            } else {
                setReviewData(reviewList);
            }
            
        } catch (error) {
            console.error(error);
            toast.error("Gagal memproses data dengan AI. Pastikan format data Anda benar.");
        } finally {
            setIsParsing(false);
        }
    };
    
    const selectedViolation = useMemo(() => violationList.find(v => v.code === selectedViolationCode) || null, [selectedViolationCode]);
    const handleSelectAllStudents = (checked: boolean) => setSelectedStudentIds(new Set(checked ? filteredStudents?.map(s => s.id) : []));
    const handleStudentSelect = (studentId: string) => setSelectedStudentIds(prev => { const newSet = new Set(prev); newSet.has(studentId) ? newSet.delete(studentId) : newSet.add(studentId); return newSet; });
    const isAllSelected = filteredStudents ? selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0 : false;
    
    // Mutations
    const saveQuizScoresMutation = useMutation({
        mutationFn: async (records: Database['public']['Tables']['quiz_points']['Insert'][]) => { const { error } = await supabase.from('quiz_points').insert(records as any); if (error) throw error; },
        onSuccess: () => { toast.success("Poin keaktifan berhasil disimpan!"); setSelectedStudentIds(new Set()); },
        onError: (error: Error) => toast.error(`Gagal: ${error.message}`),
    });
    const saveSubjectGradesMutation = useMutation({
        mutationFn: async (records: Database['public']['Tables']['academic_records']['Insert'][]) => { const { error } = await supabase.from('academic_records').insert(records as any); if (error) throw error; },
        onSuccess: () => { toast.success("Nilai mata pelajaran berhasil disimpan!"); setScores({}); queryClient.invalidateQueries({ queryKey: ['studentDetails'] }); },
        onError: (error: Error) => toast.error(`Gagal: ${error.message}`),
    });
    const saveViolationsMutation = useMutation({
        mutationFn: async (records: Database['public']['Tables']['violations']['Insert'][]) => { const { error } = await supabase.from('violations').insert(records as any); if (error) throw error; },
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
            if (records.length === 0) { toast.warning("Tidak ada nilai yang diisi."); return; }
            saveSubjectGradesMutation.mutate(records);
        } else if (mode === 'violation') {
            if (!selectedViolation) { toast.warning("Harap pilih jenis pelanggaran."); return; }
            if (selectedStudentIds.size === 0) { toast.warning("Pilih minimal satu siswa."); return; }
            const records = Array.from(selectedStudentIds).map(studentId => ({ student_id: studentId, user_id: user.id, date: violationDate, description: selectedViolation.description, points: selectedViolation.points }));
            saveViolationsMutation.mutate(records);
        }
    };
    const gradedCount = useMemo(() => {
        if (!students) return 0;
        return students.filter(student => scores[student.id]?.trim()).length;
    }, [scores, students]);

    const isSubmitting = saveQuizScoresMutation.isPending || saveSubjectGradesMutation.isPending || saveViolationsMutation.isPending;
    
    const handlePrintBulkReports = async () => {
        // This function is complex and would be implemented here, similar to the one in ReportPage but in a loop.
        // For brevity, we'll just show the state management.
        toast.info("Fitur ini sedang dalam pengembangan.");
    };

    const handleConfirmReview = (reviewedScores: Record<string, string>) => {
        setScores(prev => ({ ...prev, ...reviewedScores }));
        setReviewData(null);
        toast.success(`${Object.keys(reviewedScores).length} nilai telah diterapkan. Anda dapat menyimpan sekarang.`);
    };

    return (
        <div className="w-full min-h-full p-4 sm:p-6 md:p-8 relative text-white flex flex-col items-center justify-center">
             <div className="holographic-orb-container" style={{ top: '-40px', left: '10%', width: '120px', height: '120px', opacity: 0.7 }}>
                <div className="holographic-orb"><div className="orb-glow"></div><div className="orb-core"></div><div className="orb-ring orb-ring-1"></div><div className="orb-ring orb-ring-2"></div></div>
            </div>
             <div className="holographic-orb-container" style={{ top: '50%', right: '5%', width: '150px', height: '150px', opacity: 0.5, animationDelay: '2s' }}>
                <div className="holographic-orb"><div className="orb-glow"></div><div className="orb-core"></div><div className="orb-ring orb-ring-1"></div><div className="orb-ring orb-ring-2"></div></div>
            </div>

            <main className="relative z-10 w-full max-w-6xl">
                {step === 1 ? (
                    <Step1_ModeSelection handleModeSelect={handleModeSelect} />
                ) : (
                    <Step2_ConfigurationAndInput 
                        mode={mode}
                        handleBack={handleBack}
                        classes={classes}
                        selectedClass={selectedClass}
                        setSelectedClass={setSelectedClass}
                        isLoadingClasses={isLoadingClasses}
                        quizInfo={quizInfo}
                        setQuizInfo={setQuizInfo}
                        subjectGradeInfo={subjectGradeInfo}
                        setSubjectGradeInfo={setSubjectGradeInfo}
                        scores={scores}
                        setScores={setScores}
                        pasteData={pasteData}
                        setPasteData={setPasteData}
                        handleAiParse={handleAiParse}
                        isParsing={isParsing}
                        selectedViolationCode={selectedViolationCode}
                        setSelectedViolationCode={setSelectedViolationCode}
                        violationDate={violationDate}
                        setViolationDate={setViolationDate}
                        selectedViolation={selectedViolation}
                        students={filteredStudents}
                        isLoadingStudents={isLoadingStudents}
                        selectedStudentIds={selectedStudentIds}
                        handleSelectAllStudents={handleSelectAllStudents}
                        handleStudentSelect={handleStudentSelect}
                        isAllSelected={isAllSelected}
                        isExporting={isExporting}
                        exportProgress={exportProgress}
                        handlePrintBulkReports={handlePrintBulkReports}
                        handleSubmit={handleSubmit}
                        isSubmitting={isSubmitting}
                        isOnline={isOnline}
                        gradedCount={gradedCount}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                    />
                )}
            </main>

            {reviewData && (
                <ReviewModal
                    data={reviewData}
                    onConfirm={handleConfirmReview}
                    onCancel={() => setReviewData(null)}
                />
            )}
        </div>
    );
};

const ReviewModal: React.FC<{ data: ReviewDataItem[], onConfirm: (scores: Record<string, string>) => void, onCancel: () => void }> = ({ data, onConfirm, onCancel }) => {
    const [editedScores, setEditedScores] = useState<Record<string, string>>(() => {
        return data.reduce((acc, item) => {
            acc[item.studentId] = item.score;
            return acc;
        }, {} as Record<string, string>);
    });

    const handleScoreChange = (studentId: string, score: string) => {
        setEditedScores(prev => ({ ...prev, [studentId]: score }));
    };

    const handleConfirm = () => {
        onConfirm(editedScores);
    };
    
    return (
        <Modal title="Tinjau Hasil AI" isOpen={true} onClose={onCancel} icon={<PencilIcon />}>
            <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">AI telah memproses data Anda. Silakan tinjau dan perbaiki nilai jika perlu sebelum menerapkannya.</p>
                <div className="max-h-80 overflow-y-auto pr-2 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg">
                    <table className="w-full text-sm">
                        <thead className="text-left text-gray-500 dark:text-gray-400">
                            <tr>
                                <th className="p-2">Siswa & Data Asli</th>
                                <th className="p-2 w-28 text-center">Nilai</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map(item => {
                                const scoreNum = Number(editedScores[item.studentId]);
                                const isInvalidScore = scoreNum < 0 || scoreNum > 100;
                                return (
                                    <tr key={item.studentId} className="border-t border-gray-200 dark:border-gray-700">
                                        <td className="p-2">
                                            <p className="font-medium text-gray-800 dark:text-gray-200">{item.studentName}</p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate">"{item.originalLine}"</p>
                                        </td>
                                        <td className="p-2">
                                            <Input 
                                                type="number" 
                                                min="0" 
                                                max="100" 
                                                value={editedScores[item.studentId] || ''} 
                                                onChange={(e) => handleScoreChange(item.studentId, e.target.value)}
                                                className={isInvalidScore ? 'border-red-500 ring-2 ring-red-500/50' : ''}
                                            />
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                 <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Batal</Button>
                    <Button type="button" onClick={handleConfirm}>Terapkan Nilai</Button>
                </div>
            </div>
        </Modal>
    )
};


export default MassInputPage;