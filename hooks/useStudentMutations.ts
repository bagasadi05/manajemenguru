import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from './useToast';
import { Database } from '@/services/database.types';
import { useNavigate } from 'react-router-dom';
import * as db from '@/services/databaseService';
import * as storage from '@/services/storageService';

type User = Database['public']['Tables']['users']['Row'];
type StudentUpdate = Database['public']['Tables']['students']['Update'];
type ReportRow = Database['public']['Tables']['reports']['Row'];
type AcademicRecordRow = Database['public']['Tables']['academic_records']['Row'];
type QuizPointRow = Database['public']['Tables']['quiz_points']['Row'];
type ViolationInsert = Database['public']['Tables']['violations']['Insert'];


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
        mutationFn: (updateData: StudentUpdate) => db.updateStudent(studentId!, updateData),
        onSuccess: () => onSuccess("Profil siswa berhasil diperbarui!"),
        onError: (e: Error) => onError(e, "Gagal memperbarui profil"),
    });

    const updateAvatarMutation = useMutation({
        mutationFn: (avatar_url: string) => db.updateStudent(studentId!, { avatar_url }),
        onSuccess: () => {
            toast.success("Foto profil siswa berhasil diperbarui!");
            queryClient.invalidateQueries({ queryKey: ['studentDetails', studentId] });
            queryClient.invalidateQueries({ queryKey: ['studentsPageData'] });
        },
        onError: (e: Error) => onError(e, "Gagal memperbarui foto profil"),
    });

    const deleteStudentMutation = useMutation({
        mutationFn: () => {
            if (!studentId) throw new Error("Student ID tidak ditemukan.");
            return db.deleteStudent(studentId);
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
                const { upload, url } = await storage.uploadStudentAsset(user.id, studentId, file);
                if (upload.error) throw upload.error;
                attachment_url = url;
            }

            const { id, ...dataToMutate } = { ...payload, attachment_url, user_id: user!.id, student_id: studentId! };

            return id ? db.updateReport(id, dataToMutate) : db.addReport(dataToMutate);
        },
        onSuccess: () => onSuccess("Laporan berhasil disimpan!"),
        onError: (e: Error) => onError(e, "Gagal menyimpan laporan"),
    });

    const deleteReportMutation = useMutation({
        mutationFn: (reportId: string) => db.deleteReport(reportId),
        onSuccess: () => onSuccess("Laporan berhasil dihapus."),
        onError: (e: Error) => onError(e, "Gagal menghapus laporan"),
    });

    const createOrUpdateAcademicMutation = useMutation({
        mutationFn: (payload: Omit<AcademicRecordRow, 'created_at' | 'id'> & { id?: string }) => {
            const { id, ...dataToMutate } = { ...payload, user_id: user!.id, student_id: studentId! };
            return id ? db.updateAcademicRecord(id, dataToMutate) : db.addAcademicRecord(dataToMutate);
        },
        onSuccess: () => onSuccess("Nilai mata pelajaran berhasil disimpan!"),
        onError: (e: Error) => onError(e, "Gagal menyimpan nilai"),
    });

    const deleteAcademicMutation = useMutation({
        mutationFn: (recordId: string) => db.deleteAcademicRecord(recordId),
        onSuccess: () => onSuccess("Nilai mata pelajaran berhasil dihapus."),
        onError: (e: Error) => onError(e, "Gagal menghapus nilai"),
    });

    const createOrUpdateQuizPointMutation = useMutation({
        mutationFn: (payload: Omit<QuizPointRow, 'created_at' | 'id'> & { id?: number }) => {
            const { id, ...dataToMutate } = { ...payload, user_id: user!.id, student_id: studentId! };
            return id ? db.updateQuizPoint(id, dataToMutate) : db.addQuizPoints([dataToMutate]);
        },
        onSuccess: () => onSuccess("Poin keaktifan berhasil disimpan!"),
        onError: (e: Error) => onError(e, "Gagal menyimpan poin"),
    });

    const deleteQuizPointMutation = useMutation({
        mutationFn: (recordId: number) => db.deleteQuizPoint(recordId),
        onSuccess: () => onSuccess("Poin keaktifan berhasil dihapus."),
        onError: (e: Error) => onError(e, "Gagal menghapus poin"),
    });

    const createOrUpdateViolationMutation = useMutation({
        mutationFn: (payload: ViolationInsert) => {
            const { id, ...dataToMutate } = { ...payload, user_id: user!.id, student_id: studentId! };
            return id ? db.updateViolation(id as string, dataToMutate) : db.addViolations([dataToMutate]);
        },
        onSuccess: () => onSuccess("Data pelanggaran berhasil disimpan!"),
        onError: (e: Error) => onError(e, "Gagal menyimpan pelanggaran"),
    });

    const deleteViolationMutation = useMutation({
        mutationFn: (violationId: string) => db.deleteViolation(violationId),
        onSuccess: () => onSuccess("Data pelanggaran berhasil dihapus."),
        onError: (e: Error) => onError(e, "Gagal menghapus pelanggaran"),
    });

    return {
        updateStudentMutation, updateAvatarMutation, deleteStudentMutation,
        createOrUpdateReportMutation, deleteReportMutation,
        createOrUpdateAcademicMutation, deleteAcademicMutation,
        createOrUpdateQuizPointMutation, deleteQuizPointMutation,
        createOrUpdateViolationMutation, deleteViolationMutation,
    };
};
