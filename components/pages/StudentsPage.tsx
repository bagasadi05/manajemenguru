import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { useToast } from '../../hooks/useToast';
import { GraduationCapIcon, UsersIcon, PlusIcon, PencilIcon, TrashIcon, SparklesIcon, FileTextIcon, AlertTriangleIcon, AlertCircleIcon, ShieldAlertIcon, LayoutGridIcon, ListIcon } from '../Icons';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Database } from '../../services/database.types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import LoadingSpinner from '../LoadingSpinner';

type StudentRow = Database['public']['Tables']['students']['Row'];
type ClassRow = Database['public']['Tables']['classes']['Row'];

// Simplified data type for this page to improve performance
type StudentsPageData = {
    classes: ClassRow[];
    students: StudentRow[];
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

const ClassListModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    classes: ClassRow[];
    onAdd: () => void;
    onEdit: (classData: ClassRow) => void;
    onDelete: (classId: string) => void;
    isLoading: boolean;
    isOnline: boolean;
}> = ({ isOpen, onClose, classes, onAdd, onEdit, onDelete, isLoading, isOnline }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Kelola Kelas" icon={<GraduationCapIcon className="w-5 h-5"/>}>
        <div className="space-y-4">
            <Button size="sm" onClick={onAdd} className="w-full" disabled={!isOnline || isLoading}>
                <PlusIcon className="w-4 h-4 mr-2" />Tambah Kelas Baru
            </Button>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {classes.sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800/50 rounded-lg transition-all">
                        <span className="font-semibold">{c.name}</span>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" onClick={() => onEdit(c)} disabled={!isOnline || isLoading}>
                                <PencilIcon className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => onDelete(c.id)} disabled={!isOnline || isLoading}>
                                <TrashIcon className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
                {classes.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 py-4">Belum ada kelas.</p>}
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

    const [isClassListModalOpen, setIsClassListModalOpen] = useState(false);
    const [isClassFormModalOpen, setIsClassFormModalOpen] = useState(false);
    const [classModalMode, setClassModalMode] = useState<'add' | 'edit'>('add');
    const [currentClass, setCurrentClass] = useState<ClassRow | null>(null);
    const [classNameInput, setClassNameInput] = useState('');

    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    const { data, isLoading, isError, error: queryError } = useQuery({
        queryKey: ['studentsPageData', user?.id],
        queryFn: async (): Promise<StudentsPageData | null> => {
            if (!user) return null;
            // Fetch only essential data for this page
            const [classesRes, studentsRes] = await Promise.all([
                supabase.from('classes').select('*').eq('user_id', user.id),
                supabase.from('students').select('*').eq('user_id', user.id),
            ]);

            if (classesRes.error) throw new Error(classesRes.error.message);
            if (studentsRes.error) throw new Error(studentsRes.error.message);

            return {
                classes: classesRes.data || [],
                students: studentsRes.data || [],
            };
        },
        enabled: !!user,
    });

    useEffect(() => {
        if (isError) {
            toast.error(`Gagal memuat data: ${(queryError as Error).message}`);
        }
    }, [isError, queryError, toast]);

    const { students = [], classes = [] } = data || {};

    const { mutate: addStudent, isPending: isAddingStudent } = useMutation({
        mutationFn: async (newStudent: Database['public']['Tables']['students']['Insert']) => { const { error } = await supabase.from('students').insert(newStudent); if (error) throw error; },
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
        mutationFn: async (newClass: Database['public']['Tables']['classes']['Insert']) => { const { error } = await supabase.from('classes').insert(newClass); if (error) throw error; },
        onSuccess: () => { toast.success("Kelas berhasil ditambahkan."); queryClient.invalidateQueries({ queryKey: ['studentsPageData'] }); setIsClassFormModalOpen(false); },
        onError: (error: Error) => toast.error(error.message),
    });

    const { mutate: updateClass, isPending: isUpdatingClass } = useMutation({
        mutationFn: async ({ id, ...updateData }: { id: string } & Database['public']['Tables']['classes']['Update']) => { const { error } = await supabase.from('classes').update(updateData).eq('id', id); if (error) throw error; },
        onSuccess: () => { toast.success("Kelas berhasil diperbarui."); queryClient.invalidateQueries({ queryKey: ['studentsPageData'] }); setIsClassFormModalOpen(false); },
        onError: (error: Error) => toast.error(error.message),
    });

    const { mutate: deleteClass, isPending: isDeletingClass } = useMutation({
        mutationFn: async (classId: string) => { const { error } = await supabase.from('classes').delete().eq('id', classId); if (error) throw error; },
        onSuccess: () => { toast.success("Kelas berhasil dihapus."); queryClient.invalidateQueries({ queryKey: ['studentsPageData'] }); setConfirmModalState({ isOpen: false, title: '', message: '', onConfirm: () => {} }); },
        onError: (error: Error) => toast.error(error.message),
    });

    const filteredStudents = useMemo(() => {
        if (!searchTerm) return students;
        return students.filter(student =>
            student.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, students]);
    
    const classMap = useMemo(() => new Map<string, string>(classes.map(c => [c.id, c.name])), [classes]);

    const studentsByClass = useMemo(() => {
        return classes.map(classInfo => ({
            ...classInfo,
            students: filteredStudents
                .filter(student => student.class_id === classInfo.id)
                .sort((a, b) => a.name.localeCompare(b.name, 'id-ID'))
        })).filter(classGroup => classGroup.students.length > 0 || !searchTerm).sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));
    }, [filteredStudents, classes, searchTerm]);

    const handleOpenStudentModal = (mode: 'add' | 'edit', student: StudentRow | null = null) => {
        if (classes.length === 0) {
            toast.warning("Silakan tambah data kelas terlebih dahulu sebelum menambah siswa.");
            return;
        }
        setStudentModalMode(mode);
        setCurrentStudent(student);
        setIsStudentModalOpen(true);
    };

    const handleStudentFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user) return;
        const formData = new FormData(e.currentTarget);
        const name = formData.get('name') as string;
        const class_id = formData.get('class_id') as string;
        const gender = formData.get('gender') as 'Laki-laki' | 'Perempuan';

        const avatarGender = gender === 'Laki-laki' ? 'boy' : 'girl';
        const avatar_url = `https://avatar.iran.liara.run/public/${avatarGender}?username=${encodeURIComponent(name || Date.now())}`;

        if (studentModalMode === 'add') {
            addStudent({ name, class_id, user_id: user.id, gender, avatar_url });
        } else if (currentStudent) {
            // Generate a new avatar if gender is changed or if the current one is the default Pravatar avatar
            const newAvatarUrl = (currentStudent.gender !== gender || currentStudent.avatar_url.includes('i.pravatar.cc'))
                ? avatar_url
                : currentStudent.avatar_url;
            updateStudent({ id: currentStudent.id, name, class_id, gender, avatar_url: newAvatarUrl });
        }
    };


    const handleDeleteStudentConfirm = (studentId: string) => {
        setConfirmModalState({
            isOpen: true,
            title: 'Hapus Siswa',
            message: 'Apakah Anda yakin ingin menghapus siswa ini? Semua data terkait (laporan, absensi, nilai) juga akan dihapus secara permanen.',
            onConfirm: () => deleteStudent(studentId),
        });
    };
    
    const handleOpenClassFormModal = (mode: 'add' | 'edit', classData: ClassRow | null = null) => {
        setClassModalMode(mode);
        setCurrentClass(classData);
        setClassNameInput(classData ? classData.name : '');
        setIsClassListModalOpen(false); // Close list modal
        setIsClassFormModalOpen(true); // Open form modal
    };

    const handleClassFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!classNameInput.trim() || !user) return;
        const name = classNameInput.trim();

        if (classModalMode === 'add') {
            addClass({ name, user_id: user.id });
        } else if (currentClass) {
            updateClass({ id: currentClass.id, name });
        }
    };

    const handleDeleteClassConfirm = (classId: string) => {
        if (students.some(s => s.class_id === classId)) {
            toast.warning('Tidak dapat menghapus kelas karena masih ada siswa di dalamnya.');
            return;
        }
        setConfirmModalState({
            isOpen: true,
            title: 'Hapus Kelas',
            message: 'Apakah Anda yakin ingin menghapus kelas ini?',
            onConfirm: () => deleteClass(classId),
        });
    };
    
    const handleAiQuery = async () => {
        if (!aiQuery.trim()) return;
        setIsAiLoading(true); setAiResponse('');
        const systemInstruction = `Anda adalah asisten analisis data untuk guru. Jawab pertanyaan HANYA berdasarkan data JSON yang diberikan. Jawaban harus singkat, faktual, dan dalam format daftar (list) jika memungkinkan. Jangan menambahkan opini atau kalimat pembuka/penutup. Jika data tidak tersedia untuk menjawab, katakan "Data tidak ditemukan".`;
        const studentNames = students.map(s => s.name).join(', ');
        const classNames = classes.map(c => c.name).join(', ');
        const prompt = `DATA KONTEKS:\n- Daftar Kelas: ${classNames}\n- Daftar Siswa: ${studentNames}\n\nPERTANYAAN:\n${aiQuery}\n\nJAWABAN (berdasarkan data di atas):`;

        try {
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction } });
            setAiResponse(response.text ?? '');
        } catch (error) {
            console.error("AI Assistant Error:", error);
            setAiResponse("Maaf, terjadi kesalahan saat memproses permintaan Anda.");
        } finally {
            setIsAiLoading(false);
        }
    };

    if (isLoading) {
        return <LoadingSpinner fullScreen />;
    }

    const renderGridView = () => (
        studentsByClass.map(classGroup => {
            if (classGroup.students.length === 0) return null;
            return (
                <div key={classGroup.id} className="mb-8 animate-fade-in-up animation-delay-200">
                    <h3 className="flex items-center gap-3 text-2xl font-bold mb-6">
                        <span className="p-3 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl">
                            <GraduationCapIcon className="h-6 w-6 text-indigo-500 dark:text-indigo-400"/>
                        </span>
                        <span className="text-gray-800 dark:text-gray-200">{classGroup.name}</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {classGroup.students.map(student => (
                            <Link to={`/siswa/${student.id}`} key={student.id} className="group block focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950 rounded-2xl">
                                <Card className="h-full overflow-hidden transition-all duration-300 ease-in-out group-hover:shadow-xl group-hover:shadow-indigo-500/10 group-hover:-translate-y-1 border-white/20 dark:border-gray-800/50 bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg">
                                    <CardContent className="p-6 flex flex-col items-center text-center">
                                        <img src={student.avatar_url} alt={student.name} className="w-28 h-28 rounded-full object-cover mb-4 shadow-lg transition-transform duration-300 group-hover:scale-105"/>
                                        <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100">{student.name}</h4>
                                        <p className="text-sm text-indigo-500 dark:text-indigo-400 font-medium">{classMap.get(student.class_id) || 'N/A'}</p>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </div>
            );
        })
    );

    const renderListView = () => (
        <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg rounded-2xl shadow-lg shadow-gray-500/10 dark:shadow-black/20 border border-white/20 dark:border-gray-800/50 overflow-hidden animate-fade-in">
            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-200/50 dark:border-gray-800/50 font-bold text-sm text-gray-500 dark:text-gray-400">
                <div className="col-span-6">Nama Siswa</div>
                <div className="col-span-4">Kelas</div>
                <div className="col-span-2 text-right">Aksi</div>
            </div>
            <div className="divide-y divide-gray-200/50 dark:divide-gray-800/50">
                {filteredStudents.sort((a,b) => a.name.localeCompare(b.name, 'id-ID')).map(student => {
                    return (
                        <div key={student.id} className="grid grid-cols-1 lg:grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <div className="col-span-1 lg:col-span-6 flex items-center gap-4">
                                <img src={student.avatar_url} alt={student.name} className="w-10 h-10 rounded-full object-cover"/>
                                <Link to={`/siswa/${student.id}`} className="font-semibold text-gray-800 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400">{student.name}</Link>
                            </div>
                            <div className="col-span-1 lg:col-span-4 text-gray-600 dark:text-gray-400"><span className="lg:hidden font-bold">Kelas: </span>{classMap.get(student.class_id) || 'N/A'}</div>
                            <div className="col-span-1 lg:col-span-2 flex justify-start lg:justify-end items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenStudentModal('edit', student)} disabled={!isOnline}><PencilIcon className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleDeleteStudentConfirm(student.id)} disabled={!isOnline}><TrashIcon className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
    

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 animate-fade-in-up">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-indigo-500 to-purple-500 text-transparent bg-clip-text">Manajemen Siswa</h2>
                <div className="flex w-full md:w-auto items-center gap-2">
                    <div className="flex-grow md:flex-grow-0 w-full md:w-48 relative">
                        <svg className="w-5 h-5 text-gray-400 absolute top-1/2 left-4 -translate-y-1/2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <Input type="text" placeholder="Cari siswa..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Cari Siswa" className="pl-11 bg-white dark:bg-gray-900" />
                    </div>
                    <div className="p-1 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center">
                        <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" onClick={() => setViewMode('grid')} className="h-8 w-8" aria-label="Grid View"><LayoutGridIcon className="w-5 h-5"/></Button>
                        <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" onClick={() => setViewMode('list')} className="h-8 w-8" aria-label="List View"><ListIcon className="w-5 h-5"/></Button>
                    </div>
                     <Button onClick={() => setIsAiModalOpen(true)} variant="outline" className="whitespace-nowrap" disabled={!isOnline} title={!isOnline ? "AI Assistant requires an internet connection" : ""}><SparklesIcon className="w-4 h-4 mr-2 text-purple-500"/>Asisten AI</Button>
                    <Button onClick={() => handleOpenStudentModal('add')} className="whitespace-nowrap" disabled={!isOnline} title={!isOnline ? "Cannot add student while offline" : ""}><PlusIcon className="w-4 h-4 mr-2" />Siswa</Button>
                    <Button onClick={() => setIsClassListModalOpen(true)} variant="outline" className="whitespace-nowrap" disabled={!isOnline}><GraduationCapIcon className="w-4 h-4 mr-2"/>Kelola Kelas</Button>
                </div>
            </div>

            {!students.length ? (<div className="text-center py-16 px-6 bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg rounded-2xl shadow-lg shadow-gray-500/10 dark:shadow-black/20 border border-white/20 dark:border-gray-800/50 animate-fade-in-up animation-delay-300"><div className="flex justify-center mb-6"><div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-indigo-200 dark:from-purple-900/50 dark:to-indigo-900/70 rounded-full flex items-center justify-center"><UsersIcon className="w-12 h-12 text-purple-600 dark:text-purple-400" /></div></div><h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Daftar Siswa Kosong</h3><p className="mt-2 text-gray-600 dark:text-gray-400 max-w-md mx-auto">Anda belum memiliki data siswa. Mulai dengan menambahkan siswa pertama Anda.</p><Button onClick={() => handleOpenStudentModal('add')} disabled={!isOnline} className="mt-8 bg-gradient-to-r from-purple-600 to-blue-500 hover:shadow-lg hover:shadow-blue-500/40 text-white font-semibold transition-all duration-300 hover:-translate-y-0.5"><PlusIcon className="w-5 h-5 mr-2" />Tambah Siswa Baru</Button></div>
            ) : !filteredStudents.length ? (<div className="text-center py-16 px-6 bg-white/60 dark:bg-gray-900/60 backdrop-blur-lg rounded-2xl shadow-lg shadow-gray-500/10 dark:shadow-black/20 border border-white/20 dark:border-gray-800/50 animate-fade-in-up animation-delay-300"><div className="flex justify-center mb-6"><div className="w-24 h-24 bg-gradient-to-br from-yellow-100 to-amber-200 dark:from-yellow-900/50 dark:to-amber-900/70 rounded-full flex items-center justify-center"><UsersIcon className="w-12 h-12 text-amber-600 dark:text-amber-400" /></div></div><h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Siswa Tidak Ditemukan</h3><p className="mt-2 text-gray-600 dark:text-gray-400">Tidak ada siswa yang cocok dengan pencarian <span className="font-semibold text-indigo-500">"{searchTerm}"</span>.</p></div>
            ) : (
                viewMode === 'grid' ? renderGridView() : renderListView()
            )}

            <Modal title="Asisten Siswa AI" isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} icon={<SparklesIcon className="h-5 w-5" />}><div className="space-y-4"><p className="text-sm text-gray-600 dark:text-gray-400">Ajukan pertanyaan dalam bahasa natural tentang data siswa Anda. Contoh: "Siapa saja siswa di kelas 10A?" atau "Sebutkan semua kelas yang ada".</p><div className="flex gap-2"><Input value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="Ketik pertanyaan Anda di sini..." onKeyDown={(e) => e.key === 'Enter' && handleAiQuery()} /><Button onClick={handleAiQuery} disabled={isAiLoading}>{isAiLoading ? "..." : "Tanya"}</Button></div>{isAiLoading && <div className="text-center p-4">Menganalisis data...</div>}{aiResponse && (<div className="p-4 bg-gray-100 dark:bg-gray-800/50 rounded-lg max-h-64 overflow-y-auto"><pre className="text-sm whitespace-pre-wrap font-sans">{aiResponse}</pre></div>)}</div></Modal>
            <Modal title={studentModalMode === 'add' ? 'Tambah Siswa Baru' : 'Edit Siswa'} isOpen={isStudentModalOpen} onClose={() => setIsStudentModalOpen(false)} icon={studentModalMode === 'add' ? <PlusIcon className="h-5 w-5"/> : <PencilIcon className="h-5 w-5"/>}>
                <form onSubmit={handleStudentFormSubmit} className="space-y-4">
                    <div><label htmlFor="student-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap</label><Input id="student-name" name="name" defaultValue={currentStudent?.name || ''} placeholder="cth. Budi Santoso" required /></div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis Kelamin</label>
                        <div className="flex gap-4 mt-2">
                            <label className="flex items-center text-gray-700 dark:text-gray-300">
                                <input type="radio" name="gender" value="Laki-laki" defaultChecked={currentStudent?.gender === 'Laki-laki' || !currentStudent} className="form-radio" required/>
                                <span className="ml-2">Laki-laki</span>
                            </label>
                            <label className="flex items-center text-gray-700 dark:text-gray-300">
                                <input type="radio" name="gender" value="Perempuan" defaultChecked={currentStudent?.gender === 'Perempuan'} className="form-radio" />
                                <span className="ml-2">Perempuan</span>
                            </label>
                        </div>
                    </div>
                    <div><label htmlFor="student-class" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelas</label><Select id="student-class" name="class_id" defaultValue={currentStudent?.class_id || ''} required><option value="" disabled>Pilih kelas</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
                    <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => setIsStudentModalOpen(false)}>Batal</Button><Button type="submit" disabled={isAddingStudent || isUpdatingStudent || !isOnline}>{studentModalMode === 'add' ? (isAddingStudent ? 'Menambahkan...' : 'Tambah Siswa') : (isUpdatingStudent ? 'Menyimpan...' : 'Simpan Perubahan')}</Button></div>
                </form>
            </Modal>
            <ClassListModal
                isOpen={isClassListModalOpen}
                onClose={() => setIsClassListModalOpen(false)}
                classes={classes}
                onAdd={() => handleOpenClassFormModal('add')}
                onEdit={(c) => handleOpenClassFormModal('edit', c)}
                onDelete={handleDeleteClassConfirm}
                isLoading={isDeletingClass}
                isOnline={isOnline}
            />
            <Modal title={classModalMode === 'add' ? 'Tambah Kelas Baru' : 'Edit Kelas'} isOpen={isClassFormModalOpen} onClose={() => { setIsClassFormModalOpen(false); setIsClassListModalOpen(true); }} icon={classModalMode === 'add' ? <PlusIcon className="h-5 w-5"/> : <PencilIcon className="h-5 w-5"/>}><form onSubmit={handleClassFormSubmit} className="space-y-4"><div><label htmlFor="class-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Kelas</label><Input id="class-name" value={classNameInput} onChange={(e) => setClassNameInput(e.target.value)} placeholder="cth. Kelas 12A" required /></div><div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => { setIsClassFormModalOpen(false); setIsClassListModalOpen(true); }}>Batal</Button><Button type="submit" disabled={isAddingClass || isUpdatingClass || !isOnline}>{classModalMode === 'add' ? (isAddingClass ? 'Menambahkan...' : 'Tambah Kelas') : (isUpdatingClass ? 'Menyimpan...' : 'Simpan Perubahan')}</Button></div></form></Modal>
            <ConfirmActionModal 
                isOpen={confirmModalState.isOpen}
                onClose={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModalState.onConfirm}
                title={confirmModalState.title}
                message={confirmModalState.message}
                confirmText="Ya, Hapus"
                isLoading={isDeletingStudent || isDeletingClass || !isOnline}
            />
        </div>
    );
};

export default StudentsPage;