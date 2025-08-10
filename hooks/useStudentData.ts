import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from './useAuth';
import { Database } from '@/services/database.types';

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

    return useQuery<StudentDetailsData, Error>({
        queryKey: ['studentDetails', studentId],
        queryFn: async () => {
            if (!studentId || !user) throw new Error("Student ID or user not available");

            const studentRes = await supabase.from('students').select('*, classes(id, name)').eq('id', studentId).eq('user_id', user.id).single();
            if (studentRes.error) throw new Error(studentRes.error.message);
            const studentData = studentRes.data as StudentWithClass;

            const { data: classmates } = await supabase.from('students').select('id').eq('class_id', studentData.class_id!);
            const classmateIds = (classmates || []).map(s => s.id);

            const [reportsRes, attendanceRes, academicRes, quizPointsRes, violationsRes, classAcademicRes, classesRes] = await Promise.all([
                supabase.from('reports').select('*').eq('student_id', studentId),
                supabase.from('attendance').select('*').eq('student_id', studentId),
                supabase.from('academic_records').select('*').eq('student_id', studentId),
                supabase.from('quiz_points').select('*').eq('student_id', studentId),
                supabase.from('violations').select('*').eq('student_id', studentId),
                supabase.from('academic_records').select('subject, score').in('student_id', classmateIds),
                supabase.from('classes').select('*').eq('user_id', user.id),
            ]);

            const errors = [reportsRes.error, attendanceRes.error, academicRes.error, quizPointsRes.error, violationsRes.error, classAcademicRes.error, classesRes.error].filter(Boolean);
            if (errors.length > 0) {
                throw new Error(errors.map(e => e.message).join(', '));
            }

            return {
                student: studentData,
                reports: reportsRes.data || [],
                attendanceRecords: attendanceRes.data || [],
                academicRecords: academicRes.data || [],
                quizPoints: quizPointsRes.data || [],
                violations: violationsRes.data || [],
                classAcademicRecords: classAcademicRes.data || [],
                classes: classesRes.data || [],
            }
        },
        enabled: !!studentId && !!user,
    });
};
