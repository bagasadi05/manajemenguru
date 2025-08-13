import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Link } from 'react-router-dom';
import { Database } from '../../services/database.types';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { PlusIcon, UserIcon, TrashIcon, EditIcon } from '../Icons';
import LoadingSpinner from '../LoadingSpinner';
import * as db from '@/services/databaseService';

type Student = Database['public']['Tables']['students']['Row'];
type Class = Database['public']['Tables']['classes']['Row'];

const StudentsPage: React.FC = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const toast = useToast();
    const [modal, setModal] = useState<'closed' | 'add-student' | 'edit-student' | 'add-class' | 'edit-class'>('closed');
    const [editingData, setEditingData] = useState<Student | Class | null>(null);
    const [filter, setFilter] = useState<{ classId: string; searchTerm: string }>({ classId: 'all', searchTerm: '' });

    const { data, isLoading } = useQuery({
        queryKey: ['studentsPageData', user?.id],
        queryFn: async () => {
            if (!user) return { students: [], classes: [] };
            const [classesRes, studentsRes] = await Promise.all([
                db.getClasses(user.id),
                db.getStudents(user.id)
            ]);
            if (classesRes.error || studentsRes.error) throw new Error("Failed to fetch data.");
            return { classes: classesRes.data || [], students: studentsRes.data || [] };
        },
        enabled: !!user,
    });

    const { classes = [], students = [] } = data || {};

    const addStudentMutation = useMutation({
        mutationFn: (newStudent: Database['public']['Tables']['students']['Insert']) => db.addStudent(newStudent as Student),
        onSuccess: () => { toast.success("Siswa berhasil ditambahkan!"); queryClient.invalidateQueries({ queryKey: ['studentsPageData'] }); setModal('closed'); },
        onError: (err: Error) => toast.error(err.message),
    });
    const editStudentMutation = useMutation({
        mutationFn: ({ id, ...updateData }: { id: string } & Partial<Student>) => db.updateStudent(id, updateData),
        onSuccess: () => { toast.success("Siswa berhasil diperbarui!"); queryClient.invalidateQueries({ queryKey: ['studentsPageData'] }); setModal('closed'); },
        onError: (err: Error) => toast.error(err.message),
    });
    const deleteStudentMutation = useMutation({
        mutationFn: (studentId: string) => db.deleteStudent(studentId),
        onSuccess: () => { toast.success("Siswa berhasil dihapus."); queryClient.invalidateQueries({ queryKey: ['studentsPageData'] }); },
        onError: (err: Error) => toast.error(err.message),
    });
    const addClassMutation = useMutation({
        mutationFn: (newClass: Omit<Class, 'id' | 'created_at'>) => db.addClass(newClass),
        onSuccess: () => { toast.success("Kelas berhasil ditambahkan!"); queryClient.invalidateQueries({ queryKey: ['studentsPageData'] }); setModal('closed'); },
        onError: (err: Error) => toast.error(err.message),
    });
    const editClassMutation = useMutation({
        mutationFn: ({ id, ...updateData }: { id: string } & Partial<Class>) => db.updateClass(id, updateData),
        onSuccess: () => { toast.success("Kelas berhasil diperbarui!"); queryClient.invalidateQueries({ queryKey: ['studentsPageData'] }); setModal('closed'); },
        onError: (err: Error) => toast.error(err.message),
    });
    const deleteClassMutation = useMutation({
        mutationFn: (classId: string) => db.deleteClass(classId),
        onSuccess: () => { toast.success("Kelas berhasil dihapus."); queryClient.invalidateQueries({ queryKey: ['studentsPageData'] }); },
        onError: (err: Error) => toast.error(err.message),
    });

    // ... rest of the component
    if (isLoading) return <LoadingSpinner fullScreen />;

    return (
        <div className="space-y-6">
            {/* ... JSX ... */}
        </div>
    );
};

export default StudentsPage;