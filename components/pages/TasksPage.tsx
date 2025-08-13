import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Database } from '../../services/database.types';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { PlusIcon, TrashIcon, EditIcon } from '../Icons';
import LoadingSpinner from '../LoadingSpinner';
import * as db from '@/services/databaseService';

type Task = Database['public']['Tables']['tasks']['Row'];

const TasksPage: React.FC = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const toast = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    const { data: tasks, isLoading } = useQuery({
        queryKey: ['tasks', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await db.getTasks(user.id);
            if (error) throw error;
            return data || [];
        },
        enabled: !!user,
    });

    const mutation = useMutation({
        mutationFn: async ({ data, id }: { data: Partial<Task>, id?: string }) => {
            if (id) {
                const { error } = await db.updateTask(id, data);
                if (error) throw error;
            } else {
                const { error } = await db.addTask(data as Omit<Task, 'id' | 'created_at'>);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            toast.success("Tugas berhasil disimpan!");
            setIsModalOpen(false);
            setEditingTask(null);
        },
        onError: (error: Error) => {
            toast.error(`Gagal menyimpan: ${error.message}`);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => db.deleteTask(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            toast.success("Tugas berhasil dihapus.");
        },
        onError: (error: Error) => {
            toast.error(`Gagal menghapus: ${error.message}`);
        },
    });

    // ... rest of component
    if (isLoading) return <LoadingSpinner fullScreen />;

    return (
        <div className="space-y-4">
            {/* ... JSX ... */}
        </div>
    );
};

export default TasksPage;
