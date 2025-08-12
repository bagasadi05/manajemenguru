import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { useStudentData } from '@/hooks/useStudentData';
import { useStudentMutations } from '@/hooks/useStudentMutations';
import { optimizeImage } from '@/components/utils/image';
import { generateStudentSummary } from '@/services/aiService';
import { supabase } from '@/services/supabase';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { ArrowLeftIcon, CheckCircleIcon, XCircleIcon, FileTextIcon, BarChartIcon, PencilIcon, SparklesIcon, ClockIcon, BrainCircuitIcon, ShieldAlertIcon, CameraIcon, TrendingUpIcon } from '@/components/Icons';
import LoadingSpinner from '@/components/LoadingSpinner';

import { StatCard } from '@/components/features/student-detail/StatCard';
import { AiSummarySkeleton } from '@/components/features/student-detail/AiSummarySkeleton';
import { AiSummaryDisplay } from '@/components/features/student-detail/AiSummaryDisplay';
import { BehaviorAnalysisTab } from '@/components/features/student-detail/BehaviorAnalysisTab';
import { GradesHistory } from '@/components/features/student-detail/GradesHistory';
import { RadarChart } from '@/components/features/student-detail/RadarChart';
import { ActivityPointsHistory } from '@/components/features/student-detail/ActivityPointsHistory';
import { StackedProgressBar } from '@/components/features/student-detail/StackedProgressBar';
import { ReportTimeline } from '@/components/features/student-detail/ReportTimeline';
import { ViolationHistory } from '@/components/features/student-detail/ViolationHistory';
import { StudentDetailModals } from '@/components/features/student-detail/StudentDetailModals';
import { ModalState, AiSummary } from '@/components/features/student-detail/types';
import { AttendanceStatus } from '@/types';

