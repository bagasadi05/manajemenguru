import React, { useState, useMemo, useEffect } from 'react';
import { AttendanceStatus } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { CheckCircleIcon, XCircleIcon, AlertCircleIcon, DownloadCloudIcon, BrainCircuitIcon, UserCheckIcon, PencilIcon, SparklesIcon, UserMinusIcon, UserPlusIcon } from '../Icons';
import { useToast } from '../../hooks/useToast';
import { supabase, ai } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Database } from '../../services/database.types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Type } from '@google/genai';
import { addToQueue } from '../../services/offlineQueue';

type ClassRow = Database['public']['Tables']['classes']['Row'];
type StudentRow = Database['public']['Tables']['students']['Row'];
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type StudentWithClass = StudentRow & { classes: Pick<ClassRow, 'name'> | null };
type AttendanceRecord = { status: AttendanceStatus; note: string };
type AiAnalysis = {
    perfect_attendance: string[];
    frequent_absentees: { student_name: string; absent_days: number; }[];
    pattern_warnings: { pattern_description: string; implicated_students: string[]; }[];
};

const statusOptions = [
    { value: AttendanceStatus.Hadir, label: 'Hadir', icon: CheckCircleIcon, color: 'green' },
    { value: AttendanceStatus.Izin, label: 'Izin', icon: UserCheckIcon, color: 'yellow' },
    { value: AttendanceStatus.Sakit, label: 'Sakit', icon: UserPlusIcon, color: 'blue' },
    { value: AttendanceStatus.Alpha, label: 'Alpha', icon: UserMinusIcon, color: 'red' },
];

const statusStyles: Record<string, { active: string; hover: string; icon: string }> = {
    green: { active: 'border-green-500 shadow-lg shadow-green-500/50', hover: 'hover:border-green-500/50', icon: 'text-green-400' },
    yellow: { active: 'border-yellow-500 shadow-lg shadow-yellow-500/50', hover: 'hover:border-yellow-500/50', icon: 'text-yellow-400' },
    blue: { active: 'border-blue-500 shadow-lg shadow-blue-500/50', hover: 'hover:border-blue-500/50', icon: 'text-blue-400' },
    red: { active: 'border-red-500 shadow-lg shadow-red-500/50', hover: 'hover:border-red-500/50', icon: 'text-red-400' },
};

const buttonStatusStyles: Record<string, { active: string; hover: string; }> = {
    green: { active: 'bg-green-500/20 border-green-500', hover: 'hover:border-green-500/50' },
    yellow: { active: 'bg-yellow-500/20 border-yellow-500', hover: 'hover:border-yellow-500/50' },
    blue: { active: 'bg-blue-500/20 border-blue-500', hover: 'hover:border-blue-500/50' },
    red: { active: 'bg-red-500/20 border-red-500', hover: 'hover:border-red-500/50' },
};

