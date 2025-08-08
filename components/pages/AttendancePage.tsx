import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AttendanceStatus } from '../../types';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { CheckCircleIcon, XCircleIcon, AlertCircleIcon, DownloadCloudIcon } from '../Icons';
import { useToast } from '../../hooks/useToast';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Database } from '../../services/database.types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';

type ClassRow = Database['public']['Tables']['classes']['Row'];
type StudentRow = Database['public']['Tables']['students']['Row'];
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];

type StudentWithClass = StudentRow & { classes: Pick<ClassRow, 'name'> | null };

const statusOptions = [
    { value: AttendanceStatus.Hadir, label: 'Hadir', icon: CheckCircleIcon, color: 'text-green-500', selectedClass: 'bg-green-500/10 border-green-500' },
    { value: AttendanceStatus.Izin, label: 'Izin', icon: AlertCircleIcon, color: 'text-yellow-500', selectedClass: 'bg-yellow-500/10 border-yellow-500' },
    { value: AttendanceStatus.Sakit, label: 'Sakit', icon: AlertCircleIcon, color: 'text-blue-500', selectedClass: 'bg-blue-500/10 border-blue-500' },
    { value: AttendanceStatus.Alpha, label: 'Alpha', icon: XCircleIcon, color: 'text-red-500', selectedClass: 'bg-red-500/10 border-red-500' },
];

const statusStyles: Record<AttendanceStatus, { bgColor: string; borderColor: string; }> = {
    [AttendanceStatus.Hadir]: { bgColor: 'bg-green-500/10 dark:bg-green-900/20', borderColor: 'border-green-500' },
    [AttendanceStatus.Izin]: { bgColor: 'bg-yellow-500/10 dark:bg-yellow-900/20', borderColor: 'border-yellow-500' },
    [AttendanceStatus.Sakit]: { bgColor: 'bg-blue-500/10 dark:bg-blue-900/20', borderColor: 'border-blue-500' },
    [AttendanceStatus.Alpha]: { bgColor: 'bg-red-500/10 dark:bg-red-900/20', borderColor: 'border-red-500' },
};