const StudentDetailPage: React.FC = () => {
    const { studentId } = useParams<{ studentId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const toast = useToast();
    const isOnline = useOfflineStatus();
    
    const { data: pageData, isLoading, isError, error: queryError, client: queryClient } = useStudentData(studentId);
    const { student, reports = [], attendanceRecords = [], academicRecords = [], quizPoints = [], violations = [], classAcademicRecords = [], classes = [] } = pageData || {};

    const {
        deleteStudentMutation, deleteReportMutation, deleteAcademicMutation,
        deleteQuizPointMutation, deleteViolationMutation, updateAvatarMutation
    } = useStudentMutations(studentId, user);

    const [modalState, setModalState] = useState<ModalState>({ type: 'closed' });
    const [aiSummaryState, setAiSummaryState] = useState<{ loading: boolean, error: string | null, content: AiSummary | null }>({ loading: false, error: null, content: null });
    const [isEditingAiSummary, setIsEditingAiSummary] = useState(false);
    const [editableAiSummary, setEditableAiSummary] = useState<AiSummary | null>(null);
    const avatarFileInputRef = useRef<HTMLInputElement>(null);

    const handleGenerateSummary = async () => {
        if (!pageData) return;
        setAiSummaryState({ loading: true, error: null, content: null });
        setIsEditingAiSummary(false);
        try {
            const summaryContent = await generateStudentSummary(pageData);
            setAiSummaryState({ loading: false, error: null, content: summaryContent });
            setEditableAiSummary(summaryContent);
        } catch (error: any) {
            const errorMessage = "Gagal menghasilkan analisis. Silakan coba lagi.";
            setAiSummaryState({ loading: false, error: errorMessage, content: null });
            toast.error(errorMessage);
        }
    };

    useEffect(() => {
        if (isError) {
            toast.error((queryError as Error).message);
            navigate('/siswa', { replace: true });
        } else if (pageData && !aiSummaryState.content && !aiSummaryState.loading && !aiSummaryState.error && isOnline) {
            handleGenerateSummary();
        }
    }, [isError, queryError, toast, navigate, pageData, isOnline]);

    const handleAvatarUpload = async (file: File) => {
        if (!user || !student) return;

        try {
            updateAvatarMutation.mutate(URL.createObjectURL(file)); // Optimistic update
            const optimizedBlob = await optimizeImage(file, { maxWidth: 300, quality: 0.8 });
            const optimizedFile = new File([optimizedBlob], `${user.id}-student-${student.id}.jpg`, { type: 'image/jpeg' });

            const filePath = `${user.id}/student_avatars/${student.id}-${Date.now()}.jpg`;
            const { error: uploadError } = await supabase.storage.from('teacher_assets').upload(filePath, optimizedFile, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('teacher_assets').getPublicUrl(filePath);
            const cacheBustedUrl = `${publicUrl}?t=${new Date().getTime()}`;
            updateAvatarMutation.mutate(cacheBustedUrl);
        } catch(err: any) {
             toast.error(`Gagal mengunggah foto: ${err.message}`);
             if (queryClient) {
                queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
             }
        }
    };

    const attendanceSummary = useMemo(() => attendanceRecords.reduce((acc, record) => { acc[record.status] = (acc[record.status] || 0) + 1; return acc; }, {} as Record<AttendanceStatus, number>), [attendanceRecords]);
    const totalAttendanceDays = attendanceRecords.length;
    const presentDays = attendanceSummary.Hadir || 0;
    const attendancePercentage = totalAttendanceDays > 0 ? ((presentDays / totalAttendanceDays) * 100).toFixed(0) : '100';
    const totalAlphaDays = attendanceSummary.Alpha || 0;
    const totalViolationPoints = useMemo(() => violations.reduce((sum, v) => sum + v.points, 0), [violations]);
    const averageScore = useMemo(() => { if (academicRecords.length === 0) return 0; const totalScore = academicRecords.reduce((sum, record) => sum + record.score, 0); return Math.round(totalScore / academicRecords.length); }, [academicRecords]);

    const timelineItems = useMemo(() => {
        if (!pageData) return [];
        return [
            ...reports.map(item => ({ date: new Date(item.date), type: 'report', item, icon: FileTextIcon, color: 'blue' })),
            ...academicRecords.map(item => ({ date: new Date(item.created_at), type: 'academic', item, icon: BarChartIcon, color: 'green' })),
            ...quizPoints.map(item => ({ date: new Date(item.quiz_date), type: 'quiz', item, icon: CheckCircleIcon, color: 'indigo'})),
            ...violations.map(item => ({ date: new Date(item.date), type: 'violation', item, icon: ShieldAlertIcon, color: 'orange' })),
            ...attendanceRecords.filter(item => item.status !== 'Hadir').map(item => ({ date: new Date(item.date), type: 'attendance', item, icon: ClockIcon, color: 'yellow' })),
        ].sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [pageData]);
    
    if (isLoading) return <LoadingSpinner fullScreen />;
    if (isError || !student) return <div className="text-center py-10">Siswa tidak ditemukan atau terjadi kesalahan.</div>;

    const studentClass = student.classes as { id: string; name: string } | null;

    const renderTimelineItem = (timelineItem: any) => {
        const { type, item, icon: Icon, color } = timelineItem;
        let title = '', content: React.ReactNode = null;

        switch (type) {
            case 'report': title = item.title; content = <p className="text-sm text-gray-700 dark:text-gray-300">{item.notes}</p>; break;
            case 'academic': title = `Nilai Mapel ${item.subject}: ${item.score}`; content = <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{item.notes}"</p>; break;
            case 'quiz': title = `Poin Keaktifan: ${item.quiz_name}`; content = <p className="text-sm text-gray-500 dark:text-gray-400">Mapel: {item.subject} (+1 Poin)</p>; break;
            case 'violation': title = `${item.points} Poin Pelanggaran`; content = <p className="text-sm text-gray-700 dark:text-gray-300">{item.description}</p>; break;
            case 'attendance': title = `Absensi: ${item.status}`; content = <p className="text-sm text-gray-500 dark:text-gray-400">Siswa ditandai sebagai {item.status.toLowerCase()} pada hari ini.</p>; break;
        }

        return (
            <div className="relative mb-8 group">
                <div className={`absolute left-0 top-1.5 w-6 h-6 bg-white dark:bg-gray-950 rounded-full border-4 border-${color}-500 flex items-center justify-center`}><Icon className={`w-3 h-3 text-${color}-500`} /></div>
                <div className="ml-10 p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/50 dark:border-gray-700/50 shadow-md"><h4 className="font-bold text-gray-900 dark:text-gray-100">{title}</h4><span className="text-xs text-gray-500 dark:text-gray-400">{new Date(item.date || item.created_at || item.quiz_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span><div className="mt-2">{content}</div></div>
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="flex-shrink-0" aria-label="Kembali"><ArrowLeftIcon className="h-5 w-5" /></Button>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <img src={student.avatar_url} alt={student.name} className="w-16 h-16 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-md" />
                            <input type="file" ref={avatarFileInputRef} onChange={(e) => e.target.files && handleAvatarUpload(e.target.files[0])} accept="image/png, image/jpeg" className="hidden" disabled={updateAvatarMutation.isPending}/>
                            <button type="button" onClick={() => avatarFileInputRef.current?.click()} disabled={updateAvatarMutation.isPending || !isOnline} className="absolute -bottom-1 -right-1 p-1.5 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full shadow-md hover:scale-110 transition-transform" aria-label="Ubah foto profil">
                                {updateAvatarMutation.isPending ? <LoadingSpinner sizeClass="w-4 h-4" /> : <CameraIcon className="w-4 h-4" />}
                            </button>
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight">{student.name}</h2>
                            <p className="text-lg text-gray-500">{studentClass?.name || 'Tanpa Kelas'}</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-start md:justify-end gap-2 w-full md:w-auto">
                    <Button size="sm" variant="outline" onClick={() => setModalState({type: 'editStudent'})} disabled={!isOnline}><PencilIcon className="h-4 w-4 mr-2" />Edit</Button>
                    <Button size="sm" variant="default" onClick={() => navigate(`/cetak-rapot/${studentId}`)}><FileTextIcon className="h-4 w-4 mr-2" />Cetak Rapor</Button>
                </div>
            </div>
            
            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard icon={CheckCircleIcon} label="Kehadiran" value={`${attendancePercentage}%`} color="from-green-500 to-emerald-400" />
                <StatCard icon={BarChartIcon} label="Rata-rata Nilai" value={averageScore} color="from-sky-500 to-blue-400" />
                <StatCard icon={FileTextIcon} label="Total Laporan" value={reports.length} color="from-amber-500 to-yellow-400" />
                <StatCard icon={XCircleIcon} label="Total Alpha" value={totalAlphaDays} color="from-red-500 to-rose-400" />
                <StatCard icon={ShieldAlertIcon} label="Poin Pelanggaran" value={totalViolationPoints} color="from-orange-500 to-red-400" />
            </div>

            {/* Tabs */}
            <Tabs defaultValue="ringkasan">
                <div className="flex justify-center mb-6"><TabsList className="bg-gray-100 dark:bg-gray-800/60 border-none rounded-full"><TabsTrigger value="ringkasan" className="gap-2"><SparklesIcon/>Ringkasan AI</TabsTrigger><TabsTrigger value="linimasa" className="gap-2"><ClockIcon/>Linimasa</TabsTrigger><TabsTrigger value="perilaku" className="gap-2"><BrainCircuitIcon/>Analisis Perilaku</TabsTrigger><TabsTrigger value="akademik" className="gap-2"><BarChartIcon/>Akademik</TabsTrigger><TabsTrigger value="kehadiran-catatan" className="gap-2"><PencilIcon/>Kehadiran & Catatan</TabsTrigger><TabsTrigger value="pelanggaran" className="gap-2"><ShieldAlertIcon/>Pelanggaran</TabsTrigger></TabsList></div>
                
                <TabsContent value="ringkasan">
                    <Card><CardHeader><CardTitle className="flex items-center gap-2"><SparklesIcon className="w-6 h-6 text-purple-500" />Analisis & Rekomendasi AI</CardTitle><CardDescription>Ringkasan komprehensif dari semua data siswa.</CardDescription></CardHeader><CardContent>
                        {aiSummaryState.loading && <AiSummarySkeleton />}
                        {aiSummaryState.error && <div className="text-center text-red-500 p-4">{aiSummaryState.error}</div>}
                        {aiSummaryState.content && ( isEditingAiSummary && editableAiSummary ? (
                            <form onSubmit={(e) => { e.preventDefault(); /* handleSaveAiSummary(); */ }} className="space-y-4">
                                {/* Edit form here */}
                                <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => setIsEditingAiSummary(false)}>Batal</Button><Button type="submit">Simpan</Button></div>
                            </form>
                        ) : (
                            <div>
                                <AiSummaryDisplay summary={aiSummaryState.content} />
                                <div className="flex gap-2 mt-6"><Button onClick={() => setIsEditingAiSummary(true)} variant="outline" size="sm" disabled={!isOnline}><PencilIcon className="w-4 h-4 mr-2"/>Edit</Button><Button onClick={handleGenerateSummary} disabled={aiSummaryState.loading || !isOnline} variant="outline" size="sm">{aiSummaryState.loading ? 'Memuat...' : 'Buat Ulang'}</Button></div>
                            </div>
                        ))}
                    </CardContent></Card>
                </TabsContent>
                
                <TabsContent value="perilaku"><BehaviorAnalysisTab studentName={student.name} attendance={attendanceRecords} violations={violations} /></TabsContent>

                <TabsContent value="linimasa"><Card><CardHeader><CardTitle>Linimasa Perjalanan Siswa</CardTitle><CardDescription>Ringkasan kronologis semua peristiwa penting.</CardDescription></CardHeader><CardContent>
                    {timelineItems.length > 0 ? (<div className="relative pl-4"><div className="absolute left-0 top-2 h-full w-0.5 bg-gray-200 dark:bg-gray-700 ml-3"></div>{timelineItems.map((item, index) => <div key={`${item.type}-${item.item.id}-${index}`}>{renderTimelineItem(item)}</div>)}</div>) : (<div className="text-center py-16 text-gray-500"><ClockIcon className="w-16 h-16 mx-auto mb-4" /><h4 className="text-lg">Linimasa Kosong</h4></div>)}
                </CardContent></Card></TabsContent>

                <TabsContent value="akademik" className="space-y-6">
                    <Card><CardHeader><div className="flex justify-between items-center"><CardTitle>Nilai Mata Pelajaran</CardTitle><Button size="sm" onClick={() => setModalState({ type: 'academic', data: null })} disabled={!isOnline}><PencilIcon className="h-4 w-4 mr-2" />Tambah</Button></div><CardDescription>Performa siswa dalam mata pelajaran.</CardDescription></CardHeader><CardContent><GradesHistory records={academicRecords} onEdit={(r) => setModalState({ type: 'academic', data: r })} onDelete={(id) => setModalState({type: 'confirmDelete', title: 'Hapus Nilai', message: 'Yakin hapus nilai ini?', onConfirm: () => deleteAcademicMutation.mutate(id), isPending: deleteAcademicMutation.isPending})} isOnline={isOnline}/></CardContent></Card>
                    <Card><CardHeader><CardTitle>Analisis Perbandingan Nilai</CardTitle><CardDescription>Perbandingan nilai siswa dengan rata-rata kelas.</CardDescription></CardHeader><CardContent><RadarChart studentRecords={academicRecords} classRecords={classAcademicRecords} /></CardContent></Card>
                    <Card><CardHeader><div className="flex justify-between items-center"><CardTitle>Poin Keaktifan</CardTitle><Button size="sm" onClick={() => setModalState({ type: 'quiz', data: null })} disabled={!isOnline}><PencilIcon className="h-4 w-4 mr-2" />Tambah</Button></div><CardDescription>Keaktifan siswa di kelas.</CardDescription></CardHeader><CardContent><ActivityPointsHistory records={quizPoints} onEdit={(r) => setModalState({ type: 'quiz', data: r })} onDelete={(id) => setModalState({type: 'confirmDelete', title: 'Hapus Poin', message: 'Yakin hapus poin ini?', onConfirm: () => deleteQuizPointMutation.mutate(id), isPending: deleteQuizPointMutation.isPending})} isOnline={isOnline}/></CardContent></Card>
                </TabsContent>
                
                <TabsContent value="kehadiran-catatan" className="space-y-6">
                    <Card><CardHeader><CardTitle>Statistik Kehadiran</CardTitle><CardDescription>Total {totalAttendanceDays} catatan kehadiran.</CardDescription></CardHeader><CardContent><StackedProgressBar summary={attendanceSummary} total={totalAttendanceDays} /></CardContent></Card>
                    <Card><CardHeader><div className="flex justify-between items-center"><CardTitle>Riwayat Catatan Perkembangan</CardTitle><Button size="sm" onClick={() => setModalState({ type: 'report', data: null })} disabled={!isOnline}><PencilIcon className="h-4 w-4 mr-2"/>Tambah</Button></div><CardDescription>Catatan kualitatif tentang siswa.</CardDescription></CardHeader><CardContent><ReportTimeline reports={reports} onEdit={(r) => setModalState({ type: 'report', data: r })} onDelete={(id) => setModalState({type: 'confirmDelete', title: 'Hapus Laporan', message: 'Yakin hapus laporan ini?', onConfirm: () => deleteReportMutation.mutate(id), isPending: deleteReportMutation.isPending})} isOnline={isOnline} /></CardContent></Card>
                </TabsContent>

                <TabsContent value="pelanggaran">
                     <Card><CardHeader><div className="flex justify-between items-center"><CardTitle>Riwayat Poin Pelanggaran</CardTitle><Button size="sm" onClick={() => setModalState({ type: 'violation', mode: 'add', data: null })} disabled={!isOnline}><PencilIcon className="h-4 w-4 mr-2" />Tambah</Button></div><CardDescription>Total poin saat ini: <strong>{totalViolationPoints}</strong>.</CardDescription></CardHeader><CardContent><ViolationHistory violations={violations} onEdit={(v) => setModalState({ type: 'violation', mode: 'edit', data: v })} onDelete={(id) => setModalState({type: 'confirmDelete', title: 'Hapus Pelanggaran', message: 'Yakin hapus pelanggaran ini?', onConfirm: () => deleteViolationMutation.mutate(id), isPending: deleteViolationMutation.isPending})} isOnline={isOnline} /></CardContent></Card>
                </TabsContent>
            </Tabs>
            
            <StudentDetailModals
                modalState={modalState}
                onClose={() => setModalState({ type: 'closed' })}
                student={student}
                classes={classes}
                isOnline={isOnline}
                studentId={studentId!}
            />
        </div>
    );
};

export default StudentDetailPage;
