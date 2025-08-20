import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TrashIcon, PlusIcon, ClockIcon, PencilIcon, CalendarIcon, BookOpenIcon, GraduationCapIcon, BrainCircuitIcon, DownloadCloudIcon } from '../Icons';
import { Modal } from '../ui/Modal';
import { Type } from '@google/genai';
import { supabase, ai } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Database } from '../../services/database.types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const daysOfWeek: Database['public']['Tables']['schedules']['Row']['day'][] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
type ScheduleRow = Database['public']['Tables']['schedules']['Row'];
type ScheduleMutationVars = 
    | { mode: 'add'; data: Database['public']['Tables']['schedules']['Insert'] }
    | { mode: 'edit'; data: Database['public']['Tables']['schedules']['Update']; id: string };

const FormInputWrapper: React.FC<{ children: React.ReactNode; label: string; icon: React.FC<any> }> = ({ children, label, icon: Icon }) => (
    <div>
        <label className="block text-sm font-bold text-gray-200 mb-2">{label}</label>
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
        mutationFn: async (scheduleData: ScheduleMutationVars) => {
            if (scheduleData.mode === 'add') {
                const { error } = await supabase.from('schedules').insert(scheduleData.data);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('schedules').update(scheduleData.data).eq('id', scheduleData.id);
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
            setAnalysisResult(JSON.parse(response.text));
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
    
    if (pageLoading) return <div className="flex items-center justify-center h-full bg-gray-950"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

    const inputStyles = "pl-10 bg-white/10 border-white/20 placeholder:text-gray-400 text-white focus:bg-white/20 focus:border-purple-400";

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
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Jadwal Mingguan</h1>
                    <p className="mt-1 text-indigo-200">Atur jadwal mengajar Anda di papan interaktif ini.</p>
                </div>
                <div className="flex gap-2 self-end md:self-center">
                    <Button onClick={handleExportPdf} variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20" disabled={!isOnline || schedule.length === 0} title={!isOnline ? "Fitur ini memerlukan koneksi internet" : (schedule.length === 0 ? "Tidak ada jadwal untuk diekspor" : "Ekspor Jadwal ke PDF")}>
                        <DownloadCloudIcon className="w-5 h-5 mr-2" />
                        Export PDF
                    </Button>
                    <Button onClick={handleAnalyzeSchedule} variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20" disabled={!isOnline}><BrainCircuitIcon className="w-5 h-5 mr-2 text-purple-500"/>Analisis AI</Button>
                    <Button onClick={handleOpenAddModal} disabled={!isOnline} className="bg-white/10 border-white/20 hover:bg-white/20 text-white transition-all duration-300 hover:-translate-y-0.5"><PlusIcon className="w-5 h-5 mr-2" />Tambah</Button>
                </div>
            </header>
            
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 flex-grow overflow-y-auto -mx-2 px-2">
                {daysOfWeek.map((day) => { 
                    const itemsForDay = schedule.filter(item => item.day === day).sort((a, b) => a.start_time.localeCompare(b.start_time)); 
                    return (
                         <div key={day} className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-4 flex flex-col min-h-[200px]">
                            <div className="font-bold text-lg pb-3 mb-4 border-b-2 border-purple-500/50 flex justify-between items-center text-white">{day}</div>
                            <div className="space-y-4 flex-grow overflow-y-auto pr-2 -mr-2">
                                {itemsForDay.length > 0 ? (
                                    itemsForDay.map(item => (
                                        <div key={item.id} className="relative group bg-black/20 backdrop-blur-sm border border-white/20 p-3.5 rounded-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-purple-400">
                                            <div className="absolute top-2 right-2 flex space-x-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleOpenEditModal(item)} className="p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors" aria-label="Edit jadwal" disabled={!isOnline}><PencilIcon className="h-4 w-4" /></button>
                                                <button onClick={() => handleDeleteSchedule(item.id)} className="p-1.5 rounded-full text-red-400 bg-white/10 hover:bg-red-500/50 hover:text-white transition-colors" aria-label="Hapus jadwal" disabled={!isOnline}><TrashIcon className="h-4 w-4" /></button>
                                            </div>
                                            <p className="font-bold text-base mb-1 text-white">{item.subject}</p>
                                            <p className="text-sm text-gray-300 flex items-center gap-2"><GraduationCapIcon className="w-4 h-4 text-purple-400"/>Kelas {item.class_id}</p>
                                            <p className="text-sm text-gray-300 flex items-center gap-2 mt-1"><ClockIcon className="w-4 h-4 text-purple-400"/>{item.start_time} - {item.end_time}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex items-center justify-center h-full text-center text-gray-400 border-2 border-dashed border-white/10 rounded-lg">
                                        <p className="text-sm">Tidak ada jadwal</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <Modal title={modalState.mode === 'add' ? 'Tambah Jadwal Baru' : 'Edit Jadwal'} isOpen={modalState.isOpen} onClose={handleCloseModal} icon={<CalendarIcon className="h-5 w-5"/>}>
                <form onSubmit={handleFormSubmit} className="space-y-6">
                    <FormInputWrapper label="Hari" icon={CalendarIcon}><select value={formData.day} onChange={e => setFormData(p => ({...p, day: e.target.value as any}))} className={`w-full ${inputStyles}`}>{daysOfWeek.map(day => <option key={day} value={day} className="bg-gray-800 text-white">{day}</option>)}</select></FormInputWrapper>
                    <div className="grid grid-cols-2 gap-4">
                        <FormInputWrapper label="Waktu Mulai" icon={ClockIcon}><Input type="time" value={formData.start_time} onChange={e => setFormData(p => ({...p, start_time: e.target.value}))} className={`w-full ${inputStyles}`} /></FormInputWrapper>
                        <FormInputWrapper label="Waktu Selesai" icon={ClockIcon}><Input type="time" value={formData.end_time} onChange={e => setFormData(p => ({...p, end_time: e.target.value}))} className={`w-full ${inputStyles}`} /></FormInputWrapper>
                    </div>
                    <FormInputWrapper label="Mata Pelajaran" icon={BookOpenIcon}><Input value={formData.subject} onChange={e => setFormData(p => ({...p, subject: e.target.value}))} required className={`w-full ${inputStyles}`} placeholder="cth. Matematika" /></FormInputWrapper>
                    <FormInputWrapper label="Kelas" icon={GraduationCapIcon}><Input value={formData.class_id} onChange={e => setFormData(p => ({...p, class_id: e.target.value}))} required className={`w-full ${inputStyles}`} placeholder="cth. 7A" /></FormInputWrapper>
                    <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={handleCloseModal} disabled={scheduleMutation.isPending}>Batal</Button><Button type="submit" disabled={scheduleMutation.isPending || !isOnline}>{scheduleMutation.isPending ? 'Menyimpan...' : 'Simpan'}</Button></div>
                </form>
            </Modal>

            <Modal title="Analisis Jadwal AI" isOpen={isAnalysisModalOpen} onClose={() => setAnalysisModalOpen(false)} icon={<BrainCircuitIcon className="h-5 w-5"/>}>
                {isAnalysisLoading ? <div className="text-center py-8">Menganalisis jadwal Anda...</div> :
                analysisResult && !analysisResult.error ? (
                    <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto pr-2">
                        {analysisResult.sections?.map((section: any, index: number) => (
                            <div key={index}>
                                <h4 className="font-bold text-base text-gray-800 dark:text-gray-200" dangerouslySetInnerHTML={{ __html: section.title }}></h4>
                                <ul className="list-disc pl-5 mt-1 space-y-1 text-gray-600 dark:text-gray-400">
                                    {section.points?.map((point: string, pIndex: number) => <li key={pIndex}>{point}</li>)}
                                </ul>
                            </div>
                        ))}
                    </div>
                ) : <div className="text-center py-8 text-red-500">{analysisResult?.error || "Gagal memuat analisis."}</div>}
            </Modal>
        </div>
    );
};

export default SchedulePage;
