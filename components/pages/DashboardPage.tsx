
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '../ui/Card';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarIcon, UsersIcon, BookOpenIcon, ClockIcon, SparklesIcon, BrainCircuitIcon, CheckSquareIcon, AlertTriangleIcon, CheckCircleIcon } from '../Icons';
import { Button } from '../ui/Button';
import { GoogleGenAI, Type } from '@google/genai';
import GreetingRobot from '../GreetingRobot';
import { supabase } from '../../services/supabase';
import { Database } from '../../services/database.types';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../ui/Modal';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

type ReportWithStudent = { student_id: string, students: { name: string } | null };
type DashboardWeeklyAttendance = { day: string, present_percentage: number }[];
type TaskRow = Database['public']['Tables']['tasks']['Row'];
type DailyAttendanceRecord = { student_id: string, status: string, students: { name: string, avatar_url: string } | null };

type DashboardQueryData = {
    students: Pick<Database['public']['Tables']['students']['Row'], 'id' | 'name' | 'gender'>[];
    schedule: Database['public']['Tables']['schedules']['Row'][];
    dailyAttendanceSummary: {
        Hadir: number;
        Izin: number;
        Sakit: number;
        Alpha: number;
    };
    dailyAttendanceRecords: DailyAttendanceRecord[];
    weeklyAttendance: DashboardWeeklyAttendance;
    classCount: number;
    newReportsCount: number;
    tasks: TaskRow[];
    academicRecords: Pick<Database['public']['Tables']['academic_records']['Row'], 'student_id' | 'subject' | 'score'>[];
    violations: Pick<Database['public']['Tables']['violations']['Row'], 'student_id' | 'points'>[];
};

const AiInsightSkeleton = () => (
    <div className="space-y-4 animate-shimmer bg-gradient-to-r from-transparent via-gray-400/20 to-transparent bg-[length:200%_100%]">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-500/20"></div>
            <div className="h-5 rounded-lg bg-gray-500/20 w-1/3"></div>
        </div>
        <div className="pl-11 space-y-2">
            <div className="h-4 rounded-lg bg-gray-500/20 w-full"></div>
            <div className="h-4 rounded-lg bg-gray-500/20 w-5/6"></div>
        </div>
        <div className="flex items-center gap-3 mt-4">
            <div className="w-8 h-8 rounded-full bg-gray-500/20"></div>
            <div className="h-5 rounded-lg bg-gray-500/20 w-1/3"></div>
        </div>
        <div className="pl-11 space-y-2">
            <div className="h-4 rounded-lg bg-gray-500/20 w-full"></div>
        </div>
    </div>
);

