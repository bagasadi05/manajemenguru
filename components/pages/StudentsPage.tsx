import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { useToast } from '../../hooks/useToast';
import { GraduationCapIcon, UsersIcon, PlusIcon, PencilIcon, TrashIcon, SparklesIcon, AlertCircleIcon, LayoutGridIcon, ListIcon } from '../Icons';
import { ai, supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Database } from '../../services/database.types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import StudentsPageSkeleton from '../skeletons/StudentsPageSkeleton';

type StudentRow = Database['public']['Tables']['students']['Row'];
type ClassRow = Database['public']['Tables']['classes']['Row'];

// Simplified data type for this page to improve performance
type StudentsPageData = {
    classes: ClassRow[];
    students: StudentRow[];
};

interface ConfirmActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    confirmVariant?: 'default' | 'destructive';
    isLoading?: boolean;
}

const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', confirmVariant = 'destructive', isLoading = false }) => (
    <Modal isOpen={isOpen} onClose={onClose} title={title} icon={<AlertCircleIcon className="w-5 h-5"/>}>
        <div className="space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400"><p>{message}</p></div>
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
                    Batal
                </Button>
                <Button type="button" variant={confirmVariant} onClick={onConfirm} disabled={isLoading}>
                    {isLoading ? 'Memproses...' : confirmText}
                </Button>
            </div>
        </div>
    </Modal>
);

