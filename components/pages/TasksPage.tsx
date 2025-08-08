
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Database } from '../../services/database.types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { PlusIcon, PencilIcon, TrashIcon, CheckSquareIcon } from '../Icons';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';

type Task = Database['public']['Tables']['tasks']['Row'];
type TaskStatus = Task['status'];

const statusConfig: Record<TaskStatus, { title: string, color: string }> = {
    todo: { title: 'Akan Dikerjakan', color: 'border-yellow-500' },
    in_progress: { title: 'Sedang Dikerjakan', color: 'border-blue-500' },
    done: { title: 'Selesai', color: 'border-green-500' },
};

const getDueDateInfo = (dueDate: string | null) => {
    if (!dueDate) return { status: 'none', text: 'Tanpa Batas Waktu' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parts = dueDate.split('-').map(Number);
    const dueDateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    dueDateObj.setHours(0,0,0,0);
    
    const oneDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.ceil((dueDateObj.getTime() - today.getTime()) / oneDay);

    if (diffDays < 0) {
        return { status: 'overdue', text: `Terlambat ${-diffDays} hari`, color: 'text-red-500 dark:text-red-400', dot: 'bg-red-500' };
    }
    if (diffDays === 0) {
        return { status: 'today', text: 'Jatuh Tempo Hari Ini', color: 'text-orange-500 dark:text-orange-400', dot: 'bg-orange-500' };
    }
    return { status: 'upcoming', text: `Jatuh tempo dalam ${diffDays} hari`, color: 'text-gray-500 dark:text-gray-400', dot: 'bg-gray-400' };
};

const TaskCard: React.FC<{ 
    task: Task; 
    onEdit: (task: Task) => void; 
    onDelete: (id: string) => void; 
    isOnline: boolean;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
    onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
}> = ({ task, onEdit, onDelete, isOnline, onDragStart, onDragEnd }) => {
    const dueDateInfo = getDueDateInfo(task.due_date);

    return (
        <div 
            draggable={isOnline}
            onDragStart={(e) => onDragStart(e, task.id)}
            onDragEnd={onDragEnd}
            className="group relative bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing transition-all hover:shadow-lg hover:-translate-y-0.5"
        >
            <div className="flex justify-between items-start gap-3">
                <p className="font-semibold text-base text-gray-800 dark:text-gray-100 break-words">{task.title}</p>
                <div title={dueDateInfo.text} className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${dueDateInfo.dot}`}></div>
            </div>
            {task.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 break-words">{task.description}</p>}
            {task.due_date && 
                <div className="text-xs font-medium mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-gray-700/50">
                    <span className={dueDateInfo.color}>{dueDateInfo.text}</span>
                </div>
            }
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(task)} disabled={!isOnline}><PencilIcon className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => onDelete(task.id)} disabled={!isOnline}><TrashIcon className="h-4 w-4" /></Button>
            </div>
        </div>
    );
};

const TasksPage: React.FC = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const toast = useToast();
    const isOnline = useOfflineStatus();
    const location = useLocation();
    const navigate = useNavigate();
    const [modalState, setModalState] = useState<{ isOpen: boolean; mode: 'add' | 'edit'; data: Task | null }>({ isOpen: false, mode: 'add', data: null });
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [draggedOverStatus, setDraggedOverStatus] = useState<TaskStatus | null>(null);

    const { data: tasks = [], isLoading } = useQuery({
        queryKey: ['tasks', user?.id],
        queryFn: async (): Promise<Task[]> => {
            const { data, error } = await supabase.from('tasks').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: !!user,
    });
    
    useEffect(() => {
        const prefillData = location.state?.prefill;
        if (prefillData) {
            const prefilledTask: Task = {
                id: '', // Dummy id for form defaultValue
                user_id: user?.id || '',
                created_at: new Date().toISOString(),
                title: prefillData.title || '',
                description: prefillData.description || '',
                due_date: prefillData.due_date || null,
                status: prefillData.status || 'todo',
            };
            setModalState({ isOpen: true, mode: 'add', data: prefilledTask });
            // Clear the state so it doesn't re-trigger on refresh
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, user, navigate]);

    const taskMutation = useMutation({
        mutationFn: async (taskData: { mode: 'add' | 'edit' | 'status_change', data: Partial<Task>, id?: string }) => {
            const { mode, data, id } = taskData;
            if (mode === 'add') {
                const { error } = await supabase.from('tasks').insert(data as Database['public']['Tables']['tasks']['Insert']);
                if (error) throw error;
            } else if (id) {
                const { error } = await supabase.from('tasks').update(data).eq('id', id);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
            toast.success("Tugas berhasil diperbarui!");
            setModalState({ isOpen: false, mode: 'add', data: null });
        },
        onError: (error: Error) => toast.error(error.message),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('tasks').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
            toast.success("Tugas berhasil dihapus.");
        },
        onError: (error: Error) => toast.error(error.message),
    });

    const tasksByStatus = useMemo(() => {
        return tasks.reduce((acc, task) => {
            acc[task.status].push(task);
            return acc;
        }, { todo: [], in_progress: [], done: [] } as Record<TaskStatus, Task[]>);
    }, [tasks]);

    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const taskData: Partial<Task> = {
            title: formData.get('title') as string,
            description: formData.get('description') as string,
            due_date: formData.get('due_date') ? (formData.get('due_date') as string) : null,
        };

        if (modalState.mode === 'add') {
            taskMutation.mutate({ mode: 'add', data: { ...taskData, user_id: user!.id, status: 'todo' } });
        } else if (modalState.data) {
            taskMutation.mutate({ mode: 'edit', data: taskData, id: modalState.data.id });
        }
    };
    
    const handleStatusChange = (id: string, newStatus: TaskStatus) => {
        taskMutation.mutate({ mode: 'status_change', data: { status: newStatus }, id });
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
        if (!isOnline) return;
        setDraggedTaskId(id);
        e.dataTransfer.setData('text/plain', id);
        e.currentTarget.style.opacity = '0.5';
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.style.opacity = '1';
        setDraggedTaskId(null);
        setDraggedOverStatus(null);
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, status: TaskStatus) => {
        e.preventDefault();
        if (status !== draggedOverStatus) {
            setDraggedOverStatus(status);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, newStatus: TaskStatus) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        if (!id) return;

        const task = tasks.find(t => t.id === id);
        if (task && task.status !== newStatus) {
            handleStatusChange(id, newStatus);
        }
        setDraggedTaskId(null);
        setDraggedOverStatus(null);
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-indigo-500 to-purple-500 text-transparent bg-clip-text">Manajemen Tugas</h1>
                    <p className="mt-1 text-gray-500 dark:text-gray-400">Atur semua tugas dan pekerjaan Anda dengan papan Kanban interaktif.</p>
                </div>
                <Button onClick={() => setModalState({ isOpen: true, mode: 'add', data: null })} disabled={!isOnline} className="self-end md:self-center">
                    <PlusIcon className="w-5 h-5 mr-2" /> Tambah Tugas
                </Button>
            </header>

            <div className="flex gap-6 overflow-x-auto p-2 -mx-2">
                {(Object.keys(statusConfig) as TaskStatus[]).map(status => (
                    <div 
                        key={status}
                        className={`bg-gray-100 dark:bg-gray-900/50 rounded-xl p-4 flex-1 min-w-[320px] max-w-[380px] flex flex-col transition-colors duration-300 ${draggedOverStatus === status ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
                        onDragOver={(e) => handleDragOver(e, status)}
                        onDrop={(e) => handleDrop(e, status)}
                    >
                        <h3 className={`font-bold text-lg pb-3 mb-4 border-b-4 ${statusConfig[status].color} flex justify-between items-center`}>
                            <span>{statusConfig[status].title}</span>
                            <span className="text-base font-normal text-gray-500 dark:text-gray-400">{tasksByStatus[status].length}</span>
                        </h3>
                        <div className="space-y-4 h-[60vh] overflow-y-auto pr-2 -mr-2">
                            {tasksByStatus[status].length > 0 ? (
                                tasksByStatus[status].map(task => (
                                    <TaskCard 
                                        key={task.id} 
                                        task={task} 
                                        onEdit={(t) => setModalState({ isOpen: true, mode: 'edit', data: t })}
                                        onDelete={(id) => deleteMutation.mutate(id)}
                                        isOnline={isOnline}
                                        onDragStart={handleDragStart}
                                        onDragEnd={handleDragEnd}
                                    />
                                ))
                            ) : (
                                draggedOverStatus !== status && (
                                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 dark:text-gray-500 p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                                        <CheckSquareIcon className="w-12 h-12 mb-2"/>
                                        <p className="font-semibold">Kolom Kosong</p>
                                    </div>
                                )
                            )}
                            {draggedOverStatus === status && (
                                <div className="h-24 rounded-lg border-2 border-dashed border-blue-500 bg-blue-500/10 animate-pulse-border"></div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <Modal title={modalState.mode === 'add' ? 'Tambah Tugas Baru' : 'Edit Tugas'} isOpen={modalState.isOpen} onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Judul</label>
                        <Input id="title" name="title" defaultValue={modalState.data?.title || ''} required />
                    </div>
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Deskripsi (Opsional)</label>
                        <textarea id="description" name="description" defaultValue={modalState.data?.description || ''} rows={4} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600"/>
                    </div>
                    <div>
                        <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tanggal Jatuh Tempo (Opsional)</label>
                        <Input id="due_date" name="due_date" type="date" defaultValue={modalState.data?.due_date || ''} />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}>Batal</Button>
                        <Button type="submit" disabled={taskMutation.isPending || !isOnline}>{taskMutation.isPending ? 'Menyimpan...' : 'Simpan'}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default TasksPage;