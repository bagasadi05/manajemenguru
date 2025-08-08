
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
import { ClipboardPenIcon, GraduationCapIcon } from '../Icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { violationList } from '../../services/violations.data';

type ClassRow = Database['public']['Tables']['classes']['Row'];
type StudentRow = Database['public']['Tables']['students']['Row'];
type InputMode = 'quiz' | 'subject_grade' | 'violation';

const MassInputPage: React.FC = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const toast = useToast();
    const isOnline = useOfflineStatus();

    const [mode, setMode] = useState<InputMode>('quiz');
    const [selectedClass, setSelectedClass] = useState<string>('');
    
    // State for Quiz Grade mode (now Activity Points)
    const [quizInfo, setQuizInfo] = useState({
        name: '',
        subject: '',
        date: new Date().toISOString().slice(0, 10),
    });
    
    // State for Subject Grade mode
    const [subjectGradeInfo, setSubjectGradeInfo] = useState({
        subject: '',
        notes: '',
    });

    // Shared state for student scores (for subject grades)
    const [scores, setScores] = useState<Record<string, string>>({});

    // State for Violation & Activity mode
    const [selectedViolationCode, setSelectedViolationCode] = useState<string>('');
    const [violationDate, setViolationDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

    const { data: classes, isLoading: isLoadingClasses } = useQuery({
        queryKey: ['classes', user?.id],
        queryFn: async (): Promise<ClassRow[]> => {
            const { data, error } = await supabase.from('classes').select('*').eq('user_id', user!.id);
            if (error) throw error;
            return data || [];
        },
        enabled: !!user,
    });
    
    const { data: students, isLoading: isLoadingStudents } = useQuery({
        queryKey: ['studentsOfClass', selectedClass],
        queryFn: async (): Promise<StudentRow[]> => {
            if (!selectedClass) return [];
            const { data, error } = await supabase.from('students').select('*').eq('class_id', selectedClass).order('name');
            if (error) throw error;
            return data || [];
        },
        enabled: !!selectedClass,
    });
    
    useEffect(() => {
        // Reset inputs when class or mode changes
        setScores({});
        setSelectedStudentIds(new Set());
    }, [selectedClass, mode]);

    // Handlers for Activity Points mode
    const handleQuizInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setQuizInfo(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    // Handlers for Subject Grade mode
    const handleSubjectGradeInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSubjectGradeInfo(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    // Shared handlers
    const handleScoreChange = (studentId: string, value: string) => {
        setScores(prev => ({ ...prev, [studentId]: value }));
    };
    const handleSetAllScores = (value: string) => {
        if (!students) return;
        const newScores: Record<string, string> = {};
        students.forEach(student => {
            newScores[student.id] = value;
        });
        setScores(newScores);
    };

    // Violation & Activity handlers
    const selectedViolation = useMemo(() => {
        if (!selectedViolationCode) return null;
        return violationList.find(v => v.code === selectedViolationCode) || null;
    }, [selectedViolationCode]);
    const handleSelectAllStudents = (checked: boolean) => {
        if (!students) return;
        setSelectedStudentIds(new Set(checked ? students.map(s => s.id) : []));
    };
    const handleStudentSelect = (studentId: string) => {
        setSelectedStudentIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(studentId)) newSet.delete(studentId);
            else newSet.add(studentId);
            return newSet;
        });
    };

    // Mutations
    const saveQuizScoresMutation = useMutation({
        mutationFn: async (records: Database['public']['Tables']['quiz_points']['Insert'][]) => {
            const { error } = await supabase.from('quiz_points').insert(records);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Semua poin keaktifan berhasil disimpan!");
            setSelectedStudentIds(new Set());
        },
        onError: (error: Error) => toast.error(`Gagal menyimpan poin: ${error.message}`),
    });

    const saveSubjectGradesMutation = useMutation({
        mutationFn: async (records: Database['public']['Tables']['academic_records']['Insert'][]) => {
            const { error } = await supabase.from('academic_records').insert(records);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Semua nilai mata pelajaran berhasil disimpan!");
            setScores({});
            queryClient.invalidateQueries({ queryKey: ['studentDetails'] });
        },
        onError: (error: Error) => toast.error(`Gagal menyimpan nilai mata pelajaran: ${error.message}`),
    });

    const saveViolationsMutation = useMutation({
        mutationFn: async (records: Database['public']['Tables']['violations']['Insert'][]) => {
            const { error } = await supabase.from('violations').insert(records);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Catatan pelanggaran berhasil disimpan!");
            setSelectedStudentIds(new Set());
            queryClient.invalidateQueries({ queryKey: ['studentDetails'] });
        },
        onError: (error: Error) => toast.error(`Gagal menyimpan: ${error.message}`),
    });
    
    // Main submit handler
    const handleSubmit = () => {
        if (!user || !students) return;
        if (mode === 'quiz') {
            if (!quizInfo.name || !quizInfo.subject) {
                toast.warning("Harap isi Nama Aktivitas dan Mata Pelajaran.");
                return;
            }
            if (selectedStudentIds.size === 0) {
                toast.warning("Pilih minimal satu siswa.");
                return;
            }
            const recordsToInsert = Array.from(selectedStudentIds).map(studentId => ({
                student_id: studentId,
                user_id: user.id,
                quiz_name: quizInfo.name,
                subject: quizInfo.subject,
                points: 1,
                max_points: 1,
                quiz_date: quizInfo.date,
            }));
            saveQuizScoresMutation.mutate(recordsToInsert);
        } else if (mode === 'subject_grade') {
             if (!subjectGradeInfo.subject) {
                toast.warning("Harap isi Mata Pelajaran.");
                return;
            }
            const recordsToInsert = students
                .filter(student => scores[student.id] && scores[student.id].trim() !== '')
                .map(student => ({
                    student_id: student.id, user_id: user.id,
                    subject: subjectGradeInfo.subject,
                    score: Number(scores[student.id]),
                    notes: subjectGradeInfo.notes || 'Nilai sumatif dari input massal.',
                }));
            if (recordsToInsert.length === 0) { toast.warning("Tidak ada nilai untuk disimpan."); return; }
            saveSubjectGradesMutation.mutate(recordsToInsert);
        } else { // mode === 'violation'
            if (!selectedViolation) { toast.warning("Pastikan jenis pelanggaran sudah dipilih."); return; }
            if (selectedStudentIds.size === 0) { toast.warning("Pilih minimal satu siswa."); return; }
            const recordsToInsert = Array.from(selectedStudentIds).map(studentId => ({
                student_id: studentId, user_id: user.id, date: violationDate,
                description: selectedViolation.description, points: selectedViolation.points,
            }));
            saveViolationsMutation.mutate(recordsToInsert);
        }
    };
    
    const isSubmitting = saveQuizScoresMutation.isPending || saveSubjectGradesMutation.isPending || saveViolationsMutation.isPending;
    const gradedCount = Object.values(scores).filter(s => s && s.trim() !== '').length;
    const isAllSelected = students ? selectedStudentIds.size === students.length && students.length > 0 : false;
    const pageTitleDescription = {
        quiz: "Beri poin untuk siswa yang aktif di kelas (contoh: menjawab pertanyaan).",
        subject_grade: "Masukkan nilai sumatif/akhir mata pelajaran untuk satu kelas.",
        violation: "Catat poin pelanggaran untuk beberapa siswa sekaligus."
    };

    return (
        <div className="space-y-6">
            <header className="flex items-center gap-4">
                 <div className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                    <ClipboardPenIcon className="w-7 h-7" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Input Massal</h1>
                    <p className="mt-1 text-gray-500 dark:text-gray-400">{pageTitleDescription[mode]}</p>
                </div>
            </header>

            <Tabs defaultValue="quiz" onValueChange={(value) => setMode(value as InputMode)} className="w-full">
                <div className="flex justify-center">
                    <TabsList>
                        <TabsTrigger value="quiz">Poin Keaktifan</TabsTrigger>
                        <TabsTrigger value="subject_grade">Nilai Mapel</TabsTrigger>
                        <TabsTrigger value="violation">Input Pelanggaran</TabsTrigger>
                    </TabsList>
                </div>

                <div className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Tahap 1: Pengaturan</CardTitle>
                            <CardDescription>Pilih kelas dan isi detail untuk {mode === 'violation' ? 'pelanggaran' : (mode === 'quiz' ? 'poin keaktifan' : 'penilaian')}.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="mb-6">
                                <label htmlFor="class-select" className="block text-sm font-medium mb-1">Pilih Kelas</label>
                                <Select id="class-select" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} disabled={isLoadingClasses}>
                                    <option value="" disabled>-- Pilih Kelas --</option>
                                    {classes?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </Select>
                            </div>
                            <TabsContent value="quiz" className="animate-fade-in -m-6 p-0 data-[state=inactive]:hidden">
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div><label htmlFor="quiz_name" className="block text-sm font-medium mb-1">Nama Aktivitas</label><Input id="quiz_name" name="name" value={quizInfo.name} onChange={handleQuizInfoChange} placeholder="cth. Menjawab Pertanyaan" /></div>
                                    <div><label htmlFor="subject" className="block text-sm font-medium mb-1">Mata Pelajaran</label><Input id="subject" name="subject" value={quizInfo.subject} onChange={handleQuizInfoChange} placeholder="cth. Matematika" /></div>
                                    <div><label htmlFor="date" className="block text-sm font-medium mb-1">Tanggal</label><Input id="date" name="date" type="date" value={quizInfo.date} onChange={handleQuizInfoChange} /></div>
                                </div>
                            </TabsContent>
                             <TabsContent value="subject_grade" className="animate-fade-in -m-6 p-0 data-[state=inactive]:hidden">
                                 <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div><label htmlFor="subject-grade-subject" className="block text-sm font-medium mb-1">Mata Pelajaran</label><Input id="subject-grade-subject" name="subject" value={subjectGradeInfo.subject} onChange={handleSubjectGradeInfoChange} placeholder="cth. Bahasa Indonesia" /></div>
                                    <div><label htmlFor="subject-grade-notes" className="block text-sm font-medium mb-1">Catatan (Opsional)</label><Input id="subject-grade-notes" name="notes" value={subjectGradeInfo.notes} onChange={handleSubjectGradeInfoChange} placeholder="cth. Penilaian Akhir Semester" /></div>
                                </div>
                            </TabsContent>
                             <TabsContent value="violation" className="animate-fade-in -m-6 p-0 data-[state=inactive]:hidden">
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="violation-code" className="block text-sm font-medium mb-1">Jenis Pelanggaran</label>
                                        <Select id="violation-code" name="violation_code" value={selectedViolationCode} onChange={(e) => setSelectedViolationCode(e.target.value)}>
                                            <option value="" disabled>-- Pilih Pelanggaran --</option>
                                            {['Ringan', 'Sedang', 'Berat'].map(category => (
                                                <optgroup key={category} label={`Pelanggaran ${category}`}>
                                                    {violationList.filter(v => v.category === category).map(v => (
                                                        <option key={v.code} value={v.code}>{v.description}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </Select>
                                        {selectedViolation && <p className="text-xs text-red-500 mt-1">Poin: {selectedViolation.points}</p>}
                                    </div>
                                     <div>
                                        <label htmlFor="violation-date" className="block text-sm font-medium mb-1">Tanggal</label>
                                        <Input id="violation-date" name="date" type="date" value={violationDate} onChange={e => setViolationDate(e.target.value)} />
                                    </div>
                                </div>
                            </TabsContent>
                        </CardContent>
                    </Card>
                </div>
            </Tabs>

            <Card>
                <CardHeader>
                    <CardTitle>Tahap 2: Input Data</CardTitle>
                    <CardDescription>Pilih siswa di bawah dan masukkan nilai atau tandai sesuai mode yang dipilih.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingStudents && <div className="text-center p-8">Memuat data siswa...</div>}
                    {!selectedClass && <div className="text-center p-8 text-gray-500"><GraduationCapIcon className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600"/>Silakan pilih kelas terlebih dahulu.</div>}
                    {students && students.length === 0 && selectedClass && <div className="text-center p-8 text-gray-500">Tidak ada siswa di kelas ini.</div>}
                    {students && students.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                    <tr>
                                        <th scope="col" className="p-4">
                                            {mode !== 'subject_grade' && (
                                                <Checkbox checked={isAllSelected} onChange={(e) => handleSelectAllStudents(e.target.checked)} aria-label="Pilih semua siswa" />
                                            )}
                                        </th>
                                        <th scope="col" className="px-6 py-3">Nama Siswa</th>
                                        <th scope="col" className="px-6 py-3">{mode === 'subject_grade' ? 'Nilai (0-100)' : 'Pilih'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map(student => (
                                        <tr key={student.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                            <td className="w-4 p-4">
                                                 {mode !== 'subject_grade' && (
                                                    <Checkbox checked={selectedStudentIds.has(student.id)} onChange={() => handleStudentSelect(student.id)} />
                                                 )}
                                            </td>
                                            <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white flex items-center gap-3">
                                                <img src={student.avatar_url} alt={student.name} className="w-8 h-8 rounded-full object-cover" />
                                                {student.name}
                                            </th>
                                            <td className="px-6 py-4">
                                                {mode === 'subject_grade' ? (
                                                    <Input type="number" min="0" max="100" value={scores[student.id] || ''} onChange={(e) => handleScoreChange(student.id, e.target.value)} className="w-24" />
                                                ) : (
                                                    <Checkbox checked={selectedStudentIds.has(student.id)} onChange={() => handleStudentSelect(student.id)} />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
                {students && students.length > 0 && (
                    <CardFooter className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        {mode === 'subject_grade' ? (
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleSetAllScores('100')}>Set Semua 100</Button>
                                <Button variant="outline" size="sm" onClick={() => handleSetAllScores('0')}>Set Semua 0</Button>
                                <span className="text-sm text-gray-500 ml-2">{gradedCount} / {students.length} siswa dinilai</span>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500">{selectedStudentIds.size} / {students.length} siswa dipilih</div>
                        )}
                        <Button onClick={handleSubmit} disabled={isSubmitting || !isOnline}>
                            {isSubmitting ? 'Menyimpan...' : 'Simpan Semua'}
                        </Button>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
};

export default MassInputPage;