const AiDashboardInsight: React.FC<{ 
    students: Pick<Database['public']['Tables']['students']['Row'], 'id' | 'name'>[], 
    attendance: any, 
    academicRecords: Pick<Database['public']['Tables']['academic_records']['Row'], 'student_id' | 'subject' | 'score'>[],
    violations: Pick<Database['public']['Tables']['violations']['Row'], 'student_id' | 'points'>[]
}> = ({ students, attendance, academicRecords, violations }) => {
    const [insight, setInsight] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const studentMap = useMemo(() => new Map(students.map(s => [s.name, s.id])), [students]);

    useEffect(() => {
        const generateInsight = async () => {
            setLoading(true);
            try {
                const systemInstruction = `Anda adalah asisten guru yang cerdas dan proaktif. Analisis data yang diberikan dan hasilkan ringkasan dalam format JSON yang valid. Fokus pada menyoroti pencapaian positif, area yang memerlukan perhatian, dan saran umum. Gunakan Bahasa Indonesia.`;

                const studentDataForPrompt = students.map(s => {
                    const studentViolations = violations.filter(v => v.student_id === s.id).reduce((sum, v) => sum + v.points, 0);
                    const studentScores = academicRecords.filter(r => r.student_id === s.id);
                    const avgScore = studentScores.length > 0 ? studentScores.reduce((a, b) => a + b.score, 0) / studentScores.length : null;

                    return {
                        name: s.name,
                        id: s.id,
                        total_violation_points: studentViolations,
                        average_score: avgScore ? Math.round(avgScore) : 'N/A',
                        recent_scores: studentScores.map(sc => ({ subject: sc.subject, score: sc.score })),
                    };
                });

                const prompt = `
                    Analisis data guru berikut untuk memberikan wawasan harian.

                    Data Ringkasan:
                    - Total Siswa: ${students.length}
                    - Absensi Hari Ini (%): Hadir ${attendance.Hadir}, Izin ${attendance.Izin}, Sakit ${attendance.Sakit}, Alpha ${attendance.Alpha}

                    Data Rinci Siswa (30 hari terakhir):
                    ${JSON.stringify(studentDataForPrompt)}

                    Tugas Anda:
                    1. Berdasarkan data rinci siswa, identifikasi 1-2 siswa yang berprestasi (rata-rata nilai tinggi, 0 poin pelanggaran). Berikan nama siswa dan alasannya (sebutkan rata-rata nilai jika ada).
                    2. Berdasarkan data rinci siswa, identifikasi 1-2 siswa yang paling memerlukan perhatian (rata-rata nilai rendah atau total poin pelanggaran tinggi). Berikan nama siswa dan alasannya (sebutkan rata-rata nilai atau total poin pelanggaran).
                    3. Berikan satu saran fokus untuk kelas secara umum berdasarkan data yang ada.
                    
                    Format jawaban Anda HARUS dalam bentuk JSON yang sesuai dengan skema yang diberikan. Jika tidak ada siswa yang cocok untuk satu kategori, kembalikan array kosong. Jangan membuat data, hanya gunakan yang disediakan.
                `;

                const responseSchema = {
                    type: Type.OBJECT,
                    properties: {
                        to_praise: {
                            type: Type.ARRAY, description: "Daftar siswa yang patut dipuji.",
                            items: { type: Type.OBJECT, properties: { student_name: { type: Type.STRING }, reason: { type: Type.STRING, description: "Alasan pujian, cth: 'Rata-rata nilai 95 dan aktif di kelas.'" } } }
                        },
                        needs_attention: {
                            type: Type.ARRAY, description: "Daftar siswa yang memerlukan perhatian.",
                            items: { type: Type.OBJECT, properties: { student_name: { type: Type.STRING }, reason: { type: Type.STRING, description: "Alasan, cth: 'Tingkat kehadiran menurun dan mendapat 10 poin pelanggaran.'" } } }
                        },
                        class_focus: {
                            type: Type.OBJECT, description: "Saran fokus untuk kelas.",
                            properties: { title: { type: Type.STRING, description: "Judul singkat untuk fokus, cth: 'Review Materi Fisika'" }, suggestion: { type: Type.STRING, description: "Penjelasan saran secara singkat." } }
                        }
                    },
                    required: ["to_praise", "needs_attention", "class_focus"]
                };
                
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: { systemInstruction, responseMimeType: "application/json", responseSchema, },
                });

                setInsight(JSON.parse(response.text));

            } catch (error) {
                console.error("Failed to generate AI insight:", error);
                setInsight(null); // Set to null on error to show a message
            } finally {
                setLoading(false);
            }
        };

        if (students.length > 0) {
            generateInsight();
        } else {
            setLoading(false);
            setInsight({ welcome: "Selamat datang! Tambahkan data siswa dan absensi untuk mendapatkan wawasan harian dari AI." });
        }
    }, [students, attendance, academicRecords, violations]);
    
    const handleCreateTask = (studentName: string, reason: string) => {
        navigate('/tugas', {
            state: {
                prefill: {
                    title: `Tugas untuk ${studentName}`,
                    description: `Dibuat berdasarkan saran AI: "${reason}"`,
                    status: 'todo'
                }
            }
        });
    };
    
    const InsightSection: React.FC<{ icon: React.ElementType, title: string, color: string, children: React.ReactNode }> = ({ icon: Icon, title, color, children }) => (
        <div>
            <div className="flex items-center gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-${color}-500/20`}><Icon className={`w-5 h-5 text-${color}-400`} /></div>
                <h4 className={`text-lg font-semibold text-white`}>{title}</h4>
            </div>
            <div className="pl-11 pt-2 space-y-3 text-indigo-100 text-sm">{children}</div>
        </div>
    );
    
    return (
        <div className="bg-black/20 backdrop-blur-sm border border-white/20 p-6 rounded-2xl h-full flex flex-col">
            <h3 className="flex items-center gap-3 text-xl text-white font-semibold mb-4">
                <SparklesIcon className="w-6 h-6 text-fuchsia-400" />
                <span>Wawasan AI Harian</span>
            </h3>
            <div className="space-y-5 flex-grow">
                {loading ? <AiInsightSkeleton /> : !insight ? (
                    <p className="text-indigo-200 text-sm">Tidak dapat memuat wawasan AI saat ini. Silakan coba lagi nanti.</p>
                ) : insight.welcome ? (
                     <p className="text-indigo-200 text-sm">{insight.welcome}</p>
                ) : (
                    <>
                        {insight.to_praise && insight.to_praise.length > 0 && (
                            <InsightSection icon={CheckCircleIcon} title="Siswa Berprestasi" color="green">
                                {insight.to_praise.map((item: any, index: number) => {
                                    const studentId = studentMap.get(item.student_name);
                                    return <p key={index}><Link to={studentId ? `/siswa/${studentId}` : '#'} className="font-bold hover:underline">{item.student_name}</Link>: {item.reason}</p>;
                                })}
                            </InsightSection>
                        )}
                        {insight.needs_attention && insight.needs_attention.length > 0 && (
                             <InsightSection icon={AlertTriangleIcon} title="Perlu Perhatian" color="yellow">
                                {insight.needs_attention.map((item: any, index: number) => {
                                    const studentId = studentMap.get(item.student_name);
                                    return (
                                        <div key={index} className="flex justify-between items-center gap-2">
                                            <p className="flex-grow"><Link to={studentId ? `/siswa/${studentId}` : '#'} className="font-bold hover:underline">{item.student_name}</Link>: {item.reason}</p>
                                            <Button size="sm" onClick={() => handleCreateTask(item.student_name, item.reason)} className="text-xs h-7 flex-shrink-0 bg-white/10 text-white backdrop-blur-sm border border-white/20 hover:bg-white/20">Buat Tugas</Button>
                                        </div>
                                    );
                                })}
                            </InsightSection>
                        )}
                        {insight.class_focus && insight.class_focus.title && (
                            <InsightSection icon={BrainCircuitIcon} title={insight.class_focus.title} color="fuchsia">
                                <p>{insight.class_focus.suggestion}</p>
                            </InsightSection>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};


const DonutChart: React.FC<{ data: Record<string, number>; onClick: (status: string) => void }> = ({ data, onClick }) => {
    const colors: Record<string, string> = { Hadir: '#22c55e', Izin: '#f59e0b', Sakit: '#3b82f6', Alpha: '#ef4444' };
    
    const total = Object.values(data).reduce((sum, value) => sum + value, 0);

    if (total === 0) return <div className="text-center text-gray-400 text-sm">Data belum ada</div>;

    let cumulative = 0;

    return (
        <div className="relative w-32 h-32">
            <svg viewBox="0 0 36 36" className="transform -rotate-90">
                {Object.entries(data).map(([key, value]) => {
                    const percentage = total > 0 ? (value / total) * 100 : 0;
                    if (percentage === 0) return null;
                    const dashArray = `${percentage} ${100 - percentage}`;
                    const offset = -cumulative;
                    cumulative += percentage;
                    return (
                        <circle key={key} cx="18" cy="18" r="15.9155" fill="transparent" stroke={colors[key]} strokeWidth="3.8" strokeDasharray={dashArray} strokeDashoffset={offset} onClick={() => onClick(key)} className="cursor-pointer transition-all duration-300 hover:stroke-[5px]" />
                    );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-gray-800 dark:text-gray-200">{data.Hadir || 0}%</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Hadir</span>
            </div>
        </div>
    );
};

const WeeklyAttendanceChart: React.FC<{ attendanceData: DashboardWeeklyAttendance }> = ({ attendanceData }) => {
    const weeklyAttendance = useMemo(() => {
        const days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum'];
        // Use a map for quick lookups
        const dataMap = new Map(attendanceData.map(d => [d.day.slice(0, 3), d.present_percentage]));
        return days.map(day => ({ day, value: dataMap.get(day) || 0 }));
    }, [attendanceData]);
    
    const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

    const line = (pointA: {x:number, y:number}, pointB: {x:number, y:number}) => ({ length: Math.sqrt(Math.pow(pointB.x - pointA.x, 2) + Math.pow(pointB.y - pointA.y, 2)), angle: Math.atan2(pointB.y - pointA.y, pointB.x - pointA.x) });
    const controlPoint = (current: {x:number, y:number}, previous: {x:number, y:number} | undefined, next: {x:number, y:number} | undefined, reverse?: boolean) => {
        const p = previous || current; const n = next || current; const smoothing = 0.2; const o = line(p, n);
        const angle = o.angle + (reverse ? Math.PI : 0); const length = o.length * smoothing;
        const x = current.x + Math.cos(angle) * length; const y = current.y + Math.sin(angle) * length; return [x, y];
    };
    const bezierCommand = (point: {x:number, y:number}, i: number, a: {x:number, y:number}[]) => {
        const [cpsX, cpsY] = controlPoint(a[i - 1], a[i - 2], point);
        const [cpeX, cpeY] = controlPoint(point, a[i - 1], a[i + 1], true);
        return `C ${cpsX.toFixed(2)},${cpsY.toFixed(2)} ${cpeX.toFixed(2)},${cpeY.toFixed(2)} ${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    };
    const svgPath = (points: {x:number, y:number}[]) => points.reduce((acc, point, i, a) => i === 0 ? `M ${point.x.toFixed(2)},${point.y.toFixed(2)}` : `${acc} ${bezierCommand(point, i, a)}`, '');
    
    const points = weeklyAttendance.map((item, index, arr) => {
        const x = (index / (arr.length - 1)) * 100;
        let y = 100 - ((item.value) / (101)) * 90;
        y = Math.max(5, Math.min(95, y));
        return { x, y, value: item.value, day: item.day };
    });

    const pathD = svgPath(points);
    const areaPathD = `${pathD} L 100 100 L 0 100 Z`;
    const activePoint = hoveredPoint !== null ? points[hoveredPoint] : null;

    return (
        <div className="h-48 relative" onMouseLeave={() => setHoveredPoint(null)}>
             <div className="absolute inset-0 grid grid-rows-4" aria-hidden="true">{[...Array(4)].map((_, i) => (<div key={i} className="border-b border-dashed border-gray-200 dark:border-gray-800/60"></div>))}</div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2" /><stop offset="100%" stopColor="#3b82f6" stopOpacity="0" /></linearGradient>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#a855f7" /><stop offset="100%" stopColor="#3b82f6" /></linearGradient>
                    <filter id="glow"><feGaussianBlur stdDeviation="1.5" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>
                <path d={areaPathD} fill="url(#chartGradient)" />
                <path d={pathD} fill="none" stroke="url(#lineGradient)" strokeWidth="1" filter="url(#glow)" strokeLinecap="round" strokeLinejoin="round"/>
                <g className="interaction-layer">{points.map((p, i) => (<rect key={`hover-${i}`} x={p.x - 5} y="0" width="10" height="100" fill="transparent" onMouseEnter={() => setHoveredPoint(i)} className="cursor-pointer" />))}</g>
                {activePoint && (<g className="pointer-events-none"><line x1={activePoint.x} y1="0" x2={activePoint.x} y2="100" stroke="currentColor" strokeWidth="0.25" strokeDasharray="2 2" className="text-purple-400 dark:text-purple-600" /><circle cx={activePoint.x} cy={activePoint.y} r="3" fill="white" strokeWidth="1.5" stroke="url(#lineGradient)" /></g>)}
            </svg>
            {activePoint && (<div className="absolute z-10 p-2 text-xs text-center transform -translate-x-1/2 -translate-y-full bg-gray-800 text-white rounded-md shadow-xl pointer-events-none" style={{ left: `${activePoint.x}%`, top: `${activePoint.y}%`, marginTop: '-8px' }}><span className="font-bold">{activePoint.value}%</span><div className="absolute w-2 h-2 bg-gray-800 transform rotate-45 -bottom-1 left-1/2 -translate-x-1/2"></div></div>)}
            <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-1">{points.map((item, index) => (<div key={item.day} className={`text-xs sm:text-sm font-bold transition-all duration-300 ${hoveredPoint === index ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}>{item.day}</div>))}</div>
        </div>
    );
};

type ScheduleStatus = 'past' | 'current' | 'upcoming';

const fetchDashboardData = async (userId: string): Promise<DashboardQueryData> => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
        studentsRes, reportsRes, scheduleRes, classesRes, tasksRes, 
        dailySummaryRes, weeklyAttendanceRes, dailyAttendanceRecordsRes, 
        academicRecordsRes, violationsRes
    ] = await Promise.all([
        supabase.from('students').select('id, name, gender').eq('user_id', userId),
        supabase.from('reports').select('student_id, students(name)').eq('user_id', userId).gte('date', sevenDaysAgo),
        supabase.from('schedules').select('*').eq('user_id', userId),
        supabase.from('classes').select('name').eq('user_id', userId),
        supabase.from('tasks').select('*').eq('user_id', userId).neq('status', 'done').order('due_date'),
        supabase.rpc('get_daily_attendance_summary', { for_date: today }),
        supabase.rpc('get_weekly_attendance_summary', { user_id: userId }),
        supabase.from('attendance').select('student_id, status, students(name, avatar_url)').eq('user_id', userId).eq('date', today),
        supabase.from('academic_records').select('student_id, subject, score').eq('user_id', userId).gte('created_at', thirtyDaysAgo),
        supabase.from('violations').select('student_id, points').eq('user_id', userId).gte('date', thirtyDaysAgo),
    ]);

    // Simplified error checking for brevity
    if (studentsRes.error) throw studentsRes.error;
    if (reportsRes.error) throw reportsRes.error;
    if (scheduleRes.error) throw scheduleRes.error;
    // ... and so on for all requests

    const dailySummaryData = dailySummaryRes.data?.[0];
    const dailyAttendanceSummary = {
        Hadir: dailySummaryData?.present_percentage ?? 0,
        Izin: dailySummaryData?.permission_percentage ?? 0,
        Sakit: dailySummaryData?.sick_percentage ?? 0,
        Alpha: dailySummaryData?.absent_percentage ?? 0,
    };

    const safeReports = (reportsRes.data || []).filter((r: ReportWithStudent): r is ReportWithStudent & { students: { name: string } } => !!r.students);
    
    return {
        students: studentsRes.data || [],
        schedule: scheduleRes.data || [],
        dailyAttendanceSummary,
        dailyAttendanceRecords: (dailyAttendanceRecordsRes.data || []) as DailyAttendanceRecord[],
        weeklyAttendance: weeklyAttendanceRes.data || [],
        classCount: (classesRes.data || []).length,
        newReportsCount: safeReports.length,
        tasks: tasksRes.data || [],
        academicRecords: academicRecordsRes.data || [],
        violations: violationsRes.data || [],
    };
};

const InteractiveStatCard: React.FC<{
    link: string;
    color: string;
    shadow: string;
    label: string;
    value: number | string;
    details: React.ReactNode;
    icon: React.FC<any>;
}> = ({ link, color, shadow, label, value, details, icon: Icon }) => {
    return (
        <Link to={link} className="block group h-full relative">
            <Card className={`text-white overflow-hidden relative transition-all duration-300 group-hover:-translate-y-2 shadow-lg ${shadow} bg-gradient-to-br ${color} h-full flex flex-col justify-center`}>
                <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full transition-transform duration-500 group-hover:scale-[8]"></div>
                <CardContent className="p-5 relative z-10">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <p className="font-semibold">{label}</p>
                            <div className="relative h-12 w-40">
                                <div className="absolute inset-0 transition-all duration-300 ease-out group-hover:-translate-y-full group-hover:opacity-0">
                                    <p className="text-4xl font-bold">{value}</p>
                                </div>
                                <div className="absolute inset-0 transition-all duration-300 ease-out translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100">
                                    {details}
                                </div>
                            </div>
                        </div>
                        <Icon className="w-7 h-7 text-white/80 flex-shrink-0" />
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
};


const DashboardPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [showGreeting, setShowGreeting] = useState(false);
    const [attendanceModal, setAttendanceModal] = useState<{ isOpen: boolean; status: string; students: DailyAttendanceRecord[] }>({ isOpen: false, status: '', students: [] });

    const { data: dashboardData, isLoading } = useQuery<DashboardQueryData>({
        queryKey: ['dashboardData', user?.id],
        queryFn: () => fetchDashboardData(user!.id),
        enabled: !!user,
    });
    
    useEffect(() => {
        const hasBeenGreeted = sessionStorage.getItem('hasBeenGreeted');
        if (!hasBeenGreeted) {
            const timer = setTimeout(() => { setShowGreeting(true); sessionStorage.setItem('hasBeenGreeted', 'true'); }, 500);
            return () => clearTimeout(timer);
        }
    }, []);

    const todaySchedule = useMemo(() => {
        if (!dashboardData?.schedule) return [];
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const today = dayNames[new Date().getDay()] as any;
        return dashboardData.schedule.filter(item => item.day === today).sort((a,b) => a.start_time.localeCompare(b.start_time));
    }, [dashboardData?.schedule]);

    const getScheduleStatus = (startTimeStr: string, endTimeStr: string): ScheduleStatus => {
        const now = new Date(); const today = now.toISOString().split('T')[0];
        const startTime = new Date(`${today}T${startTimeStr}`); const endTime = new Date(`${today}T${endTimeStr}`);
        if (now > endTime) return 'past'; if (now >= startTime && now <= endTime) return 'current'; return 'upcoming';
    }

    const handleDonutClick = (status: string) => {
        if (!dashboardData) return;
        const filteredStudents = dashboardData.dailyAttendanceRecords.filter(r => r.status === status);
        setAttendanceModal({ isOpen: true, status, students: filteredStudents });
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    const { students = [], dailyAttendanceSummary = { Hadir: 0, Izin: 0, Sakit: 0, Alpha: 0 }, weeklyAttendance = [], classCount = 0, newReportsCount = 0, tasks = [], academicRecords = [], violations = [] } = dashboardData ?? {};
    
    const stats = [
        { label: 'Total Siswa', value: students.length, icon: UsersIcon, color: 'from-blue-500 to-sky-400', shadow: 'group-hover:shadow-[0_0_20px_theme(colors.sky.500/40%)]', link: '/siswa', details: <p className="text-sm font-medium">{students.filter(s => s.gender === 'Laki-laki').length} Laki-laki<br/>{students.filter(s => s.gender === 'Perempuan').length} Perempuan</p> },
        { label: 'Laporan Baru', value: newReportsCount, icon: BookOpenIcon, color: 'from-yellow-500 to-amber-400', shadow: 'group-hover:shadow-[0_0_20px_theme(colors.amber.500/40%)]', link: '/siswa', details: <p className="text-sm font-medium leading-tight">Laporan baru dalam 7 hari terakhir</p> },
        { label: 'Kelas Diajar', value: classCount, icon: CalendarIcon, color: 'from-purple-500 to-violet-400', shadow: 'group-hover:shadow-[0_0_20px_theme(colors.violet.500/40%)]', link: '/jadwal', details: <p className="text-sm font-medium leading-tight">Total kelas yang Anda ajar</p> },
    ];
    
    return (
        <div className="space-y-8">
            {showGreeting && user && <GreetingRobot userName={user.name} onAnimationEnd={() => setShowGreeting(false)} />}
            <div className="relative p-8 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-700 to-blue-600 text-white shadow-2xl shadow-indigo-500/30 overflow-hidden animate-fade-in-up">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-white/10 rounded-full"></div>
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    <div className="flex flex-col justify-center">
                        <h1 className="text-3xl md:text-4xl font-bold">Selamat Datang, {user?.name}!</h1>
                        <p className="mt-2 text-indigo-100 max-w-2xl">Ini adalah pusat kendali Anda. Lihat statistik kunci, jadwal hari ini, dan aktivitas terbaru secara sekilas.</p>
                        <Link to="/absensi"><Button className="mt-6 bg-white/20 text-white backdrop-blur-sm border border-white/30 hover:bg-white/30 transition-all shadow-lg hover:shadow-white/20">Mulai Absensi Sekarang</Button></Link>
                    </div>
                    <div><AiDashboardInsight students={students} attendance={dailyAttendanceSummary} academicRecords={academicRecords} violations={violations} /></div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="sm:col-span-2 lg:col-span-1 animate-fade-in-up" style={{ animationDelay: `0ms` }}>
                    <Card className="h-full flex flex-col">
                        <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Kehadiran Hari Ini</CardTitle><CardDescription className="text-xs">Klik segmen untuk detail.</CardDescription></CardHeader>
                        <CardContent className="flex-grow flex items-center justify-center p-4">
                            <div className="flex flex-col sm:grid sm:grid-cols-2 items-center gap-4 sm:gap-6 w-full">
                                <div className="flex justify-center"><DonutChart data={dailyAttendanceSummary} onClick={handleDonutClick} /></div>
                                <div className="space-y-2 text-sm">{Object.entries(dailyAttendanceSummary).map(([key, value]: [string, any]) => (<div key={key} className="flex items-center justify-between gap-2"><div className="flex items-center"><span className={`w-2 h-2 rounded-full mr-2 ${{Hadir: 'bg-green-500', Izin: 'bg-yellow-500', Sakit: 'bg-blue-500', Alpha: 'bg-red-500'}[key]}`}></span><span className="text-gray-600 dark:text-gray-400">{key}</span></div><span className="font-semibold text-gray-800 dark:text-gray-200">{value}%</span></div>))}</div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                {stats.map((stat, i) => (<div key={stat.label} className="animate-fade-in-up" style={{ animationDelay: `${(i + 1) * 100}ms` }}><InteractiveStatCard {...stat} /></div>))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <Card className="animate-fade-in-up" style={{ animationDelay: '400ms' }}><CardHeader><CardTitle>Ringkasan Kehadiran Mingguan</CardTitle><CardDescription>Grafik kehadiran siswa selama seminggu terakhir.</CardDescription></CardHeader><CardContent className="pb-10"><WeeklyAttendanceChart attendanceData={weeklyAttendance} /></CardContent></Card>
                    <Card className="animate-fade-in-up" style={{ animationDelay: '500ms' }}>
                        <CardHeader><CardTitle>Tugas Anda</CardTitle><CardDescription>Tugas yang akan datang atau sedang dikerjakan.</CardDescription></CardHeader>
                        <CardContent>
                            {tasks.length > 0 ? (
                                <ul className="space-y-3">{tasks.slice(0, 3).map((task) => (<li key={task.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-4 border-blue-500"><div><p className="font-semibold text-gray-800 dark:text-gray-200">{task.title}</p><p className="text-xs text-gray-500 dark:text-gray-400">Jatuh tempo: {task.due_date ? new Date(task.due_date).toLocaleDateString('id-ID') : 'Tidak ada'}</p></div><span className={`px-2 py-1 text-xs font-semibold rounded-full ${task.status === 'todo' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{task.status === 'todo' ? 'Baru' : 'Dikerjakan'}</span></li>))}</ul>
                            ) : (
                                <div className="text-center py-8 px-4"><div className="inline-block p-4 bg-gradient-to-br from-blue-100 to-sky-100 dark:from-blue-900/40 dark:to-sky-900/40 rounded-full mb-4"><CheckSquareIcon className="w-10 h-10 text-blue-500 dark:text-blue-300" /></div><h4 className="font-semibold text-lg text-gray-800 dark:text-gray-200">Tidak Ada Tugas</h4><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Semua pekerjaan selesai. Hebat!</p></div>
                            )}
                        </CardContent>
                        <CardFooter><Link to="/tugas" className="w-full"><Button variant="outline" className="w-full">Lihat Semua Tugas</Button></Link></CardFooter>
                    </Card>
                </div>
                <div className="lg:col-span-1">
                    <Card className="flex flex-col animate-fade-in-up h-full" style={{ animationDelay: '600ms' }}><CardHeader><CardTitle>Jadwal Hari Ini</CardTitle></CardHeader>
                        <CardContent className="flex-grow">{todaySchedule.length > 0 ? (<ul className="space-y-4">{todaySchedule.map((item, index) => { 
                            const status = getScheduleStatus(item.start_time, item.end_time); 
                            const statusClasses: Record<ScheduleStatus, string> = { past: 'opacity-50 line-through', current: 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ring-green-500 animate-pulse-glow', upcoming: '' }; 
                            const statusIndicator: Record<ScheduleStatus, React.ReactNode> = { past: null, current: <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-green-500 rounded-full animate-ping"></div>, upcoming: null }; 
                            return (<li key={index} className={`relative flex items-center space-x-4 p-3 rounded-lg transition-all ${statusClasses[status]}`}>{statusIndicator[status]}<div className={`w-1.5 h-12 bg-blue-500 rounded-full`}></div><div><p className="font-semibold text-gray-800 dark:text-gray-200">{item.subject}</p><p className="text-sm text-gray-600 dark:text-gray-400">{item.start_time} - {item.end_time} &middot; Kelas {item.class_id}</p></div></li>); 
                        })}</ul>) : (<div className="h-full flex flex-col items-center justify-center text-center p-4"><div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full mb-4"><CalendarIcon className="w-10 h-10 text-green-500 dark:text-green-400" /></div><p className="font-semibold text-gray-800 dark:text-gray-200">Tidak Ada Jadwal Hari Ini</p><p className="text-sm text-gray-500 dark:text-gray-400">Saatnya bersantai sejenak!</p></div>)}</CardContent>
                        <CardFooter className="mt-auto"><Link to="/jadwal" className="w-full"><Button variant="outline" className="w-full">Lihat Semua Jadwal</Button></Link></CardFooter>
                    </Card>
                </div>
            </div>
            
            <Modal isOpen={attendanceModal.isOpen} onClose={() => setAttendanceModal({ isOpen: false, status: '', students: [] })} title={`Siswa dengan Status: ${attendanceModal.status}`}>
                {attendanceModal.students.length > 0 ? (
                    <ul className="space-y-3 max-h-96 overflow-y-auto">
                        {attendanceModal.students.map(record => (
                            <li key={record.student_id} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg cursor-pointer" onClick={() => { navigate(`/siswa/${record.student_id}`); setAttendanceModal({isOpen: false, status: '', students: []}); }}>
                                <img src={record.students?.avatar_url} alt={record.students?.name} className="w-10 h-10 rounded-full object-cover" />
                                <span className="font-semibold text-gray-800 dark:text-gray-200">{record.students?.name || 'Siswa tidak ditemukan'}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-gray-500 py-4">Tidak ada siswa dengan status ini hari ini.</p>
                )}
            </Modal>
        </div>
    );
};

export default DashboardPage;
