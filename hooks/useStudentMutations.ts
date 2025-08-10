import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useToast } from './useToast';
import { Database } from '@/services/database.types';
import { useNavigate } from 'react-router-dom';

type StudentUpdate = Database['public']['Tables']['students']['Update'];
type ReportRow = Database['public']['Tables']['reports']['Row'];
type AcademicRecordRow = Database['public']['Tables']['academic_records']['Row'];
type QuizPointRow = Database['public']['Tables']['quiz_points']['Row'];
type ViolationInsert = Database['public']['Tables']['violations']['Insert'];
type User = Database['public']['Tables']['users']['Row'];

export const useStudentMutations = (studentId: string | undefined, user: User | null) => {
    const queryClient = useQueryClient();
    const toast = useToast();
    const navigate = useNavigate();

    const onSuccess = (message: string) => {
        toast.success(message);
        queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
    };

    const onError = (error: Error, defaultMessage: string) => {
        toast.error(`${defaultMessage}: ${error.message}`);
    };

    const updateStudentMutation = useMutation({
        mutationFn: async (updateData: StudentUpdate) => {
            const { error } = await supabase.from('students').update(updateData).eq('id', studentId!);
            if (error) throw error;
        },
        onSuccess: () => onSuccess("Profil siswa berhasil diperbarui!"),
        onError: (e: Error) => onError(e, "Gagal memperbarui profil"),
    });

    const updateAvatarMutation = useMutation({
        mutationFn: async (avatar_url: string) => {
            const { error } = await supabase.from('students').update({ avatar_url }).eq('id', studentId!);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Foto profil siswa berhasil diperbarui!");
            queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
            queryClient.invalidateQueries({ queryKey: ['studentsPageData'] });
        },
        onError: (e: Error) => onError(e, "Gagal memperbarui foto profil"),
    });

    const deleteStudentMutation = useMutation({
        mutationFn: async () => {
            if (!studentId) throw new Error("Student ID tidak ditemukan.");
            const dependentTables = ['reports', 'attendance', 'academic_records', 'violations', 'quiz_points'];
            const deletePromises = dependentTables.map(table => supabase.from(table).delete().eq('student_id', studentId));
            const results = await Promise.all(deletePromises);
            for (const result of results) { if (result.error) throw new Error(`Gagal menghapus data terkait: ${result.error.message}`); }
            const { error: studentError } = await supabase.from('students').delete().eq('id', studentId);
            if (studentError) throw new Error(`Gagal menghapus data siswa: ${studentError.message}`);
        },
        onSuccess: () => {
            toast.success('Siswa berhasil dihapus beserta semua data terkait.');
            queryClient.invalidateQueries({ queryKey: ['studentsPageData', 'dashboardData', 'studentDetails'] });
            navigate('/siswa', { replace: true });
        },
        onError: (e: Error) => onError(e, "Proses hapus gagal"),
    });

    const createOrUpdateReportMutation = useMutation({
        mutationFn: async ({ payload, file }: { payload: Omit<ReportRow, 'created_at' | 'id'> & {id?: string}, file: File | null }) => {
            let attachment_url = payload.attachment_url;
            if (file && user && studentId) {
                const filePath = `${user.id}/${studentId}-${Date.now()}-${file.name}`;
                const { error: uploadError } = await supabase.storage.from('teacher_assets').upload(filePath, file);
                if (uploadError) throw uploadError;
                attachment_url = supabase.storage.from('teacher_assets').getPublicUrl(filePath).data.publicUrl;
            }

            const { id, ...dataToMutate } = { ...payload, attachment_url, user_id: user!.id, student_id: studentId! };

            if (id) {
                const { error } = await supabase.from('reports').update(dataToMutate).eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('reports').insert(dataToMutate);
                if (error) throw error;
            }
        },
        onSuccess: () => onSuccess("Laporan berhasil disimpan!"),
        onError: (e: Error) => onError(e, "Gagal menyimpan laporan"),
    });

    const deleteReportMutation = useMutation({
        mutationFn: async (reportId: string) => { const { error } = await supabase.from('reports').delete().eq('id', reportId); if (error) throw error; },
        onSuccess: () => onSuccess("Laporan berhasil dihapus."),
        onError: (e: Error) => onError(e, "Gagal menghapus laporan"),
    });

    const createOrUpdateAcademicMutation = useMutation({
        mutationFn: async (payload: Omit<AcademicRecordRow, 'created_at' | 'id'> & { id?: string }) => {
            const { id, ...dataToMutate } = { ...payload, user_id: user!.id, student_id: studentId! };
            if(id) {
                const { error } = await supabase.from('academic_records').update(dataToMutate).eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('academic_records').insert(dataToMutate);
                if (error) throw error;
            }
        },
        onSuccess: () => onSuccess("Nilai mata pelajaran berhasil disimpan!"),
        onError: (e: Error) => onError(e, "Gagal menyimpan nilai"),
    });

    const deleteAcademicMutation = useMutation({
        mutationFn: async (recordId: string) => { const { error } = await supabase.from('academic_records').delete().eq('id', recordId); if (error) throw error; },
        onSuccess: () => onSuccess("Nilai mata pelajaran berhasil dihapus."),
        onError: (e: Error) => onError(e, "Gagal menghapus nilai"),
    });

    const createOrUpdateQuizPointMutation = useMutation({
        mutationFn: async (payload: Omit<QuizPointRow, 'created_at' | 'id'> & { id?: number }) => {
            const { id, ...dataToMutate } = { ...payload, user_id: user!.id, student_id: studentId! };
            if (id) {
                const { error } = await supabase.from('quiz_points').update(dataToMutate).eq('id', id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('quiz_points').insert(dataToMutate);
                if (error) throw error;
            }
        },
        onSuccess: () => onSuccess("Poin keaktifan berhasil disimpan!"),
        onError: (e: Error) => onError(e, "Gagal menyimpan poin"),
    });

    const deleteQuizPointMutation = useMutation({
        mutationFn: async (recordId: number) => { const { error } = await supabase.from('quiz_points').delete().eq('id', recordId); if (error) throw error; },
        onSuccess: () => onSuccess("Poin keaktifan berhasil dihapus."),
        onError: (e: Error) => onError(e, "Gagal menghapus poin"),
    });

    const createOrUpdateViolationMutation = useMutation({
        mutationFn: async (payload: ViolationInsert) => {
            const { id, ...dataToMutate } = { ...payload, user_id: user!.id, student_id: studentId! };
            if(id) {
                const { error } = await supabase.from('violations').update(dataToMutate).eq('id', id as any);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('violations').insert(dataToMutate);
                if (error) throw error;
            }
        },
        onSuccess: () => onSuccess("Data pelanggaran berhasil disimpan!"),
        onError: (e: Error) => onError(e, "Gagal menyimpan pelanggaran"),
    });

    const deleteViolationMutation = useMutation({
        mutationFn: async (violationId: string) => { const { error } = await supabase.from('violations').delete().eq('id', violationId); if (error) throw error; },
        onSuccess: () => onSuccess("Data pelanggaran berhasil dihapus."),
        onError: (e: Error) => onError(e, "Gagal menghapus pelanggaran"),
    });

    return {
        updateStudentMutation,
        updateAvatarMutation,
        deleteStudentMutation,
        createOrUpdateReportMutation,
        deleteReportMutation,
        createOrUpdateAcademicMutation,
        deleteAcademicMutation,
        createOrUpdateQuizPointMutation,
        deleteQuizPointMutation,
        createOrUpdateViolationMutation,
        deleteViolationMutation,
    };
};