const StudentsPage: React.FC = () => {
    const toast = useToast();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const isOnline = useOfflineStatus();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiQuery, setAiQuery] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);

    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [studentModalMode, setStudentModalMode] = useState<'add' | 'edit'>('add');
    const [currentStudent, setCurrentStudent] = useState<StudentRow | null>(null);

    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const [classModalMode, setClassModalMode] = useState<'add' | 'edit'>('add');
    const [currentClass, setCurrentClass] = useState<ClassRow | null>(null);
    const [classNameInput, setClassNameInput] = useState('');

    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    const { data, isLoading, isError, error: queryError } = useQuery({
        queryKey: ['studentsPageData', user?.id],
        queryFn: async (): Promise<StudentsPageData | null> => {
            if (!user) return null;
            const [classesRes, studentsRes] = await Promise.all([
                supabase.from('classes').select('*').eq('user_id', user.id),
                supabase.from('students').select('*').eq('user_id', user.id),
            ]);
            if (classesRes.error) throw new Error(classesRes.error.message);
            if (studentsRes.error) throw new Error(studentsRes.error.message);
            return { classes: classesRes.data || [], students: studentsRes.data || [] };
        },
        enabled: !!user,
    });

    useEffect(() => { if (isError) { toast.error(`Gagal memuat data: ${(queryError as Error).message}`); } }, [isError, queryError, toast]);

    const { students = [], classes = [] } = data || {};

    const { mutate: addStudent, isPending: isAddingStudent } = useMutation({
        mutationFn: async (newStudent: Database['public']['Tables']['students']['Insert']) => { const { error } = await supabase.from('students').insert([newStudent]); if (error) throw error; },
        onSuccess: () => { toast.success("Siswa berhasil ditambahkan."); queryClient.invalidateQueries({ queryKey: ['studentsPageData'] }); setIsStudentModalOpen(false); },
        onError: (error: Error) => toast.error(error.message),
    });

    const { mutate: updateStudent, isPending: isUpdatingStudent } = useMutation({
        mutationFn: async ({ id, ...updateData }: { id: string } & Database['public']['Tables']['students']['Update']) => { const { error } = await supabase.from('students').update(updateData).eq('id', id); if (error) throw error; },
        onSuccess: () => { toast.success("Siswa berhasil diperbarui."); queryClient.invalidateQueries({ queryKey: ['studentsPageData'] }); setIsStudentModalOpen(false); },
        onError: (error: Error) => toast.error(error.message),
    });
    
    const { mutate: deleteStudent, isPending: isDeletingStudent } = useMutation({
        mutationFn: async (studentId: string) => { const { error } = await supabase.from('students').delete().eq('id', studentId); if (error) throw error; },
        onSuccess: () => { toast.success("Siswa berhasil dihapus."); queryClient.invalidateQueries({ queryKey: ['studentsPageData'] }); setConfirmModalState({ isOpen: false, title: '', message: '', onConfirm: () => {} }); },
        onError: (error: Error) => toast.error(error.message),
    });

    const { mutate: addClass, isPending: isAddingClass } = useMutation({
        mutationFn: async (newClass: Database['public']['Tables']['classes']['Insert']) => { const { error } = await supabase.from('classes').insert([newClass]); if (error) throw error; },
        onSuccess: () => { toast.success("Kelas berhasil ditambahkan."); queryClient.invalidateQueries({ queryKey: ['studentsPageData'] }); setIsClassModalOpen(false); },
        onError: (error: Error) => toast.error(error.message),
    });

    const { mutate: updateClass, isPending: isUpdatingClass } = useMutation({
        mutationFn: async ({ id, ...updateData }: { id: string } & Database['public']['Tables']['classes']['Update']) => { const { error } = await supabase.from('classes').update(updateData).eq('id', id); if (error) throw error; },
        onSuccess: () => { toast.success("Kelas berhasil diperbarui."); queryClient.invalidateQueries({ queryKey: ['studentsPageData'] }); setIsClassModalOpen(false); },
        onError: (error: Error) => toast.error(error.message),
    });

    const { mutate: deleteClass, isPending: isDeletingClass } = useMutation({
        mutationFn: async (classId: string) => { const { error } = await supabase.from('classes').delete().eq('id', classId); if (error) throw error; },
        onSuccess: () => { toast.success("Kelas berhasil dihapus."); queryClient.invalidateQueries({ queryKey: ['studentsPageData'] }); setConfirmModalState({ isOpen: false, title: '', message: '', onConfirm: () => {} }); },
        onError: (error: Error) => toast.error(error.message),
    });

    const filteredStudents = useMemo(() => {
        if (!searchTerm) return students;
        return students.filter(student => student.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, students]);
    
    const classMap = useMemo(() => new Map<string, string>(classes.map(c => [c.id, c.name])), [classes]);

    const studentsByClass = useMemo(() => {
        return classes.map(classInfo => ({
            ...classInfo,
            students: filteredStudents.filter(student => student.class_id === classInfo.id).sort((a, b) => a.name.localeCompare(b.name, 'id-ID'))
        })).filter(classGroup => classGroup.students.length > 0 || !searchTerm).sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));
    }, [filteredStudents, classes, searchTerm]);

    const handleOpenStudentModal = (mode: 'add' | 'edit', student: StudentRow | null = null) => {
        if (classes.length === 0) { toast.warning("Silakan tambah data kelas terlebih dahulu sebelum menambah siswa."); return; }
        setStudentModalMode(mode); setCurrentStudent(student); setIsStudentModalOpen(true);
    };

    const handleStudentFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault(); if (!user) return;
        const formData = new FormData(e.currentTarget);
        const name = formData.get('name') as string; const class_id = formData.get('class_id') as string; const gender = formData.get('gender') as 'Laki-laki' | 'Perempuan';
        const avatarGender = gender === 'Laki-laki' ? 'boy' : 'girl'; const avatar_url = `https://avatar.iran.liara.run/public/${avatarGender}?username=${encodeURIComponent(name || Date.now())}`;
        if (studentModalMode === 'add') {
            const newStudentData: Database['public']['Tables']['students']['Insert'] = { name, class_id, user_id: user.id, gender, avatar_url };
            addStudent(newStudentData);
        } else if (currentStudent) {
            const newAvatarUrl = (currentStudent.gender !== gender || currentStudent.avatar_url.includes('i.pravatar.cc')) ? avatar_url : currentStudent.avatar_url;
            updateStudent({ id: currentStudent.id, name, class_id, gender, avatar_url: newAvatarUrl });
        }
    };

    const handleDeleteStudentConfirm = (studentId: string) => { setConfirmModalState({ isOpen: true, title: 'Hapus Siswa', message: 'Apakah Anda yakin ingin menghapus siswa ini? Semua data terkait (laporan, absensi, nilai) juga akan dihapus secara permanen.', onConfirm: () => deleteStudent(studentId) }); };
    
    const handleOpenClassModal = (mode: 'add' | 'edit', classData: ClassRow | null = null) => { setClassModalMode(mode); setCurrentClass(classData); setClassNameInput(classData ? classData.name : ''); setIsClassModalOpen(true); };

    const handleClassFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault(); if (!classNameInput.trim() || !user) return;
        const name = classNameInput.trim();
        if (classModalMode === 'add') {
            const newClassData: Database['public']['Tables']['classes']['Insert'] = { name, user_id: user.id };
            addClass(newClassData);
        } else if (currentClass) {
            updateClass({ id: currentClass.id, name });
        }
    };

    const handleDeleteClassConfirm = (classId: string) => {
        if (students.some(s => s.class_id === classId)) { toast.warning('Tidak dapat menghapus kelas karena masih ada siswa di dalamnya.'); return; }
        setConfirmModalState({ isOpen: true, title: 'Hapus Kelas', message: 'Apakah Anda yakin ingin menghapus kelas ini?', onConfirm: () => deleteClass(classId) });
    };
    
    const handleAiQuery = async () => {
        if (!aiQuery.trim()) return;
        setIsAiLoading(true); setAiResponse('');
        const systemInstruction = `Anda adalah asisten analisis data untuk guru. Jawab pertanyaan HANYA berdasarkan data JSON yang diberikan. Jawaban harus singkat, faktual, dan dalam format daftar (list) jika memungkinkan. Jangan menambahkan opini atau kalimat pembuka/penutup. Jika data tidak tersedia untuk menjawab, katakan "Data tidak ditemukan".`;
        const studentNames = students.map(s => s.name).join(', ');
        const classNames = classes.map(c => c.name).join(', ');
        const prompt = `DATA KONTEKS:\n- Daftar Kelas: ${classNames}\n- Daftar Siswa: ${studentNames}\n\nPERTANYAAN:\n${aiQuery}\n\nJAWABAN (berdasarkan data di atas):`;
        try { const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction } }); setAiResponse(response.text); } 
        catch (error) { console.error("AI Assistant Error:", error); setAiResponse("Maaf, terjadi kesalahan saat memproses permintaan Anda."); } 
        finally { setIsAiLoading(false); }
    };

    if (isLoading) { return <StudentsPageSkeleton />; }

    const inputStyles = "bg-white/10 border-white/20 placeholder:text-gray-400 text-white focus:bg-white/20 focus:border-purple-400";
    const buttonStyles = "bg-white/10 border-white/20 hover:bg-white/20 text-white";

    const renderGridView = () => (
        studentsByClass.map(classGroup => {
            if (classGroup.students.length === 0) return null;
            return (
                <div key={classGroup.id} className="mb-8 animate-fade-in-up animation-delay-200">
                    <h3 className="flex items-center gap-3 text-2xl font-bold mb-6 text-white"><span className="p-3 bg-white/10 rounded-xl border border-white/20"><GraduationCapIcon className="h-6 w-6 text-purple-400"/></span><span>{classGroup.name}</span></h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {classGroup.students.map((student) => (
                            <Link to={`/siswa/${student.id}`} key={student.id} className="group block focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 dark:focus:ring-offset-gray-950 rounded-2xl">
                                <div className="relative p-6 h-full text-white overflow-hidden rounded-2xl transition-all duration-300 ease-in-out bg-black/20 backdrop-blur-sm border border-white/20 group-hover:shadow-2xl group-hover:shadow-purple-500/30 group-hover:-translate-y-2 group-hover:border-purple-400">
                                    <div className="relative z-10 flex flex-col items-center text-center">
                                        <div className="relative mb-4"><img src={student.avatar_url} alt={student.name} className="w-28 h-28 rounded-full object-cover border-4 border-white/50 shadow-lg transition-transform duration-300 group-hover:scale-110"/></div>
                                        <h4 className="font-bold text-lg text-shadow-md">{student.name}</h4>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            );
        })
    );

    const renderListView = () => (
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl shadow-lg border border-white/10 overflow-hidden animate-fade-in">
            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/10 font-bold text-sm text-gray-400">
                <div className="col-span-6">Nama Siswa</div><div className="col-span-4">Kelas</div><div className="col-span-2 text-right">Aksi</div>
            </div>
            <div className="divide-y divide-white/10">
                {filteredStudents.sort((a,b) => a.name.localeCompare(b.name, 'id-ID')).map(student => (
                    <div key={student.id} className="grid grid-cols-1 lg:grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-white/5 transition-colors">
                        <div className="col-span-1 lg:col-span-6 flex items-center gap-4">
                            <img src={student.avatar_url} alt={student.name} className="w-10 h-10 rounded-full object-cover"/>
                            <Link to={`/siswa/${student.id}`} className="font-semibold text-white hover:text-purple-400">{student.name}</Link>
                        </div>
                        <div className="col-span-1 lg:col-span-4 text-gray-400"><span className="lg:hidden font-bold">Kelas: </span>{classMap.get(student.class_id) || 'N/A'}</div>
                        <div className="col-span-1 lg:col-span-2 flex justify-start lg:justify-end items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => handleOpenStudentModal('edit', student)} disabled={!isOnline}><PencilIcon className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-white hover:bg-red-500/40" onClick={() => handleDeleteStudentConfirm(student.id)} disabled={!isOnline}><TrashIcon className="h-4 w-4" /></Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="w-full min-h-full p-4 sm:p-6 md:p-8 relative text-white flex flex-col">
            <div className="holographic-orb-container" style={{ top: '-40px', width: '120px', height: '120px', opacity: 0.7 }}>
                <div className="holographic-orb"><div className="orb-glow"></div><div className="orb-core"></div><div className="orb-ring orb-ring-1"></div><div className="orb-ring orb-ring-2"></div></div>
            </div>

            <header className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div><h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Manajemen Siswa & Kelas</h1><p className="mt-1 text-indigo-200">Kelola semua data siswa dan kelas Anda di sini.</p></div>
                <div className="flex w-full md:w-auto items-center gap-2">
                    <div className="flex-grow md:flex-grow-0 w-full md:w-48 relative"><svg className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><Input type="text" placeholder="Cari siswa..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Cari Siswa" className={`pl-10 ${inputStyles}`} /></div>
                    <div className="p-1 bg-black/20 rounded-lg flex items-center border border-white/10"><Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" onClick={() => setViewMode('grid')} className={`h-8 w-8 ${viewMode==='grid' ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`} aria-label="Grid View"><LayoutGridIcon className="w-5 h-5"/></Button><Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" onClick={() => setViewMode('list')} className={`h-8 w-8 ${viewMode==='list' ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`} aria-label="List View"><ListIcon className="w-5 h-5"/></Button></div>
                    <Button onClick={() => setIsAiModalOpen(true)} variant="outline" className={`whitespace-nowrap ${buttonStyles}`} disabled={!isOnline} title={!isOnline ? "AI Assistant requires an internet connection" : ""}><SparklesIcon className="w-4 h-4 mr-2 text-purple-400"/>Asisten</Button>
                    <Button onClick={() => handleOpenStudentModal('add')} className={`whitespace-nowrap ${buttonStyles}`} disabled={!isOnline} title={!isOnline ? "Cannot add student while offline" : ""}><PlusIcon className="w-4 h-4 mr-2" />Siswa</Button>
                </div>
            </header>

            <div className="relative z-10 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6 mb-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                    <h3 className="text-xl font-bold text-white">Kelola Kelas</h3>
                    <Button size="sm" onClick={() => handleOpenClassModal('add')} className={`${buttonStyles} w-full sm:w-auto`} disabled={!isOnline} title={!isOnline ? "Cannot add class while offline" : ""}><PlusIcon className="w-4 h-4 mr-2" />Tambah Kelas</Button>
                </div>
                <div className="space-y-3">{classes.sort((a,b) => a.name.localeCompare(b.name)).map(c => (<div key={c.id} className="flex items-center justify-between p-3 bg-black/20 border border-white/10 rounded-lg transition-all hover:bg-black/30"><span className="font-semibold text-white">{c.name}</span><div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => handleOpenClassModal('edit', c)} disabled={!isOnline}><PencilIcon className="h-4 h-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-white hover:bg-red-500/40" onClick={() => handleDeleteClassConfirm(c.id)} disabled={!isOnline}><TrashIcon className="h-4 h-4" /></Button></div></div>))} {classes.length === 0 && <p className="text-center text-indigo-200 py-4">Belum ada kelas. Silakan tambahkan kelas baru.</p>}</div>
            </div>

            <div className="relative z-10 flex-grow overflow-y-auto -mx-2 px-2 pb-4">
                {!students.length ? (<div className="text-center py-16 px-6 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10"><div className="flex justify-center mb-6"><div className="w-24 h-24 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-full flex items-center justify-center border border-white/10"><UsersIcon className="w-12 h-12 text-purple-400" /></div></div><h3 className="text-2xl font-bold text-white">Daftar Siswa Kosong</h3><p className="mt-2 text-gray-300 max-w-md mx-auto">Anda belum memiliki data siswa. Mulai dengan menambahkan siswa pertama Anda.</p><Button onClick={() => handleOpenStudentModal('add')} disabled={!isOnline} className="mt-8 bg-gradient-to-r from-purple-600 to-blue-500 hover:shadow-lg hover:shadow-blue-500/40 text-white font-semibold transition-all duration-300 hover:-translate-y-0.5"><PlusIcon className="w-5 h-5 mr-2" />Tambah Siswa Baru</Button></div>)
                : !filteredStudents.length ? (<div className="text-center py-16 px-6 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10"><div className="flex justify-center mb-6"><div className="w-24 h-24 bg-gradient-to-br from-yellow-500/20 to-amber-500/20 rounded-full flex items-center justify-center border border-white/10"><UsersIcon className="w-12 h-12 text-amber-400" /></div></div><h3 className="text-2xl font-bold text-white">Siswa Tidak Ditemukan</h3><p className="mt-2 text-gray-300">Tidak ada siswa yang cocok dengan pencarian <span className="font-semibold text-purple-400">"{searchTerm}"</span>.</p></div>)
                : (viewMode === 'grid' ? renderGridView() : renderListView())}
            </div>

            <Modal title="Asisten Siswa AI" isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} icon={<SparklesIcon className="h-5 w-5" />}><div className="space-y-4"><p className="text-sm text-gray-600 dark:text-gray-400">Ajukan pertanyaan dalam bahasa natural tentang data siswa Anda. Contoh: "Siapakah siswa di kelas 7A?" atau "Berapa jumlah total siswa yang saya ajar?".</p><Input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAiQuery()} placeholder="Ketik pertanyaan Anda..." disabled={isAiLoading}/><div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => setIsAiModalOpen(false)}>Batal</Button><Button type="button" onClick={handleAiQuery} disabled={isAiLoading || !isOnline}>{isAiLoading ? 'Mencari...' : 'Tanya AI'}</Button></div>{aiResponse && <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800/50 rounded-lg"><h4 className="font-semibold mb-2">Jawaban AI:</h4><p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{aiResponse}</p></div>}</div></Modal>
            <Modal title={studentModalMode === 'add' ? 'Tambah Siswa Baru' : 'Edit Siswa'} isOpen={isStudentModalOpen} onClose={() => setIsStudentModalOpen(false)}><form onSubmit={handleStudentFormSubmit} className="space-y-4"><div><label>Nama Lengkap</label><Input name="name" defaultValue={currentStudent?.name || ''} required/></div><div><label>Jenis Kelamin</label><div className="flex gap-4 mt-2"><label className="flex items-center"><input type="radio" name="gender" value="Laki-laki" defaultChecked={currentStudent?.gender === 'Laki-laki' || true} className="form-radio"/><span className="ml-2">Laki-laki</span></label><label className="flex items-center"><input type="radio" name="gender" value="Perempuan" defaultChecked={currentStudent?.gender === 'Perempuan'} className="form-radio"/><span className="ml-2">Perempuan</span></label></div></div><div><label>Kelas</label><Select name="class_id" defaultValue={currentStudent?.class_id || ''} required>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div><div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => setIsStudentModalOpen(false)}>Batal</Button><Button type="submit" disabled={isAddingStudent || isUpdatingStudent || !isOnline}>{isAddingStudent || isUpdatingStudent ? 'Menyimpan...' : 'Simpan'}</Button></div></form></Modal>
            <Modal title={classModalMode === 'add' ? 'Tambah Kelas Baru' : 'Edit Kelas'} isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)}><form onSubmit={handleClassFormSubmit} className="space-y-4"><div><label>Nama Kelas</label><Input value={classNameInput} onChange={e => setClassNameInput(e.target.value)} placeholder="Contoh: 7A Unggulan" required /></div><div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => setIsClassModalOpen(false)}>Batal</Button><Button type="submit" disabled={isAddingClass || isUpdatingClass || !isOnline}>{isAddingClass || isUpdatingClass ? 'Menyimpan...' : 'Simpan'}</Button></div></form></Modal>
            <ConfirmActionModal isOpen={confirmModalState.isOpen} onClose={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))} title={confirmModalState.title} message={confirmModalState.message} onConfirm={confirmModalState.onConfirm} isLoading={isDeletingStudent || isDeletingClass} confirmText="Ya, Hapus"/>
        </div>
    );
};

export default StudentsPage;
