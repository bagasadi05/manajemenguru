import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Database } from '../../services/database.types';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { PlusIcon, TrashIcon, EditIcon } from '../Icons';
import LoadingSpinner from '../LoadingSpinner';
import * as db from '@/services/databaseService';

type Schedule = Database['public']['Tables']['schedules']['Row'];

const SchedulePage: React.FC = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const toast = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

    const { data: schedules, isLoading } = useQuery({
        queryKey: ['schedules', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await db.getSchedules(user.id);
            if (error) throw error;
            return data || [];
        },
        enabled: !!user,
    });

    const mutation = useMutation({
        mutationFn: async (scheduleData: { data: Partial<Schedule>, id?: number }) => {
            if (scheduleData.id) {
                const { error } = await db.updateSchedule(scheduleData.id, scheduleData.data);
                if (error) throw error;
            } else {
                const { error } = await db.addSchedule(scheduleData.data as Omit<Schedule, 'id'>);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules'] });
            toast.success("Jadwal berhasil disimpan!");
            setIsModalOpen(false);
            setEditingSchedule(null);
        },
        onError: (error: Error) => {
            toast.error(`Gagal menyimpan: ${error.message}`);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => db.deleteSchedule(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules'] });
            toast.success("Jadwal berhasil dihapus.");
        },
        onError: (error: Error) => {
            toast.error(`Gagal menghapus: ${error.message}`);
        },
    });

    // ... rest of the component
    if (isLoading) return <LoadingSpinner fullScreen />;
    
    return (
        <div className="space-y-6">
            {/* ... JSX ... */}
        </div>
    );
};

export default SchedulePage;