const AttendanceStatusSelector: React.FC<{ studentId: string; selectedStatus?: AttendanceStatus; onSelect: (status: AttendanceStatus) => void; }> = ({ studentId, selectedStatus, onSelect }) => {
    return (
        <div className="flex flex-wrap justify-center gap-2">
            {statusOptions.map(({ value, label, icon: Icon, color, selectedClass }) => (
                <button
                    key={value}
                    onClick={() => onSelect(value)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-all duration-200 text-sm font-medium ${
                        selectedStatus === value
                            ? `${selectedClass} ${color}`
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                </button>
            ))}
        </div>
    );
};

const AttendancePage: React.FC = () => {
    const toast = useToast();
    const location = useLocation();
    const queryClient = useQueryClient();
    const locationState = location.state as { filterStatus?: AttendanceStatus } | null;
    const { user } = useAuth();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isOnline = useOfflineStatus();

    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>(today);
    const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceStatus>>({});
    const [quickMarkStatus, setQuickMarkStatus] = useState<AttendanceStatus | null>(locationState?.filterStatus || null);

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportMonth, setExportMonth] = useState(new Date().toISOString().slice(0, 7));
    const [isExporting, setIsExporting] = useState(false);

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

    const { data: pageData, isLoading: isLoadingPageData } = useQuery({
        queryKey: ['attendanceData', selectedClass, selectedDate],
        queryFn: async () => {
            if (!selectedClass || !user) return { students: [], attendance: {} };
            const { data: studentsData, error: studentsError } = await supabase.from('students').select('*').eq('class_id', selectedClass).eq('user_id', user.id).order('name', { ascending: true });
            if (studentsError) throw studentsError;

            const fetchedStudents = studentsData || [];
            let existingRecords: Record<string, AttendanceStatus> = {};
            if (fetchedStudents.length > 0) {
                const { data: attendanceData, error: attendanceError } = await supabase.from('attendance').select('*').eq('date', selectedDate).in('student_id', fetchedStudents.map(s => s.id));
                if (attendanceError) throw attendanceError;
                existingRecords = (attendanceData || []).reduce((acc, record: AttendanceRow) => {
                    acc[record.student_id] = record.status;
                    return acc;
                }, {} as Record<string, AttendanceStatus>);
            }
            return { students: fetchedStudents, attendance: existingRecords };
        },
        enabled: !!selectedClass && !!user
    });
    
    useEffect(() => {
        if (pageData) {
            setAttendanceRecords(pageData.attendance);
        }
    }, [pageData]);

    const { mutate: saveAttendance, isPending: isSaving } = useMutation({
        mutationFn: async (recordsToUpsert: Database['public']['Tables']['attendance']['Insert'][]) => {
            const { error } = await supabase.from('attendance').upsert(recordsToUpsert, { onConflict: 'student_id, date' });
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Absensi berhasil disimpan!');
            queryClient.invalidateQueries({ queryKey: ['attendanceData', selectedClass, selectedDate] });
            queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
        },
        onError: (error: Error) => {
            toast.error(`Gagal menyimpan absensi: ${error.message}`);
        }
    });

    const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
        setAttendanceRecords(prev => ({ ...prev, [studentId]: status }));
    };

    const handleQuickMarkSelect = (studentId: string) => {
        if (quickMarkStatus) {
            handleStatusChange(studentId, quickMarkStatus);
        }
    }

    const students = pageData?.students || [];
    const markedStudentsCount = Object.keys(attendanceRecords).length;
    const totalStudents = students.length;
    const progress = totalStudents > 0 ? (markedStudentsCount / totalStudents) * 100 : 0;
    
    const attendanceSummary = useMemo(() => {
        return Object.values(attendanceRecords).reduce((acc, status) => {
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {} as Record<AttendanceStatus, number>);
    }, [attendanceRecords]);

    const markAllPresent = () => {
        const allPresent = students.reduce((acc, student) => {
            acc[student.id] = AttendanceStatus.Hadir;
            return acc;
        }, {} as Record<string, AttendanceStatus>);
        setAttendanceRecords(allPresent);
    };

    const handleSave = () => {
        if (markedStudentsCount < totalStudents) {
            toast.warning('Harap tandai semua siswa sebelum menyimpan.');
            return;
        }
        if (!user) return;
        
        const recordsToUpsert: Database['public']['Tables']['attendance']['Insert'][] = Object.entries(attendanceRecords).map(([student_id, status]) => ({
            student_id,
            date: selectedDate,
            status,
            user_id: user.id
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

        if (studentsRes.error) throw studentsRes.error;
        if (attendanceRes.error) throw attendanceRes.error;
        if (classesRes.error) throw classesRes.error;

        return { students: studentsRes.data as StudentWithClass[], attendance: attendanceRes.data, classes: classesRes.data };
    };

    const processAttendanceForExport = (students: StudentWithClass[], attendance: AttendanceRow[], classes: ClassRow[], month: string) => {
        const [year, monthNum] = month.split('-').map(Number);
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        const classMap = new Map(classes.map(c => [c.id, c.name]));
    
        const studentsWithAttendance = students.map(student => {
            const studentAttendance = attendance.filter(a => a.student_id === student.id);
            const attendanceByDay: { [key: number]: string } = {};
            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const record = studentAttendance.find(a => a.date === dateStr);
                attendanceByDay[i] = record ? record.status[0] : '-'; // H, I, S, A, or -
            }
    
            const summary = { Hadir: 0, Izin: 0, Sakit: 0, Alpha: 0 };
            studentAttendance.forEach(record => { if (summary[record.status] !== undefined) { summary[record.status]++; } });
    
            return {
                id: student.id, name: student.name,
                className: classMap.get(student.class_id) || 'N/A',
                attendanceByDay, summary,
            };
        });
        return studentsWithAttendance.sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name));
    };

    const statusColorsForPdf: Record<string, [number, number, number]> = { H: [46, 204, 113], I: [241, 196, 15], S: [52, 152, 219], A: [231, 76, 60] };

    const handleExport = async (type: 'pdf' | 'csv') => {
        setIsExporting(true);
        toast.info(`Membuat laporan ${type.toUpperCase()}, ini mungkin memakan waktu beberapa saat...`);
        
        try {
            const data = await fetchMonthAttendanceData(exportMonth);
            if (!data || !data.students || data.students.length === 0) {
                toast.warning("Tidak ada data siswa untuk bulan yang dipilih.");
                setIsExporting(false); return;
            }
            const processedData = processAttendanceForExport(data.students, data.attendance, data.classes, exportMonth);
            const [year, monthNum] = exportMonth.split('-').map(Number);
            const monthName = new Date(year, monthNum - 1).toLocaleString('id-ID', { month: 'long' });
            const daysInMonth = new Date(year, monthNum, 0).getDate();

            if (type === 'pdf') {
                const doc = new jsPDF({ orientation: 'landscape' });
                doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.text(`Laporan Absensi Bulanan`, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
                doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.text(`${monthName} ${year}`, doc.internal.pageSize.getWidth() / 2, 28, { align: 'center' });

                const totalHadir = processedData.reduce((sum, s) => sum + s.summary.Hadir, 0);
                const totalPossibleDays = processedData.length * daysInMonth; // Approximation
                const attendanceRate = totalPossibleDays > 0 ? ((totalHadir / totalPossibleDays) * 100).toFixed(1) : 'N/A';
                doc.setFontSize(10); doc.text(`Total Siswa: ${processedData.length}`, 14, 20); doc.text(`Tingkat Kehadiran: ~${attendanceRate}%`, 14, 26);

                const head = [['No', 'Nama Siswa', 'Kelas', ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1)), 'H', 'I', 'S', 'A']];
                const body = processedData.map((student, index) => [index + 1, student.name, student.className, ...Object.values(student.attendanceByDay), student.summary.Hadir, student.summary.Izin, student.summary.Sakit, student.summary.Alpha]);

                autoTable(doc, {
                    startY: 35, head: head, body: body, theme: 'grid',
                    headStyles: { fillColor: [44, 62, 80], textColor: 255 },
                    styles: { fontSize: 6.5, cellPadding: 1, halign: 'center' },
                    columnStyles: { 1: { halign: 'left', cellWidth: 35 }, 2: { halign: 'left', cellWidth: 15 }, 0: { cellWidth: 8 } },
                    didDrawCell: (data) => {
                        if (data.section === 'body' && data.column.index >= 3 && data.column.index < 3 + daysInMonth) {
                            const status = data.cell.text[0]; // raw value is an array of strings
                            if (status in statusColorsForPdf) {
                                doc.setFillColor(...statusColorsForPdf[status]);
                                doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                            }
                        }
                    }
                });
                doc.save(`Absensi_${monthName}_${year}.pdf`);
            } else { // CSV
                const header = ['Nama Siswa', 'Kelas', ...Array.from({ length: daysInMonth }, (_, i) => `Tgl ${i + 1}`), 'Total Hadir', 'Total Izin', 'Total Sakit', 'Total Alpha'];
                const rows = processedData.map(s => [`"${s.name}"`, `"${s.className}"`, ...Object.values(s.attendanceByDay), s.summary.Hadir, s.summary.Izin, s.summary.Sakit, s.summary.Alpha].join(','));
                const csvContent = "data:text/csv;charset=utf-8," + [header.join(','), ...rows].join('\n');
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `Absensi_${monthName}_${year}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            toast.success(`Laporan ${type.toUpperCase()} berhasil diunduh!`);
        } catch (error: any) {
            toast.error(`Gagal membuat laporan: ${error.message}`);
        } finally {
            setIsExporting(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-700 to-slate-800 text-white shadow-xl shadow-purple-500/20 animate-fade-in-up">
                <h2 className="text-3xl font-bold">Pendataan Absensi</h2>
                <p className="mt-2 text-indigo-200 max-w-2xl">Pilih kelas dan tanggal untuk memulai, lalu tandai status kehadiran setiap siswa.</p>
                <div className="flex flex-col md:flex-row items-end gap-4 pt-4 mt-4 border-t border-white/20">
                    <div className="flex-1 w-full">
                        <label htmlFor="class-select" className="block text-sm font-medium text-indigo-200 mb-1">Pilih Kelas</label>
                        <Select id="class-select" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="bg-white/10 border-white/20 placeholder-indigo-100 text-white dark:bg-white/10 dark:border-white/20" disabled={isLoadingClasses}>
                            {classes?.map(c => <option key={c.id} value={c.id} className="bg-gray-800 text-white">{c.name}</option>)}
                        </Select>
                    </div>
                    <div className="flex-1 w-full">
                        <label htmlFor="date-select" className="block text-sm font-medium text-indigo-200 mb-1">Tanggal</label>
                        <Input id="date-select" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-white/10 border-white/20 placeholder-indigo-100 text-white dark:bg-white/10 dark:border-white/20" />
                    </div>
                    <div className="flex-shrink-0 w-full md:w-auto">
                        <Button variant="outline" onClick={() => setIsExportModalOpen(true)} className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm w-full h-10" disabled={!isOnline} title={!isOnline ? "Export requires an internet connection." : ""}>
                            <DownloadCloudIcon className="w-4 h-4 mr-2" />
                            Export Laporan
                        </Button>
                    </div>
                </div>
            </div>
            
            <Card className="animate-fade-in-up animation-delay-200">
                <CardHeader>
                    <CardTitle>Mode Penandaan Cepat</CardTitle>
                    <CardDescription>Pilih status di bawah, lalu klik siswa untuk menandainya dengan status tersebut.</CardDescription>
                    <div className="flex flex-wrap gap-2 mt-4">
                        {statusOptions.map(({ value, label, icon: Icon, color }) => (
                            <Button key={value} variant={quickMarkStatus === value ? 'default' : 'outline'} onClick={() => setQuickMarkStatus(quickMarkStatus === value ? null : value)} className={`transition-all ${quickMarkStatus === value ? 'ring-2 ring-offset-2 dark:ring-offset-gray-900 ring-blue-500' : ''}`}>
                                <Icon className={`w-4 h-4 mr-2 ${color}`} /> {label}
                            </Button>
                        ))}
                    </div>
                    {quickMarkStatus && <p className="text-sm font-semibold mt-3 text-blue-600 dark:text-blue-400">Mode Cepat Aktif: Klik pada siswa untuk menandai sebagai "{quickMarkStatus}".</p>}
                </CardHeader>
            </Card>

            <Card className="animate-fade-in-up animation-delay-300">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                            <CardTitle>Daftar Siswa - {classes?.find(c => c.id === selectedClass)?.name || 'Pilih kelas'}</CardTitle>
                             <div className="flex items-center gap-x-4 gap-y-2 flex-wrap mt-2 text-sm text-gray-600 dark:text-gray-400">
                                {statusOptions.map(opt => (
                                    <div key={opt.value} className="flex items-center gap-2">
                                        <opt.icon className={`w-4 h-4 ${opt.color}`}/>
                                        <span>{opt.label}: <strong className="text-gray-800 dark:text-gray-200">{attendanceSummary[opt.value] || 0}</strong></span>
                                    </div>
                                ))}
                             </div>
                        </div>
                        <Button variant="outline" onClick={markAllPresent}>
                            <CheckCircleIcon className="w-4 h-4 mr-2" />
                            Tandai Semua Hadir
                        </Button>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mt-4">
                        <div className="bg-gradient-to-r from-sky-400 to-fuchsia-500 h-3 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoadingPageData ? (
                         <div className="text-center p-10">Memuat data siswa...</div>
                    ) : (
                        <div className="space-y-3">
                            {students.map(student => {
                                const status = attendanceRecords[student.id];
                                const styles = status ? statusStyles[status] : null;

                                return (
                                    <div 
                                        key={student.id} 
                                        onClick={() => handleQuickMarkSelect(student.id)}
                                        className={`p-3 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300 border-l-4 transform-gpu ${
                                            styles ? `${styles.bgColor} ${styles.borderColor} shadow-md` : 'bg-gray-50 dark:bg-gray-800/50 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700/50'
                                        } ${quickMarkStatus ? 'cursor-pointer animate-subtle-pop' : ''} hover:shadow-xl hover:scale-[1.02]`}
                                    >
                                        <div className="flex items-center font-medium w-full md:w-auto">
                                            <img src={student.avatar_url} alt={student.name} className="w-10 h-10 rounded-full mr-4" />
                                            <span className="text-gray-800 dark:text-gray-200">{student.name}</span>
                                        </div>
                                        <AttendanceStatusSelector studentId={student.id} selectedStatus={attendanceRecords[student.id]} onSelect={(status) => handleStatusChange(student.id, status)} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="mt-6 flex justify-end">
                        <Button 
                            onClick={handleSave} 
                            disabled={isSaving || markedStudentsCount < totalStudents || isLoadingPageData || !isOnline}
                            title={!isOnline ? "You are offline. Cannot save attendance." : ""}
                            className="bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white font-semibold transition-all duration-300 hover:-translate-y-0.5 shadow-lg shadow-blue-500/30 disabled:shadow-none disabled:transform-none"
                        >
                            {isSaving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>}
                            {isSaving ? 'Menyimpan...' : 'Simpan Absensi'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Export Laporan Absensi" icon={<DownloadCloudIcon className="h-5 w-5"/>}>
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Pilih bulan dan tahun untuk laporan absensi yang ingin Anda unduh.</p>
                    <div>
                        <label htmlFor="export-month" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bulan & Tahun</label>
                        <Input id="export-month" type="month" value={exportMonth} onChange={(e) => setExportMonth(e.target.value)} disabled={isExporting} />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsExportModalOpen(false)} disabled={isExporting}>Batal</Button>
                        <Button type="button" onClick={() => handleExport('csv')} disabled={isExporting || !isOnline}>
                            {isExporting ? '...' : 'Export CSV'}
                        </Button>
                        <Button type="button" onClick={() => handleExport('pdf')} disabled={isExporting || !isOnline}>
                            {isExporting ? 'Memproses...' : 'Export PDF'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default AttendancePage;