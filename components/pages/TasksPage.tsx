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
import { PlusIcon, PencilIcon, TrashIcon, CheckSquareIcon, CalendarIcon } from '../Icons';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';

type Task = Database['public']['Tables']['tasks']['Row'];
type TaskStatus = Task['status'];
type TaskMutationVars =
    | { mode: 'add', data: Database['public']['Tables']['tasks']['Insert'] }
    | { mode: 'edit', data: Database['public']['Tables']['tasks']['Update'], id: string }
    | { mode: 'status_change', data: { status: TaskStatus }, id: string };

const statusConfig: Record<TaskStatus, { title: string; color: string }> = {
    todo: { title: 'Akan Dikerjakan', color: 'bg-yellow-500' },
    in_progress: { title: 'Sedang Dikerjakan', color: 'bg-blue-500' },
    done: { title: 'Selesai', color: 'bg-green-500' },
};

const getDueDateInfo = (dueDate: string | null) => {
    if (!dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parts = dueDate.split('-').map(Number);
    const dueDateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    dueDateObj.setHours(0,0,0,0);
    
    const oneDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.round((dueDateObj.getTime() - today.getTime()) / oneDay);

    if (diffDays < 0) {
        return { text: `Terlambat ${-diffDays} hari`, color: 'text-red-400' };
    }
    if (diffDays === 0) {
        return { text: 'Jatuh Tempo Hari Ini', color: 'text-orange-400' };
    }
    return { text: `Jatuh tempo dalam ${diffDays} hari`, color: 'text-gray-400' };
};

const TaskCard: React.FC<{ 
    task: Task; 
    onEdit: (task: Task) => void; 
    onDelete: (id: string) => void;
    onStatusChange: (id: string, newStatus: TaskStatus) => void;
    isOnline: boolean;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
    onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
}> = ({ task, onEdit, onDelete, onStatusChange, isOnline, onDragStart, onDragEnd }) => {
    const dueDateInfo = getDueDateInfo(task.due_date);
    const [isCompleted, setIsCompleted] = useState(task.status === 'done');
    
    const handleCheck = () => {
        if (!isOnline) return;
        setIsCompleted(true);
        // Add a slight delay to allow the check animation to be seen before moving
        setTimeout(() => onStatusChange(task.id, 'done'), 300);
    };

    return (
        <div 
            draggable={isOnline}
            onDragStart={(e) => onDragStart(e, task.id)}
            onDragEnd={onDragEnd}
            className={`group relative bg-black/20 backdrop-blur-sm border border-white/20 p-3.5 rounded-xl cursor-grab active:cursor-grabbing transition-all hover:shadow-lg hover:-translate-y-1 hover:border-purple-400 ${isCompleted ? 'opacity-60' : ''}`}
        >
            <div className="flex items-start gap-3">
                {task.status !== 'done' && (
                    <input 
                        type="checkbox" 
                        checked={isCompleted}
                        onChange={handleCheck}
                        disabled={!isOnline}
                        className="mt-1 flex-shrink-0 form-checkbox h-5 w-5 rounded-full border-gray-500 bg-transparent text-green-500 focus:ring-green-500/50 transition duration-150 ease-in-out" 
                        aria-label={`Tandai selesai untuk ${task.title}`}
                    />
                )}
                <div className="flex-grow">
                    <p className={`font-semibold text-base text-white break-words ${isCompleted ? 'line-through' : ''}`}>{task.title}</p>
                </div>
            </div>

            {task.description && <p className="text-sm text-gray-300 mt-2 ml-8 break-words">{task.description}</p>}
            
            {dueDateInfo && 
                <div className={`text-xs font-semibold mt-3 flex items-center gap-2 ml-8 ${dueDateInfo.color}`}>
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>{dueDateInfo.text}</span>
                </div>
            }

            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7 bg-white/10 text-white hover:bg-white/20" onClick={() => onEdit(task)} disabled={!isOnline}><PencilIcon className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 bg-white/10 hover:bg-red-500/50 hover:text-white" onClick={() => onDelete(task.id)} disabled={!isOnline}><TrashIcon className="h-4 w-4" /></Button>
            </div>
        </div>
    );
};

const TaskColumn: React.FC<{
    status: TaskStatus;
    tasks: Task[];
    onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
    onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragOver: (e: React.DragEvent<HTMLDivElement>, status: TaskStatus) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>, status: TaskStatus) => void;
    onTaskEdit: (task: Task) => void;
    onTaskDelete: (id: string) => void;
    onStatusChange: (id: string, newStatus: TaskStatus) => void;
    onQuickAdd: (title: string) => void;
    draggedOverStatus: TaskStatus | null;
    isOnline: boolean;
}> = ({ status, tasks, onDragStart, onDragEnd, onDragOver, onDrop, onTaskEdit, onTaskDelete, onStatusChange, onQuickAdd, draggedOverStatus, isOnline }) => {
    
    const [quickAddTitle, setQuickAddTitle] = useState('');

    const handleQuickAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (quickAddTitle.trim()) {
            onQuickAdd(quickAddTitle.trim());
            setQuickAddTitle('');
        }
    };
    
    return (
        <div
            className={`bg-white/5 backdrop-blur-lg rounded-2xl border p-4 flex-1 min-w-[320px] max-w-[380px] flex flex-col transition-all duration-300 ${draggedOverStatus === status ? 'border-2 border-purple-500 bg-white/10' : 'border-white/10'}`}
            onDragOver={(e) => onDragOver(e, status)}
            onDrop={(e) => onDrop(e, status)}
        >
            <div className={`font-bold text-lg pb-3 mb-4 border-b-4 ${statusConfig[status].color.replace('bg-', 'border-')} flex justify-between items-center`}>
                <span className="text-white">{statusConfig[status].title}</span>
                <span className="text-sm font-semibold text-gray-300 bg-black/20 rounded-full px-2.5 py-0.5">{tasks.length}</span>
            </div>
            
            {status === 'todo' && (
                <form onSubmit={handleQuickAddSubmit} className="mb-4">
                    <Input 
                        value={quickAddTitle}
                        onChange={(e) => setQuickAddTitle(e.target.value)}
                        placeholder="+ Tambah tugas cepat"
                        aria-label="Tambah tugas cepat"
                        disabled={!isOnline}
                        className="h-9 bg-white/10 border-white/20 placeholder:text-gray-400 text-white focus:bg-white/20 focus:border-purple-400"
                    />
                </form>
            )}
            
            <div className="space-y-4 h-full overflow-y-auto pr-2 -mr-2">
                {tasks.length > 0 ? (
                    tasks.map(task => (
                        <TaskCard 
                            key={task.id} 
                            task={task} 
                            onEdit={onTaskEdit}
                            onDelete={onTaskDelete}
                            onStatusChange={onStatusChange}
                            isOnline={isOnline}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                        />
                    ))
                ) : (
                    draggedOverStatus !== status && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-4 border-2 border-dashed border-white/10 rounded-lg">
                            <CheckSquareIcon className="w-12 h-12 mb-2"/>
                            <p className="font-semibold text-sm">{status === 'done' ? 'Kerja bagus!' : 'Kolom Kosong'}</p>
                            <p className="text-xs">{status === 'done' ? 'Semua tugas selesai.' : 'Seret tugas ke sini.'}</p>
                        </div>
                    )
                )}
                {draggedOverStatus === status && (
                    <div className="h-24 rounded-lg border-2 border-dashed border-purple-500 bg-purple-500/10 animate-pulse"></div>
                )}
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
        mutationFn: async (taskData: TaskMutationVars) => {
            if (taskData.mode === 'add') {
                const { error } = await supabase.from('tasks').insert(taskData.data);
                if (error) throw error;
            } else { // mode is 'edit' or 'status_change'
                const { error } = await supabase.from('tasks').update(taskData.data).eq('id', taskData.id);
                if (error) throw error;
            }
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
            if(variables.mode !== 'status_change') {
               toast.success("Tugas berhasil disimpan!");
               setModalState({ isOpen: false, mode: 'add', data: null });
            } else {
               toast.success("Status tugas diperbarui!");
            }
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
        const taskData = {
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

    const handleQuickAdd = (title: string) => {
        taskMutation.mutate({ mode: 'add', data: { title, user_id: user!.id, status: 'todo' } });
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
        if (!isOnline) return;
        setDraggedTaskId(id);
        e.dataTransfer.setData('text/plain', id);
        e.currentTarget.classList.add('opacity-50', 'rotate-3', 'scale-105');
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('opacity-50', 'rotate-3', 'scale-105');
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
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Manajemen Tugas</h1>
                    <p className="mt-1 text-indigo-200">Atur semua tugas Anda dengan papan Kanban interaktif.</p>
                </div>
                <Button 
                    onClick={() => setModalState({ isOpen: true, mode: 'add', data: null })} 
                    disabled={!isOnline} 
                    className="self-end md:self-center bg-white/10 border-white/20 hover:bg-white/20 text-white transition-all duration-300 hover:-translate-y-0.5"
                >
                    <PlusIcon className="w-5 h-5 mr-2" /> Tambah Tugas Baru
                </Button>
            </header>

            <div className="relative z-10 flex gap-6 overflow-x-auto p-2 -mx-2 flex-grow">
                {(Object.keys(statusConfig) as TaskStatus[]).map(status => (
                   <TaskColumn
                        key={status}
                        status={status}
                        tasks={tasksByStatus[status]}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onTaskEdit={(t) => setModalState({ isOpen: true, mode: 'edit', data: t })}
                        onTaskDelete={(id) => deleteMutation.mutate(id)}
                        onStatusChange={handleStatusChange}
                        onQuickAdd={handleQuickAdd}
                        draggedOverStatus={draggedOverStatus}
                        isOnline={isOnline}
                   />
                ))}
            </div>

            <Modal title={modalState.mode === 'add' ? 'Tambah Tugas Baru' : 'Edit Tugas'} isOpen={modalState.isOpen} onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Judul</label>
                        <Input id="title" name="title" defaultValue={modalState.data?.title || ''} required className="mt-1" />
                    </div>
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Deskripsi (Opsional)</label>
                        <textarea id="description" name="description" defaultValue={modalState.data?.description || ''} rows={4} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600"/>
                    </div>
                    <div>
                        <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tanggal Jatuh Tempo (Opsional)</label>
                        <Input id="due_date" name="due_date" type="date" defaultValue={modalState.data?.due_date || ''} className="mt-1" />
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