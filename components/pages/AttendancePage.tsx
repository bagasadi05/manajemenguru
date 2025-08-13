import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Database } from '../../services/database.types';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/Card';
import { Select } from '../ui/Select';
import { CheckCircleIcon, XCircleIcon, BookOpenIcon, UserMinusIcon } from '../Icons';
import { AttendanceStatus } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import * as db from '@/services/databaseService';

type ClassRow = Database['public']['Tables']['classes']['Row'];
type StudentRow = Database['public']['Tables']['students']['Row'];
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];

const AttendancePage: React.FC = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const toast = useToast();
    
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});

    const { data: classes, isLoading: isLoadingClasses } = useQuery({
        queryKey: ['classes', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await db.getClasses(user.id);
            if (error) throw error;
            return data || [];
        },
        enabled: !!user,
    });

    const { data: students, isLoading: isLoadingStudents } = useQuery({
        queryKey: ['studentsOfClass', selectedClass],
        queryFn: async () => {
            if (!selectedClass) return [];
            const { data, error } = await db.getStudentsByClass(selectedClass);
            if (error) throw error;
            return data || [];
        },
        enabled: !!selectedClass,
    });

    const { data: initialAttendance, isLoading: isLoadingAttendance } = useQuery({
        queryKey: ['attendance', selectedClass, selectedDate],
        queryFn: async () => {
            if (!students || students.length === 0) return {};
            const { data, error } = await db.getAttendanceByDate(students.map(s => s.id), selectedDate);
            if (error) throw error;
            return (data || []).reduce((acc, record) => {
                acc[record.student_id] = record.status as AttendanceStatus;
                return acc;
            }, {} as Record<string, AttendanceStatus>);
        },
        enabled: !!students && students.length > 0,
    });

    useEffect(() => {
        if (classes && classes.length > 0 && !selectedClass) {
            setSelectedClass(classes[0].id);
        }
    }, [classes, selectedClass]);

    useEffect(() => {
        setAttendance(initialAttendance || {});
    }, [initialAttendance]);

    const mutation = useMutation({
        mutationFn: (recordsToUpsert: Partial<AttendanceRow>[]) => db.upsertAttendance(recordsToUpsert),
        onSuccess: () => {
            toast.success("Absensi berhasil disimpan!");
            queryClient.invalidateQueries({ queryKey: ['attendance', selectedClass, selectedDate] });
        },
        onError: (error: Error) => {
            toast.error(`Gagal menyimpan: ${error.message}`);
        }
    });

    const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
        setAttendance(prev => ({ ...prev, [studentId]: status }));
    };

    const handleSave = () => {
        if (!user || !students) return;
        const recordsToUpsert = students.map(student => ({
            student_id: student.id,
            date: selectedDate,
            status: attendance[student.id] || AttendanceStatus.Hadir,
            user_id: user.id,
        }));
        mutation.mutate(recordsToUpsert);
    };

    const attendanceSummary = useMemo(() => {
        if (!students) return { Hadir: 0, Sakit: 0, Izin: 0, Alpha: 0 };
        return students.reduce((acc, student) => {
            const status = attendance[student.id] || AttendanceStatus.Hadir;
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, { Hadir: 0, Sakit: 0, Izin: 0, Alpha: 0 } as Record<AttendanceStatus, number>);
    }, [attendance, students]);

    const isLoading = isLoadingClasses || isLoadingStudents || isLoadingAttendance;

    return (
        <div className="space-y-6">
            {/* ... JSX ... */}
        </div>
    );
};

export default AttendancePage;
