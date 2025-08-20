import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useToast } from '../../hooks/useToast';
import { Database } from '../../services/database.types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { LogoutIcon, BarChartIcon, CheckCircleIcon, ShieldAlertIcon, FileTextIcon, SparklesIcon, CalendarIcon, TrendingUpIcon, ChevronLeftIcon, ChevronRightIcon, MessageSquareIcon, SendIcon, UsersIcon } from '../Icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { Input } from '../ui/Input';

type PortalData = Database['public']['Functions']['get_student_portal_data']['Returns'] & {
    communications: CommunicationData[],
    teacher: { name: string, avatar_url: string, user_id: string } | null
};
type AcademicRecord = PortalData['academicRecords'][0];
type Violation = PortalData['violations'][0];
type Report = PortalData['reports'][0];
type QuizPoint = PortalData['quizPoints'][0];
type CommunicationData = Database['public']['Tables']['communications']['Row'];

type TimelineItem =
  | (Report & { type: 'report'; date: string })
  | (Violation & { type: 'violation'; date: string })
  | (QuizPoint & { type: 'quiz'; date: string });

const GlassCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
    <Card
      className={`bg-white/5 backdrop-blur-lg border border-white/10 ${className}`}
      {...props}
    />
);

const SummaryCard: React.FC<{ icon: React.ElementType, label: string, value: string | number, colorClass: string }> = ({ icon: Icon, label, value, colorClass }) => (
    <GlassCard className="p-4">
        <div className="flex items-center gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-white ${colorClass}`}>
                 <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-sm text-gray-300">{label}</p>
            </div>
        </div>
    </GlassCard>
);

