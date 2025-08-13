import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { Database } from '@/services/database.types';
import * as db from '@/services/databaseService';

type StudentRow = Database['public']['Tables']['students']['Row'];
type ClassRow = Database['public']['Tables']['classes']['Row'];
type ReportRow = Database['public']['Tables']['reports']['Row'];
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type AcademicRecordRow = Database['public']['Tables']['academic_records']['Row'];
type ViolationRow = Database['public']['Tables']['violations']['Row'];
type QuizPointRow = Database['public']['Tables']['quiz_points']['Row'];

type StudentWithClass = StudentRow & { classes: Pick<ClassRow, 'id' | 'name'> | null };
export type StudentDetailsData = {
    student: StudentWithClass;
    reports: ReportRow[];
    attendanceRecords: AttendanceRow[];
    academicRecords: AcademicRecordRow[];
    quizPoints: QuizPointRow[];
    violations: ViolationRow[];
    classAcademicRecords: Pick<AcademicRecordRow, 'subject' | 'score'>[];
    classes: ClassRow[];
};

export const useStudentData = (studentId: string | undefined) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    return {
        ...useQuery<StudentDetailsData, Error>({
            queryKey: ['studentDetails', studentId],
            queryFn: () => {
                if (!studentId || !user) throw new Error("Student ID or user not available");
                return db.getStudentDetailsPageData(studentId, user.id);
            },
            enabled: !!studentId && !!user,
        }),
        client: queryClient,
    };
};
