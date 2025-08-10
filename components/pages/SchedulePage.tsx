import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TrashIcon, PlusIcon, ClockIcon, PencilIcon, CalendarIcon, BookOpenIcon, GraduationCapIcon, BrainCircuitIcon, DownloadCloudIcon } from '../Icons';
import { Modal } from '../ui/Modal';
import { GoogleGenAI, Type } from '@google/genai';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Database } from '../../services/database.types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import jsPDF from 'jspdf';
import LoadingSpinner from '../LoadingSpinner';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const daysOfWeek: Database['public']['Tables']['schedules']['Row']['day'][] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
type ScheduleRow = Database['public']['Tables']['schedules']['Row'];

const dayStyles: Record<string, { gradient: string, shadow: string, gridHeader: string }> = {
    Senin:  { gradient: 'from-blue-500 to-cyan-400',       shadow: 'shadow-blue-500/30', gridHeader: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200' },
    Selasa: { gradient: 'from-emerald-500 to-green-400',    shadow: 'shadow-emerald-500/30', gridHeader: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200' },
    Rabu:   { gradient: 'from-amber-500 to-yellow-400',    shadow: 'shadow-amber-500/30', gridHeader: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200' },
    Kamis:  { gradient: 'from-violet-500 to-purple-400',   shadow: 'shadow-violet-500/30', gridHeader: 'bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200' },
    Jumat:  { gradient: 'from-rose-500 to-red-400',          shadow: 'shadow-rose-500/30', gridHeader: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200' },
};

const FormInputWrapper: React.FC<{ children: React.ReactNode; label: string; icon: React.FC<any> }> = ({ children, label, icon: Icon }) => (
    <div>
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{label}</label>
        <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Icon className="h-5 w-5 text-gray-400" />
            </div>
            {children}
        </div>
    </div>
);

const SchedulePage: React.FC = () => {
    const { user } = useAuth();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isOnline = useOfflineStatus();
    
    const [modalState, setModalState] = useState<{ isOpen: boolean; mode: 'add' | 'edit'; data: ScheduleRow | null }>({ isOpen: false, mode: 'add', data: null });
    const [formData, setFormData] = useState<Omit<Database['public']['Tables']['schedules']['Insert'], 'id' | 'created_at' | 'user_id'>>({ day: 'Senin', start_time: '08:00', end_time: '09:30', subject: '', class_id: '' });
    
    const [isAnalysisModalOpen, setAnalysisModalOpen] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [isAnalysisLoading, setAnalysisLoading] = useState(false);

    const { data: schedule = [], isLoading: pageLoading, isError, error: queryError } = useQuery({
        queryKey: ['schedule', user?.id],
        queryFn: async (): Promise<ScheduleRow[]> => {
            const { data, error } = await supabase.from('schedules').select('*').eq('user_id', user!.id).order('day').order('start_time');
            if (error) throw error;
            return data || [];
        },
        enabled: !!user,
    });
    
    useEffect(() => {
        if (isError) {
            toast.error(`Gagal memuat jadwal: ${(queryError as Error).message}`);
        }
    }, [isError, queryError, toast]);

    const scheduleMutation = useMutation({
        mutationFn: async (scheduleData: { mode: 'add' | 'edit'; data: Database['public']['Tables']['schedules']['Insert'] | Database['public']['Tables']['schedules']['Update']; id?: string }) => {
            if (scheduleData.mode === 'add') {
                const { error } = await supabase.from('schedules').insert(scheduleData.data as Database['public']['Tables']['schedules']['Insert']);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('schedules').update(scheduleData.data).eq('id', scheduleData.id!);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedule', user?.id] });
            toast.success("Jadwal berhasil disimpan!");
            handleCloseModal();
        },
        onError: (error: Error) => {
            toast.error(error.message);
        }
    });

    const deleteScheduleMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('schedules').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedule', user?.id] });
            toast.success("Jadwal berhasil dihapus.");
        },
        onError: (error: Error) => toast.error(error.message)
    });

    const handleOpenAddModal = () => { setFormData({ day: 'Senin', start_time: '08:00', end_time: '09:30', subject: '', class_id: '' }); setModalState({ isOpen: true, mode: 'add', data: null }); };
    const handleOpenEditModal = (item: ScheduleRow) => { setFormData({ day: item.day, start_time: item.start_time, end_time: item.end_time, subject: item.subject, class_id: item.class_id }); setModalState({ isOpen: true, mode: 'edit', data: item }); };
    const handleCloseModal = () => { if (scheduleMutation.isPending) return; setModalState({ isOpen: false, mode: 'add', data: null }); };
    
    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user) return;
        
        if (modalState.mode === 'add') {
            scheduleMutation.mutate({ mode: 'add', data: { ...formData, user_id: user.id } });
        } else if (modalState.data) {
            scheduleMutation.mutate({ mode: 'edit', data: formData, id: modalState.data.id });
        }
    };

    const handleDeleteSchedule = (id: string) => {
        if (window.confirm('Apakah Anda yakin ingin menghapus jadwal ini?')) {
            deleteScheduleMutation.mutate(id);
        }
    };
    
    const handleAnalyzeSchedule = async () => {
        setAnalysisModalOpen(true); setAnalysisLoading(true); setAnalysisResult(null);
        const systemInstruction = `Anda adalah seorang analis efisiensi jadwal. Tugas Anda adalah menemukan potensi masalah dan peluang optimasi dalam jadwal guru. Jawaban Anda harus dalam format JSON yang sesuai dengan skema yang diberikan. Format teks di dalam JSON harus menggunakan markdown (e.g., '**Teks Tebal**').`;
        const prompt = `Analisis data jadwal JSON berikut dan berikan wawasan. Fokus pada: 1. Konflik Jadwal: Identifikasi jika ada jadwal yang tumpang tindih. Jika tidak ada, sebutkan itu. 2. Hari Terpadat: Tentukan hari mana yang memiliki sesi pelajaran terbanyak dan paling sedikit. 3. Saran Optimasi: Berikan saran untuk mendistribusikan beban kerja secara lebih merata jika perlu. Judul saran (seperti 'Perataan Beban Kerja') harus ditebalkan. Data Jadwal: ${JSON.stringify(schedule)}`;
        const responseSchema = { type: Type.OBJECT, properties: { sections: { type: Type.ARRAY, description: "Array berisi bagian-bagian analisis: Konflik Jadwal, Hari Terpadat, dan Saran Optimasi.", items: { type: Type.OBJECT, properties: { title: { type: Type.STRING, description: "Judul bagian, diformat dengan markdown untuk bold." }, points: { type: Type.ARRAY, description: "Daftar poin-poin untuk bagian ini.", items: { type: Type.STRING } } } } } } };

        try {
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction, responseMimeType: "application/json", responseSchema, } });
            setAnalysisResult(JSON.parse(response.text ?? ''));
        } catch (error) {
            console.error("Schedule Analysis Error:", error);
            setAnalysisResult({ error: "Gagal menganalisis jadwal. Silakan coba lagi." });
        } finally {
            setAnalysisLoading(false);
        }
    };

    const handleExportPdf = () => {
        if (!schedule || schedule.length === 0) {
            toast.warning("Tidak ada jadwal untuk diekspor.");
            return;
        }
    
        const doc = new jsPDF();
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 15;
        let y = 20;
    
        const dayHexColors: { [key in typeof daysOfWeek[number]]: string } = {
            Senin: '#3b82f6',  // blue-500
            Selasa: '#10b981', // emerald-500
            Rabu: '#f59e0b',   // amber-500
            Kamis: '#8b5cf6', // violet-500
            Jumat: '#f43f5e',   // rose-500
        };
    
        // PDF Header
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.setTextColor('#111827'); 
        doc.text("Jadwal Mengajar Mingguan", pageW / 2, y, { align: 'center' });
        y += 8;
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor('#6b7280');
        doc.text(`Laporan untuk: ${user?.name || 'Guru'}`, pageW / 2, y, { align: 'center' });
        y += 15;
    
        // PDF Body
        daysOfWeek.forEach(day => {
            const itemsForDay = schedule.filter(item => item.day === day).sort((a,b) => a.start_time.localeCompare(b.start_time));
            if (itemsForDay.length === 0) return;
    
            const mainColor = dayHexColors[day] || '#6b7280';
            
            if (y + 15 > doc.internal.pageSize.getHeight() - margin) {
                doc.addPage();
                y = margin;
            }
    
            // Day Header
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(mainColor);
            doc.text(day, margin, y);
            y += 2;
            doc.setDrawColor(mainColor);
            doc.setLineWidth(0.5);
            doc.line(margin, y, pageW - margin, y);
            y += 8;
    
            // Schedule Items
            itemsForDay.forEach(item => {
                const cardHeight = 25;
                if (y + cardHeight > doc.internal.pageSize.getHeight() - margin) {
                    doc.addPage();
                    y = margin;
                }
    
                // Card background
                doc.setFillColor(248, 250, 252); // slate-50
                doc.setDrawColor(226, 232, 240); // slate-200
                doc.setLineWidth(0.2);
                doc.roundedRect(margin, y, pageW - (margin * 2), cardHeight, 3, 3, 'FD');
                
                const cardContentX = margin + 5;
                let currentY = y + 8;
    
                // Subject
                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(30, 41, 59); // slate-800
                doc.text(item.subject, cardContentX, currentY);
    
                // Class and Time on the same line
                currentY += 8;
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100, 116, 139); // slate-500
                doc.text(`Kelas ${item.class_id}`, cardContentX, currentY);
                
                const timeText = `${item.start_time} - ${item.end_time}`;
                const timeTextWidth = doc.getTextWidth(timeText);
                doc.text(timeText, pageW - margin - 5 - timeTextWidth, currentY);
                
                y += cardHeight + 4;
            });
            y += 8;
        });
    
        // PDF Footer
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175); // gray-400
        doc.text(`Dibuat pada ${new Date().toLocaleString('id-ID')}`, margin, doc.internal.pageSize.getHeight() - 10);
        
        doc.save('Jadwal_Mengajar.pdf');
        toast.success("Jadwal PDF berhasil diunduh!");
    };
    
    if (pageLoading) return <LoadingSpinner fullScreen />;

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-indigo-500 to-purple-500 text-transparent bg-clip-text">Jadwal Mingguan</h1>
                <div className="flex gap-2 self-end md:self-center">
                    <Button onClick={handleExportPdf} variant="outline" disabled={!isOnline || schedule.length === 0} title={!isOnline ? "Fitur ini memerlukan koneksi internet" : (schedule.length === 0 ? "Tidak ada jadwal untuk diekspor" : "Ekspor Jadwal ke PDF")}>
                        <DownloadCloudIcon className="w-5 h-5 mr-2" />
                        Export PDF
                    </Button>
                    <Button onClick={handleAnalyzeSchedule} variant="outline" disabled={!isOnline}><BrainCircuitIcon className="w-5 h-5 mr-2 text-purple-500"/>Analisis AI</Button>
                    <Button onClick={handleOpenAddModal} disabled={!isOnline} className="bg-gradient-to-r from-purple-600 to-blue-500 hover:shadow-lg hover:shadow-blue-500/40 text-white transition-all duration-300 hover:-translate-y-0.5"><PlusIcon className="w-5 h-5 mr-2" />Tambah</Button>
                </div>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {daysOfWeek.map((day, index) => { 
                    const itemsForDay = schedule.filter(item => item.day === day).sort((a, b) => a.start_time.localeCompare(b.start_time)); 
                    const { gradient, shadow } = dayStyles[day]; 
                    return (
                        <div key={day} className="flex flex-col space-y-4 animate-fade-in-up" style={{animationDelay: `${index * 100}ms`}}>
                            <div className={`text-center text-white font-bold text-xl p-4 rounded-xl bg-gradient-to-br ${gradient} shadow-lg ${shadow}`}>{day}</div>
                            <div className="space-y-4 flex-grow">
                                {itemsForDay.length > 0 ? (
                                    itemsForDay.map(item => (
                                        <div key={item.id} className="relative group bg-white dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 p-4 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                                            <div className="absolute top-2 right-2 flex space-x-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleOpenEditModal(item)} className="p-1.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 hover:bg-blue-500 hover:text-white transition-colors" aria-label="Edit jadwal" disabled={!isOnline}><PencilIcon className="h-4 w-4" /></button>
                                                <button onClick={() => handleDeleteSchedule(item.id)} className="p-1.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 hover:bg-red-500 hover:text-white transition-colors" aria-label="Hapus jadwal" disabled={!isOnline}><TrashIcon className="h-4 w-4" /></button>
                                            </div>
                                            <p className="font-bold text-lg text-gray-800 dark:text-gray-100 pr-8">{item.subject}</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Kelas {item.class_id}</p>
                                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                                <ClockIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{item.start_time} - {item.end_time}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center p-4 bg-white/50 dark:bg-gray-800/50 border border-dashed border-gray-200/50 dark:border-gray-800/30 rounded-lg h-full flex flex-col justify-center items-center transition-all duration-300">
                                        <div className="p-3 bg-green-100 dark:bg-green-900/40 rounded-full mb-3">
                                            <CalendarIcon className="w-8 h-8 text-green-500 dark:text-green-400" />
                                        </div>
                                        <p className="font-semibold text-gray-700 dark:text-gray-300">Hari Libur</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Nikmati waktu luang!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ); 
                })}
            </div>
            
            <Modal isOpen={modalState.isOpen} onClose={handleCloseModal} title={modalState.mode === 'add' ? 'Tambah Jadwal Baru' : 'Edit Jadwal'} icon={modalState.mode === 'add' ? <PlusIcon className="h-5 w-5"/> : <PencilIcon className="h-5 w-5"/>}>
                 <form onSubmit={handleFormSubmit} className="space-y-6">
                    <div><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Hari</label><div className="flex flex-wrap gap-2">{daysOfWeek.map(day => (<button type="button" key={day} onClick={() => setFormData(p => ({...p, day}))} className={`px-3 py-2 text-sm font-semibold rounded-lg transition-all duration-200 flex-1 text-center min-w-[60px] ${formData.day === day ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{day}</button>))}</div></div>
                    <FormInputWrapper label="Mata Pelajaran" icon={BookOpenIcon}><Input name="subject" placeholder="cth. Matematika" required value={formData.subject} onChange={(e) => setFormData(p => ({...p, subject: e.target.value}))} className="pl-10" /></FormInputWrapper>
                    <FormInputWrapper label="Kelas" icon={GraduationCapIcon}><Input name="class_id" placeholder="cth. 10A" required value={formData.class_id} onChange={(e) => setFormData(p => ({...p, class_id: e.target.value}))} className="pl-10" /></FormInputWrapper>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><FormInputWrapper label="Waktu Mulai" icon={ClockIcon}><Input name="start_time" type="time" required value={formData.start_time} onChange={(e) => setFormData(p => ({...p, start_time: e.target.value}))} className="pl-10" /></FormInputWrapper><FormInputWrapper label="Waktu Selesai" icon={ClockIcon}><Input name="end_time" type="time" required value={formData.end_time} onChange={(e) => setFormData(p => ({...p, end_time: e.target.value}))} className="pl-10" /></FormInputWrapper></div>
                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700"><Button type="button" variant="ghost" onClick={handleCloseModal}>Batal</Button><Button type="submit" disabled={scheduleMutation.isPending || !isOnline} className="bg-gradient-to-r from-purple-600 to-blue-500 hover:shadow-lg hover:shadow-blue-500/40 text-white font-semibold transition-all duration-300 hover:-translate-y-0.5">{scheduleMutation.isPending ? 'Menyimpan...' : (modalState.mode === 'add' ? 'Tambah Jadwal' : 'Simpan Perubahan')}</Button></div>
                </form>
            </Modal>

            <Modal title="Analisis Jadwal AI" isOpen={isAnalysisModalOpen} onClose={() => setAnalysisModalOpen(false)} icon={<BrainCircuitIcon className="h-5 w-5"/>}>
                <div className="space-y-4">
                    {isAnalysisLoading ? (
                        <div className="text-center p-6">
                            <LoadingSpinner sizeClass="w-8 h-8" colorClass="border-purple-500" className="mx-auto mb-4" />
                            <p className="text-gray-600 dark:text-gray-400">Menganalisis jadwal Anda...</p>
                        </div>
                    ) : (
                        <div className="p-4 bg-gray-100 dark:bg-gray-800/50 rounded-lg max-h-80 overflow-y-auto">
                            {analysisResult && analysisResult.sections ? (
                                <div className="space-y-4 text-sm">
                                    {analysisResult.sections.map((section: any, index: number) => { 
                                        const createMarkup = (text: string) => ({ __html: text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-gray-100">$1</strong>') }); 
                                        return (
                                            <div key={index}>
                                                <h4 className="font-semibold text-gray-800 dark:text-gray-200" dangerouslySetInnerHTML={createMarkup(section.title)} /> 
                                                <ul className="list-disc pl-5 mt-1 space-y-1 text-gray-700 dark:text-gray-300">
                                                    {section.points.map((point: string, pIndex: number) => (
                                                        <li key={pIndex} dangerouslySetInnerHTML={createMarkup(point)} />
                                                    ))}
                                                </ul>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : analysisResult && analysisResult.error ? (
                                <div className="text-center text-red-500 p-4">{analysisResult.error}</div>
                            ) : null}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default SchedulePage;