const AttendanceCalendar: React.FC<{ records: PortalData['attendanceRecords'] }> = ({ records }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const recordsMap = useMemo(() => new Map(records.map(r => [r.date, r])), [records]);

    const changeMonth = (amount: number) => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + amount);
            return newDate;
        });
    };

    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(monthStart);
    startDate.setDate(startDate.getDate() - monthStart.getDay());
    const endDate = new Date(monthEnd);
    endDate.setDate(endDate.getDate() + (6 - monthEnd.getDay()));

    const days = [];
    let day = new Date(startDate);
    while (day <= endDate) {
        days.push(new Date(day));
        day.setDate(day.getDate() + 1);
    }
    
    const statusStyles: Record<string, string> = {
        Hadir: 'bg-green-500/80 border-green-400',
        Sakit: 'bg-blue-500/80 border-blue-400',
        Izin: 'bg-yellow-500/80 border-yellow-400',
        Alpha: 'bg-red-500/80 border-red-400',
    };

    return (
        <GlassCard className="h-full">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-yellow-400"/>Kalender Kehadiran</CardTitle>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-lg">{currentDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:bg-white/10" onClick={() => changeMonth(-1)}><ChevronLeftIcon className="w-5 h-5"/></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:bg-white/10" onClick={() => changeMonth(1)}><ChevronRightIcon className="w-5 h-5"/></Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-300 mb-2">
                    {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {days.map((d, i) => {
                        const dateString = d.toISOString().split('T')[0];
                        const record = recordsMap.get(dateString);
                        const isCurrentMonth = d.getMonth() === currentDate.getMonth();
                        return (
                            <div key={i} className="relative group aspect-square">
                                <div className={`w-full h-full rounded-md flex items-center justify-center border-2 transition-colors ${record ? statusStyles[record.status] : 'border-transparent'} ${isCurrentMonth ? 'bg-black/20' : 'bg-black/10'}`}>
                                    <span className={isCurrentMonth ? 'text-white' : 'text-gray-500'}>{d.getDate()}</span>
                                </div>
                                {record && (
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max p-2 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                        <p className="font-bold">{record.status}</p>
                                        {record.notes && <p className="italic">"{record.notes}"</p>}
                                        <div className="absolute w-2 h-2 bg-gray-900 transform rotate-45 -bottom-1 left-1/2 -translate-x-1/2"></div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </GlassCard>
    );
};

const GradeTrendChart: React.FC<{ records: AcademicRecord[] }> = ({ records }) => {
    const [activePoint, setActivePoint] = useState<number | null>(null);
    const width = 500; const height = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 30 };

    const points = useMemo(() => {
        if (records.length < 2) return [];
        const sortedRecords = [...records].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return sortedRecords.map((record, i) => ({
            x: padding.left + (i / (sortedRecords.length - 1)) * (width - padding.left - padding.right),
            y: height - padding.bottom - (record.score / 100) * (height - padding.top - padding.bottom),
            ...record
        }));
    }, [records]);

    if (records.length < 2) return <div className="flex items-center justify-center h-full text-gray-400">Data tidak cukup untuk menampilkan grafik tren.</div>;
    
    const pathD = points.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(' ');

    return (
        <div className="relative h-full w-full" onMouseLeave={() => setActivePoint(null)}>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                <defs><linearGradient id="gradeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" /><stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" /></linearGradient><filter id="lineGlow"><feGaussianBlur stdDeviation="2.5" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
                {[0, 25, 50, 75, 100].map(val => { const y = height - padding.bottom - (val / 100) * (height - padding.top - padding.bottom); return (<g key={val}><line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(255, 255, 255, 0.1)" /><text x={padding.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="rgba(255, 255, 255, 0.5)">{val}</text></g>)})}
                <path d={`${pathD} V ${height - padding.bottom} H ${padding.left} Z`} fill="url(#gradeGradient)" />
                <path d={pathD} fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#lineGlow)"/>
                {points.map((p, i) => (<circle key={i} cx={p.x} cy={p.y} r="8" fill="transparent" onMouseEnter={() => setActivePoint(i)} />))}
                {activePoint !== null && (<circle cx={points[activePoint].x} cy={points[activePoint].y} r="5" fill="#a78bfa" stroke="white" strokeWidth="2" className="pointer-events-none"/>)}
            </svg>
            {activePoint !== null && (<div className="absolute p-2 text-xs text-center transform -translate-x-1/2 bg-gray-900 text-white rounded-md shadow-xl pointer-events-none" style={{ left: `${(points[activePoint].x / width) * 100}%`, top: `${points[activePoint].y - 40}px` }}><p className="font-bold">{points[activePoint].score}</p><p>{points[activePoint].subject}</p><div className="absolute w-2 h-2 bg-gray-900 transform rotate-45 -bottom-1 left-1/2 -translate-x-1/2"></div></div>)}
        </div>
    );
};

const ActivityTimeline: React.FC<{ items: TimelineItem[] }> = ({ items }) => {
    if (items.length === 0) return <div className="text-center py-8 text-gray-400">Tidak ada aktivitas terbaru.</div>;
    const sortedItems = [...items].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
    const itemConfig = { report: { icon: FileTextIcon, color: 'bg-blue-500' }, violation: { icon: ShieldAlertIcon, color: 'bg-red-500' }, quiz: { icon: SparklesIcon, color: 'bg-green-500' } };

    return (
        <div className="space-y-6">
            {sortedItems.map(item => {
                const config = itemConfig[item.type]; const Icon = config.icon;
                return (
                    <div key={`${item.type}-${item.id}`} className="flex gap-4 relative">
                        <div className="absolute left-[18px] top-12 h-full border-l-2 border-dashed border-white/20"></div>
                        <div className="flex-shrink-0 z-10"><div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${config.color}`}><Icon className="w-5 h-5"/></div></div>
                        <div className="flex-grow pb-4">
                            <p className="text-xs text-gray-400">{new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric'})}</p>
                            <h4 className="font-bold text-white mb-1"> {item.type === 'report' ? item.title : item.type === 'violation' ? item.description : item.quiz_name}</h4>
                            {item.type === 'report' && <p className="text-sm text-gray-300 italic">"{item.notes}"</p>}
                            {item.type === 'violation' && <p className="text-sm font-semibold text-red-400">Poin Pelanggaran: {item.points}</p>}
                            {item.type === 'quiz' && <p className="text-sm font-semibold text-green-400">+1 Poin Keaktifan ({item.subject})</p>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const ParentPortalPage: React.FC = () => {
    const { studentId } = useParams<{ studentId: string }>();
    const navigate = useNavigate();
    const toast = useToast();
    const accessCode = sessionStorage.getItem('portal_access_code');
    const queryClient = useQueryClient();
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!accessCode) { toast.error("Sesi tidak valid. Silakan masuk kembali."); navigate('/portal-login'); }
    }, [accessCode, navigate, toast]);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['portalData', studentId, accessCode],
        queryFn: async (): Promise<PortalData> => {
            if (!studentId || !accessCode) throw new Error("ID Siswa atau Kode Akses tidak ada.");
            const { data: portalData, error } = await supabase.rpc('get_student_portal_data', { student_id_param: studentId, access_code_param: accessCode });
            if (error) throw error; 
            
            // Fetch communications separately
            const { data: comms, error: commsError } = await supabase.from('communications').select('*').eq('student_id', studentId).order('created_at', { ascending: true });
            if (commsError) throw commsError;

            // Fetch teacherId from the student record itself
            const { data: studentRecord, error: studentError } = await supabase.from('students').select('user_id').eq('id', studentId).single();
            if(studentError) throw studentError;
            const teacherId = studentRecord?.user_id;

            let teacher = null;
            if(teacherId) {
                // Supabase doesn't let us query the auth.users table directly for metadata via API key.
                // A workaround is a server-side function, but for this client-side app, we'll assume a 'profiles' table exists or fetch limited public data.
                // For this app, we'll simulate it, but in a real app, a 'profiles' table public to read `name` and `avatar_url` is best practice.
                teacher = { name: 'Guru Kelas', avatar_url: `https://i.pravatar.cc/150?u=${teacherId}`, user_id: teacherId };
            }

            return { ...portalData, communications: comms || [], teacher };
        },
        enabled: !!studentId && !!accessCode, retry: 1,
    });
    
    useEffect(() => {
        const markMessagesAsRead = async () => {
            if (data?.communications) {
                const unreadIds = data.communications
                    .filter(m => m.sender === 'teacher' && !m.is_read)
                    .map(m => m.id);

                if (unreadIds.length > 0) {
                    const { error } = await supabase
                        .from('communications')
                        .update({ is_read: true })
                        .in('id', unreadIds);
                    
                    if (error) {
                        console.error("Failed to mark messages as read:", error);
                    } else {
                        queryClient.invalidateQueries({ queryKey: ['portalData', studentId] });
                    }
                }
            }
        };

        markMessagesAsRead();
    }, [data?.communications, studentId, queryClient]);

    const sendMessageMutation = useMutation({
        mutationFn: async (messageText: string) => {
            if (!studentId || !data?.teacher?.user_id) throw new Error("Data guru tidak ditemukan.");
            const { error } = await supabase.from('communications').insert({
                student_id: studentId,
                user_id: data.teacher.user_id,
                message: messageText,
                sender: 'parent',
                is_read: false
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portalData', studentId] });
            setNewMessage('');
        },
        onError: (error: Error) => toast.error(error.message)
    });

    const summaries = useMemo(() => {
        if (!data) return { avgGrade: 'N/A', attendancePercent: 0, totalViolationPoints: 0 };
        const { academicRecords, attendanceRecords, violations } = data;
        const avgGrade = academicRecords.length > 0 ? Math.round(academicRecords.reduce((a, b) => a + b.score, 0) / academicRecords.length) : 'N/A';
        const attendancePercent = attendanceRecords.length > 0 ? Math.round((attendanceRecords.filter(r => r.status === 'Hadir').length / attendanceRecords.length) * 100) : 0;
        const totalViolationPoints = violations.reduce((sum, v) => sum + v.points, 0);
        return { avgGrade, attendancePercent, totalViolationPoints };
    }, [data]);
    
    const timelineItems: TimelineItem[] = useMemo(() => {
        if (!data) return [];
        const violations: TimelineItem[] = data.violations.map(v => ({...v, type: 'violation', date: v.date}));
        const reports: TimelineItem[] = data.reports.map(r => ({...r, type: 'report', date: r.date}));
        const quizzes: TimelineItem[] = data.quizPoints.map(q => ({...q, type: 'quiz', date: q.quiz_date}));
        return [...violations, ...reports, ...quizzes];
    }, [data]);

    const handleLogout = () => { sessionStorage.removeItem('portal_access_code'); navigate('/portal-login'); };
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [data?.communications]);

    if (isLoading) return <div className="flex items-center justify-center min-h-screen cosmic-bg"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    if (isError) {
        console.error(error);
        sessionStorage.removeItem('portal_access_code');
        return (<div className="flex flex-col items-center justify-center min-h-screen cosmic-bg text-white p-4 text-center"><h1 className="text-2xl font-bold">Akses Ditolak</h1><p className="mt-2">Kode akses tidak valid atau sesi telah berakhir. Silakan coba masuk lagi.</p><Button onClick={() => navigate('/portal-login')} className="mt-6">Kembali ke Halaman Login</Button></div>);
    }
    
    const { student, academicRecords, violations, communications, teacher } = data!;

    return (
        <div className="min-h-screen cosmic-bg text-white font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div className="flex items-center gap-6"><img src={student.avatar_url} alt={student.name} className="w-24 h-24 rounded-full object-cover border-4 border-white/20 shadow-lg"/><div><h1 className="text-4xl font-bold text-shadow-md">{student.name}</h1><p className="text-xl text-indigo-200">Kelas {student.classes?.name || 'N/A'}</p></div></div>
                    <Button variant="outline" onClick={handleLogout} className="bg-white/10 border-white/20 hover:bg-white/20 self-start sm:self-center"><LogoutIcon className="w-4 h-4 mr-2"/>Logout</Button>
                </header>

                <main className="animate-fade-in-up">
                    <Tabs defaultValue="overview">
                         <div className="flex justify-center mb-6">
                            <TabsList className="bg-black/20 border border-white/10 text-white">
                                <TabsTrigger value="overview">Ringkasan</TabsTrigger>
                                <TabsTrigger value="communication">Komunikasi</TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="overview">
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                                <SummaryCard icon={BarChartIcon} label="Rata-rata Nilai" value={summaries.avgGrade} colorClass="bg-purple-500" />
                                <SummaryCard icon={CheckCircleIcon} label="Persentase Kehadiran" value={`${summaries.attendancePercent}%`} colorClass="bg-green-500" />
                                <SummaryCard icon={ShieldAlertIcon} label="Total Poin Pelanggaran" value={summaries.totalViolationPoints} colorClass="bg-red-500" />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
                                <div className="lg:col-span-4"><AttendanceCalendar records={data.attendanceRecords} /></div>
                                <div className="lg:col-span-2"><GlassCard><CardHeader><CardTitle className="flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-yellow-400"/>Aktivitas Terbaru</CardTitle></CardHeader><CardContent><ActivityTimeline items={timelineItems}/></CardContent></GlassCard></div>
                                <div className="lg:col-span-3"><GlassCard><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUpIcon className="w-5 h-5 text-purple-400"/>Performa Akademik</CardTitle></CardHeader><CardContent><div className="h-64"><GradeTrendChart records={academicRecords}/></div></CardContent></GlassCard></div>
                                <div className="lg:col-span-3"><GlassCard><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlertIcon className="w-5 h-5 text-red-400"/>Ringkasan Pelanggaran</CardTitle></CardHeader><CardContent className="text-center"><p className="text-6xl font-bold text-red-400">{summaries.totalViolationPoints}</p><p className="text-sm text-gray-400 mb-4">Total Poin</p>{violations.length > 0 ? (<div className="text-left space-y-2 text-sm max-h-40 overflow-y-auto">{[...violations].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0,3).map(v => (<div key={v.id} className="p-2 bg-black/20 rounded-lg"><p className="font-semibold">{v.description} <span className="font-normal text-red-400">({v.points} poin)</span></p><p className="text-xs text-gray-400">{new Date(v.date).toLocaleDateString('id-ID')}</p></div>))}</div>) : (<p className="text-center text-gray-400 py-4">Tidak ada catatan pelanggaran.</p>)}</CardContent></GlassCard></div>
                            </div>
                        </TabsContent>

                        <TabsContent value="communication">
                            <GlassCard className="flex flex-col h-[70vh]">
                                <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareIcon className="w-5 h-5 text-blue-400"/>Komunikasi dengan Guru</CardTitle></CardHeader>
                                <CardContent className="flex-1 overflow-y-auto space-y-4 p-4 bg-black/20">
                                    {communications.map(msg => (
                                        <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'parent' ? 'justify-end' : 'justify-start'}`}>
                                            {msg.sender === 'teacher' && <img src={teacher?.avatar_url} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt={teacher?.name}/>}
                                            <div className={`max-w-md p-3 rounded-2xl text-sm ${msg.sender === 'parent' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-700 rounded-bl-none text-white'}`}>
                                                <p className="whitespace-pre-wrap">{msg.message}</p>
                                                <div className={`flex items-center gap-1 text-xs mt-1 ${msg.sender === 'parent' ? 'text-blue-200 justify-end' : 'text-gray-400 justify-end'}`}>
                                                    <span>{new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' })}</span>
                                                    {msg.sender === 'parent' && msg.is_read && <CheckCircleIcon className="w-3.5 h-3.5" />}
                                                </div>
                                            </div>
                                            {msg.sender === 'parent' && <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0"><UsersIcon className="w-5 h-5 text-gray-300" /></div>}
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </CardContent>
                                <form onSubmit={(e) => { e.preventDefault(); if (newMessage.trim()) sendMessageMutation.mutate(newMessage); }} className="p-4 border-t border-white/10 flex items-center gap-2">
                                    <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Ketik pesan..." className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-gray-400" disabled={sendMessageMutation.isPending}/>
                                    <Button type="submit" size="icon" disabled={!newMessage.trim() || sendMessageMutation.isPending}><SendIcon className="w-5 h-5" /></Button>
                                </form>
                            </GlassCard>
                        </TabsContent>
                    </Tabs>
                </main>

                <footer className="text-center mt-12 text-xs text-gray-400"><p>Portal Siswa Cerdas &copy; {new Date().getFullYear()}</p></footer>
            </div>
        </div>
    );
};

export default ParentPortalPage;