const AttendancePage: React.FC = () => {
    const toast = useToast();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const isOnline = useOfflineStatus();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>(today);
    const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
    const [quickMarkStatus, setQuickMarkStatus] = useState<AttendanceStatus | null>(null);

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportMonth, setExportMonth] = useState(new Date().toISOString().slice(0, 7));
    const [isExporting, setIsExporting] = useState(false);
    
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiAnalysisResult, setAiAnalysisResult] = useState<AiAnalysis | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);

    const { data: classes, isLoading: isLoadingClasses } = useQuery({
        queryKey: ['classes', user?.id],
        queryFn: async (): Promise<ClassRow[]> => {
            const { data, error } = await supabase.from('classes').select('*').eq('user_id', user!.id);
            if (error) throw error;
            return data || [];
        },
        enabled: !!user,
    });

    useEffect(() => {
        if (classes && classes.length > 0 && !selectedClass) {
            setSelectedClass(classes[0].id);
        }
    }, [classes, selectedClass]);

    const { data: students, isLoading: isLoadingStudents } = useQuery({
        queryKey: ['studentsForAttendance', selectedClass],
        queryFn: async () => {
            if (!selectedClass || !user) return [];
            const { data: studentsData, error: studentsError } = await supabase.from('students').select('*').eq('class_id', selectedClass).eq('user_id', user.id).order('name', { ascending: true });
            if (studentsError) throw studentsError;
            return studentsData || [];
        },
        enabled: !!selectedClass && !!user
    });

    const { data: existingAttendance } = useQuery({
        queryKey: ['attendanceData', selectedClass, selectedDate],
        queryFn: async () => {
            if (!students || students.length === 0) return {};
            const { data: attendanceData, error: attendanceError } = await supabase.from('attendance').select('*').eq('date', selectedDate).in('student_id', students.map(s => s.id));
            if (attendanceError) throw attendanceError;
            return (attendanceData || []).reduce((acc, record: AttendanceRow) => {
                acc[record.student_id] = { status: record.status as AttendanceStatus, note: record.notes || '' };
                return acc;
            }, {} as Record<string, AttendanceRecord>);
        },
        enabled: !!students && students.length > 0,
    });

    useEffect(() => {
        setAttendanceRecords(existingAttendance || {});
    }, [existingAttendance]);

    const { mutate: saveAttendance, isPending: isSaving } = useMutation({
        mutationFn: async (recordsToUpsert: Database['public']['Tables']['attendance']['Insert'][]) => {
            if (isOnline) {
                const { error } = await supabase.from('attendance').upsert(recordsToUpsert, { onConflict: 'student_id, date' });
                if (error) throw error;
                return { synced: true };
            } else {
                addToQueue({
                    table: 'attendance',
                    operation: 'upsert',
                    payload: recordsToUpsert,
                    onConflict: 'student_id, date',
                });
                return { synced: false };
            }
        },
        onMutate: async (recordsToUpsert) => {
            await queryClient.cancelQueries({ queryKey: ['attendanceData', selectedClass, selectedDate] });
            const previousAttendance = queryClient.getQueryData(['attendanceData', selectedClass, selectedDate]);
            queryClient.setQueryData(['attendanceData', selectedClass, selectedDate], (old: Record<string, AttendanceRecord> = {}) => {
                const newData = { ...old };
                recordsToUpsert.forEach(record => {
                    newData[record.student_id] = { status: record.status as AttendanceStatus, note: record.notes || '' };
                });
                return newData;
            });
            return { previousAttendance };
        },
        onError: (err: Error, newRecords, context) => {
            queryClient.setQueryData(['attendanceData', selectedClass, selectedDate], context?.previousAttendance);
            toast.error(`Gagal menyimpan absensi: ${err.message}`);
        },
        onSuccess: (data) => {
            if (data.synced) {
                toast.success('Absensi berhasil disimpan!');
            } else {
                toast.info('Absensi disimpan offline. Akan disinkronkan saat kembali online.');
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['attendanceData', selectedClass, selectedDate] });
            queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
        },
    });

    const attendanceSummary = useMemo(() => {
        const summary = statusOptions.reduce((acc, opt) => ({ ...acc, [opt.value]: 0 }), {} as Record<AttendanceStatus, number>);
        Object.values(attendanceRecords).forEach(record => {
            summary[record.status]++;
        });
        return summary;
    }, [attendanceRecords]);

    const unmarkedStudents = useMemo(() => {
        if (!students) return [];
        return students.filter(student => !attendanceRecords[student.id]);
    }, [students, attendanceRecords]);

    const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
        setAttendanceRecords(prev => ({
            ...prev,
            [studentId]: { status, note: (status === 'Izin' || status === 'Sakit') ? (prev[studentId]?.note || '') : '' }
        }));
    };
    
    const handleNoteChange = (studentId: string, note: string) => {
        setAttendanceRecords(prev => ({ ...prev, [studentId]: { ...prev[studentId], note } }));
    };

    const handleQuickMark = (studentId: string) => {
        if (quickMarkStatus) handleStatusChange(studentId, quickMarkStatus);
    };

    const markRestAsPresent = () => {
        const updatedRecords = { ...attendanceRecords };
        unmarkedStudents.forEach(student => {
            updatedRecords[student.id] = { status: AttendanceStatus.Hadir, note: '' };
        });
        setAttendanceRecords(updatedRecords);
    };

    const handleSave = () => {
        if (!user || !students) return;
        if (unmarkedStudents.length > 0) {
            if (!window.confirm(`Masih ada ${unmarkedStudents.length} siswa yang belum diabsen. Apakah Anda ingin menandai mereka semua sebagai "Hadir" dan menyimpan?`)) {
                return;
            }
        }
        
        const recordsToSave = { ...attendanceRecords };
        unmarkedStudents.forEach(student => {
            recordsToSave[student.id] = { status: AttendanceStatus.Hadir, note: '' };
        });
        
        const recordsToUpsert: Database['public']['Tables']['attendance']['Insert'][] = Object.entries(recordsToSave).map(([student_id, record]) => ({
            student_id, date: selectedDate, status: record.status, notes: record.note, user_id: user.id
        }));

        saveAttendance(recordsToUpsert);
    };
    
    const fetchMonthAttendanceData = async (month: string) => {
        if (!user) return null;
        const [year, monthNum] = month.split('-').map(Number);
        const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
        const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];

        const [studentsRes, attendanceRes, classesRes] = await Promise.all([
            supabase.from('students').select('*, classes(name)').eq('user_id', user.id),
            supabase.from('attendance').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate),
            supabase.from('classes').select('id, name').eq('user_id', user.id),
        ]);

        if (studentsRes.error || attendanceRes.error || classesRes.error) throw new Error('Gagal mengambil data untuk ekspor.');
        return { students: studentsRes.data as StudentWithClass[], attendance: attendanceRes.data, classes: classesRes.data };
    };

    const handleExport = async () => {
        setIsExporting(true);
        toast.info(`Membuat laporan, ini mungkin memakan waktu...`);
        try {
            const data = await fetchMonthAttendanceData(exportMonth);
            if (!data || !data.students || data.students.length === 0) {
                toast.warning("Tidak ada data untuk bulan yang dipilih.");
                return;
            }
    
            const { students, attendance, classes } = data;
            const doc = new jsPDF({ orientation: 'landscape' });
            const [year, monthNum] = exportMonth.split('-').map(Number);
            const monthName = new Date(year, monthNum - 1).toLocaleString('id-ID', { month: 'long' });
            const daysInMonth = new Date(year, monthNum, 0).getDate();
            const pageHeight = doc.internal.pageSize.getHeight();
            const pageWidth = doc.internal.pageSize.getWidth();
    
            const studentsByClass = classes.map(c => ({
                ...c,
                students: students.filter(s => s.class_id === c.id).sort((a,b) => a.name.localeCompare(b.name))
            })).filter(c => c.students.length > 0);
            
            let isFirstClass = true;
    
            for (const classData of studentsByClass) {
                if (!isFirstClass) doc.addPage('landscape');
                isFirstClass = false;
                
                let yPos = 20;
    
                // --- HEADER ---
                doc.setFontSize(18);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor('#4f46e5');
                doc.text('Laporan Absensi Bulanan', 14, yPos);
                
                doc.setFontSize(12);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor('#374151');
                yPos += 10;
                doc.text(`Kelas: ${classData.name}`, 14, yPos);
                yPos += 8;
                doc.text(`Periode: ${monthName} ${year}`, 14, yPos);
                yPos += 15;
    
                // --- SUMMARY ---
                const classAttendance = attendance.filter(a => classData.students.some(s => s.id === a.student_id));
                const summary = { H: 0, S: 0, I: 0, A: 0 };
                classAttendance.forEach(rec => {
                    if (rec.status === 'Hadir') summary.H++;
                    else if (rec.status === 'Sakit') summary.S++;
                    else if (rec.status === 'Izin') summary.I++;
                    else if (rec.status === 'Alpha') summary.A++;
                });
    
                doc.setFontSize(10);
                const summaryColors: Record<string, string> = { H: '#22c55e', S: '#3b82f6', I: '#f59e0b', A: '#ef4444' };
                const summaryLabels: Record<string, string> = { H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alpha' };
                let xPos = 14;
                Object.entries(summary).forEach(([key, value]) => {
                    doc.setFillColor(summaryColors[key]);
                    doc.roundedRect(xPos, yPos - 4, 18, 10, 2, 2, 'F');
                    doc.setTextColor('#1f2937');
                    doc.text(`${summaryLabels[key]}: ${value}`, xPos + 22, yPos + 3);
                    xPos += 65;
                });
                yPos += 15;
    
                // --- TABLE LOGIC ---
                const head = [['No', 'Nama Siswa', ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1))]];
                const body = classData.students.map((student, index) => {
                    const row = [String(index + 1), student.name];
                    for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const record = attendance.find(a => a.student_id === student.id && a.date === dateStr);
                        const statusChar = record ? { Hadir: 'H', Sakit: 'S', Izin: 'I', Alpha: 'A' }[record.status] || '' : '';
                        row.push(statusChar);
                    }
                    return row;
                });
    
                const splitDay = 16;
                const head1 = [head[0].slice(0, 2 + splitDay)];
                const body1 = body.map(row => row.slice(0, 2 + splitDay));
                
                const tableOptions: any = {
                    theme: 'grid',
                    headStyles: { fillColor: '#4f46e5', textColor: '#ffffff', fontStyle: 'bold', halign: 'center' },
                    alternateRowStyles: { fillColor: '#f3f4f6' },
                    styles: { fontSize: 7, cellPadding: 1.5, lineColor: '#d1d5db', lineWidth: 0.5 },
                    columnStyles: {
                        0: { cellWidth: 10, halign: 'center' },
                        1: { cellWidth: 70, fontStyle: 'bold' },
                    },
                    didDrawCell: (data: any) => {
                        const statusColors: Record<string, string> = { 'S': '#3b82f6', 'I': '#f59e0b', 'A': '#ef4444' };
                        const cellText = data.cell.text[0];
                        if (data.column.index > 1 && statusColors[cellText]) {
                            doc.setFillColor(statusColors[cellText]);
                            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                            doc.setTextColor('#ffffff');
                            doc.text(cellText, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2, { align: 'center', baseline: 'middle' });
                        }
                    }
                };
                
                autoTable(doc, { ...tableOptions, head: head1, body: body1, startY: yPos });
    
                if (daysInMonth > splitDay) {
                    const head2 = [head[0].slice(0, 2).concat(head[0].slice(2 + splitDay))];
                    const body2 = body.map(row => row.slice(0, 2).concat(row.slice(2 + splitDay)));
                    doc.addPage('landscape');
                    autoTable(doc, { ...tableOptions, head: head2, body: body2, startY: 20 });
                }
                
                // --- LEGEND ---
                let finalY = (doc as any).lastAutoTable.finalY;
                if (finalY + 30 > pageHeight) {
                    doc.addPage('landscape');
                    finalY = 10;
                }
                
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.text("Keterangan", 14, finalY + 15);
                let legendX = 14;
                const legendItems = { 'H: Hadir': '#16a34a', 'S: Sakit': '#3b82f6', 'I: Izin': '#f59e0b', 'A: Alpha': '#ef4444' };
                Object.entries(legendItems).forEach(([text, color]) => {
                    doc.setFillColor(color);
                    doc.rect(legendX, finalY + 20, 5, 5, 'F');
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor('#374151');
                    doc.text(text, legendX + 8, finalY + 24);
                    legendX += 45;
                });
            }
    
            // --- FOOTER ON ALL PAGES ---
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor('#6b7280');
                doc.text(`Laporan dibuat pada ${new Date().toLocaleDateString('id-ID')}`, 14, pageHeight - 10);
                doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
            }
    
            doc.save(`Absensi_${exportMonth}.pdf`);
            toast.success(`Laporan berhasil diunduh!`);
        } catch (error: any) {
            toast.error(`Gagal membuat laporan: ${error.message}`);
        } finally {
            setIsExporting(false);
        }
    };


    const handleAnalyzeAttendance = async () => {
        if (!students || students.length === 0) {
            toast.warning('Pilih kelas dengan siswa terlebih dahulu.'); return;
        }
        setIsAiModalOpen(true); setIsAiLoading(true); setAiAnalysisResult(null);

        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const { data: attendanceData, error } = await supabase
                .from('attendance').select('student_id, date, status, students(name)')
                .in('student_id', students.map(s => s.id))
                .gte('date', thirtyDaysAgo);
            if (error) throw error;
            
            const systemInstruction = `Anda adalah asisten analisis data untuk guru. Analisis data kehadiran JSON yang diberikan, yang mencakup 30 hari terakhir. Berikan wawasan dalam format JSON yang valid dan sesuai dengan skema. Fokus pada identifikasi siswa dengan kehadiran sempurna, siswa yang sering absen, dan pola absensi yang tidak biasa.`;
            const prompt = `Analisis data kehadiran berikut: ${JSON.stringify(attendanceData)}`;
            const responseSchema = { type: Type.OBJECT, properties: { perfect_attendance: { type: Type.ARRAY, description: "Nama siswa dengan kehadiran 100% (tidak ada Izin, Sakit, atau Alpha).", items: { type: Type.STRING } }, frequent_absentees: { type: Type.ARRAY, description: "Siswa dengan 3 atau lebih status 'Alpha'.", items: { type: Type.OBJECT, properties: { student_name: { type: Type.STRING }, absent_days: { type: Type.NUMBER } } } }, pattern_warnings: { type: Type.ARRAY, description: "Pola absensi yang tidak biasa atau mengkhawatirkan.", items: { type: Type.OBJECT, properties: { pattern_description: { type: Type.STRING, description: "cth., 'Tingkat absensi (Alpha) tinggi pada hari Senin.'" }, implicated_students: { type: Type.ARRAY, description: "Siswa yang terkait dengan pola ini.", items: { type: Type.STRING } } } } } } };

            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction, responseMimeType: "application/json", responseSchema } });
            setAiAnalysisResult(JSON.parse(response.text));
        } catch (err: any) {
            toast.error("Gagal menganalisis data kehadiran.");
            console.error(err);
        } finally {
            setIsAiLoading(false);
        }
    };

    const inputStyles = "bg-white/10 border-white/20 placeholder:text-gray-400 text-white focus:bg-white/20 focus:border-purple-400";

    return (
        <div className="w-full min-h-full p-4 sm:p-6 md:p-8 relative text-white flex flex-col">
            <div className="holographic-orb-container" style={{ top: '-40px', width: '120px', height: '120px', opacity: 0.7 }}>
                <div className="holographic-orb">
                    <div className="orb-glow"></div>
                    <div className="orb-core"></div>
                    <div className="orb-ring orb-ring-1"></div>
                    <div className="orb-ring orb-ring-2"></div>
                </div>
            </div>

            <header className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Pendataan Absensi</h1>
                    <p className="mt-1 text-indigo-200">Kelola kehadiran siswa dengan mudah dan futuristik.</p>
                </div>
                <div className="flex gap-2 self-end md:self-center">
                    <Button onClick={handleAnalyzeAttendance} variant="outline" disabled={!isOnline} className={`bg-white/10 border-white/20 hover:bg-white/20 ${!isOnline && 'opacity-50'}`}><BrainCircuitIcon className="w-4 h-4 mr-2 text-purple-400"/>Analisis AI</Button>
                    <Button onClick={() => setIsExportModalOpen(true)} variant="outline" className={`bg-white/10 border-white/20 hover:bg-white/20`}><DownloadCloudIcon className="w-4 h-4 mr-2"/>Export</Button>
                </div>
            </header>

            <div className="relative z-10 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div><label htmlFor="class-select" className="block text-sm font-medium mb-1 text-gray-200">Pilih Kelas</label><Select id="class-select" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} disabled={isLoadingClasses} className={inputStyles}><option value="" disabled className="bg-gray-900">-- Pilih Kelas --</option>{classes?.map(c => <option key={c.id} value={c.id} className="bg-gray-800 text-white">{c.name}</option>)}</Select></div>
                <div><label htmlFor="date-select" className="block text-sm font-medium mb-1 text-gray-200">Tanggal</label><Input id="date-select" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={inputStyles}/></div>
            </div>

            <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {statusOptions.map(({ value, label, icon: Icon, color }) => {
                    const styles = statusStyles[color];
                    return (
                        <div key={value} onClick={() => setQuickMarkStatus(quickMarkStatus === value ? null : value)}
                            className={`p-4 rounded-xl flex items-center gap-3 cursor-pointer transition-all duration-300 transform-gpu bg-black/20 border-2 ${quickMarkStatus === value ? styles.active : 'border-white/20'} ${styles.hover} hover:-translate-y-1`}>
                            <Icon className={`w-6 h-6 ${styles.icon}`}/>
                            <div><p className="font-bold text-white">{label}</p><p className="text-xs text-gray-400">{attendanceSummary[value]} siswa</p></div>
                        </div>
                    );
                })}
            </div>

            <main className="relative z-10 flex-grow bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                    <h3 className="font-semibold text-lg text-white">Daftar Siswa ({students?.length || 0})</h3>
                    <Button onClick={markRestAsPresent} size="sm" variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20" disabled={unmarkedStudents.length === 0}>Tandai Sisa Hadir ({unmarkedStudents.length})</Button>
                </div>
                
                <div className="flex-grow overflow-y-auto">
                    {isLoadingStudents ? <div className="p-8 text-center">Memuat daftar siswa...</div> :
                     !students || students.length === 0 ? <div className="p-8 text-center text-gray-400">Pilih kelas untuk memulai absensi.</div> :
                     <div className="divide-y divide-white/10">
                        {students.map((student, index) => {
                            const record = attendanceRecords[student.id];
                            return (
                                <div key={student.id} onClick={() => handleQuickMark(student.id)} className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center cursor-pointer hover:bg-white/5">
                                    <div className="flex items-center gap-4 col-span-1 md:col-span-1">
                                        <span className="text-sm font-mono text-gray-400 w-6 text-center">{index + 1}.</span>
                                        <img src={student.avatar_url} alt={student.name} className="w-10 h-10 rounded-full object-cover"/>
                                        <p className="font-semibold text-white">{student.name}</p>
                                    </div>

                                    <div className="col-span-1 md:col-span-2 flex flex-col md:flex-row items-stretch md:items-center gap-2 md:pl-10">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-grow">
                                            {statusOptions.map(opt => {
                                                const btnStyles = buttonStatusStyles[opt.color];
                                                return (
                                                <button key={opt.value} onClick={(e) => { e.stopPropagation(); handleStatusChange(student.id, opt.value); }}
                                                    className={`px-3 py-2 text-sm rounded-lg flex items-center justify-center gap-2 transition-all border-2 ${record?.status === opt.value ? `${btnStyles.active} text-white` : `bg-white/5 border-transparent text-gray-300 ${btnStyles.hover}`}`}>
                                                    <opt.icon className="w-4 h-4"/>
                                                    <span>{opt.label}</span>
                                                </button>
                                            )})}
                                        </div>
                                        {(record?.status === AttendanceStatus.Izin || record?.status === AttendanceStatus.Sakit) &&
                                            <div className="relative flex-grow md:max-w-xs animate-fade-in">
                                                <PencilIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                                <Input value={record.note || ''} onChange={(e) => handleNoteChange(student.id, e.target.value)} onClick={e => e.stopPropagation()} placeholder="Tambah catatan..." className="pl-9 h-10 bg-white/10 border-white/20"/>
                                            </div>
                                        }
                                    </div>
                                </div>
                            );
                        })}
                     </div>
                    }
                </div>
            </main>
            
            <footer className="relative z-10 mt-6 flex justify-end">
                <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-500 text-white font-semibold shadow-lg hover:shadow-blue-500/40 transition-all duration-300 hover:-translate-y-0.5">
                    {isSaving ? 'Menyimpan...' : (isOnline ? 'Simpan Absensi' : 'Simpan Offline')}
                </Button>
            </footer>
            
            <Modal title="Analisis Kehadiran AI" isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} icon={<BrainCircuitIcon className="h-5 w-5"/>}>
                {isAiLoading ? <div className="text-center py-8">Menganalisis data...</div> : aiAnalysisResult ? (
                    <div className="space-y-4 text-sm">
                        {aiAnalysisResult.perfect_attendance.length > 0 && <div><h4 className="font-bold text-green-500">Kehadiran Sempurna</h4><p>{aiAnalysisResult.perfect_attendance.join(', ')}</p></div>}
                        {aiAnalysisResult.frequent_absentees.length > 0 && <div><h4 className="font-bold text-yellow-500">Sering Alpha</h4><ul>{aiAnalysisResult.frequent_absentees.map(s => <li key={s.student_name}>{s.student_name} ({s.absent_days} hari)</li>)}</ul></div>}
                        {aiAnalysisResult.pattern_warnings.length > 0 && <div><h4 className="font-bold text-red-500">Pola Terdeteksi</h4><ul>{aiAnalysisResult.pattern_warnings.map(p => <li key={p.pattern_description}>{p.pattern_description} (Siswa: {p.implicated_students.join(', ')})</li>)}</ul></div>}
                    </div>
                ) : <div className="text-center py-8">Tidak ada hasil.</div>}
            </Modal>
            <Modal title="Export Laporan Absensi" isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)}>
                 <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Pilih bulan dan tahun untuk mengekspor laporan absensi ke format PDF.</p>
                    <div>
                        <label htmlFor="export-month" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bulan & Tahun</label>
                        <Input id="export-month" type="month" value={exportMonth} onChange={e => setExportMonth(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsExportModalOpen(false)} disabled={isExporting}>Batal</Button>
                        <Button type="button" onClick={handleExport} disabled={isExporting}>{isExporting ? 'Mengekspor...' : 'Unduh PDF'}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default AttendancePage;
