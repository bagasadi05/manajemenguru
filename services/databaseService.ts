import { supabase } from './supabase';
import { Database } from './database.types';

// Types
type Student = Database['public']['Tables']['students']['Row'];
type Class = Database['public']['Tables']['classes']['Row'];
type Schedule = Database['public']['Tables']['schedules']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];
type Report = Database['public']['Tables']['reports']['Row'];
type Attendance = Database['public']['Tables']['attendance']['Row'];
type AcademicRecord = Database['public']['Tables']['academic_records']['Row'];
type Violation = Database['public']['Tables']['violations']['Row'];
type QuizPoint = Database['public']['Tables']['quiz_points']['Row'];

// Generic error handler
const handleSupabaseError = (error: any, context: string) => {
  if (error) {
    console.error(`Error in ${context}:`, error);
    throw new Error(`Database error in ${context}: ${error.message}`);
  }
};

// --- Students ---
export const getStudents = (userId: string) => supabase.from('students').select('*').eq('user_id', userId);
export const getStudentsWithClass = (userId: string) => supabase.from('students').select('*, classes(name)').eq('user_id', userId);
export const getStudentsByClass = (classId: string) => supabase.from('students').select('*').eq('class_id', classId).order('name');
export const getStudentWithClass = (studentId: string, userId: string) => supabase.from('students').select('*, classes(id, name)').eq('id', studentId).eq('user_id', userId).single();
export const addStudent = (newStudent: Student) => supabase.from('students').insert(newStudent);
export const updateStudent = (id: string, updateData: Partial<Student>) => supabase.from('students').update(updateData).eq('id', id);
export const deleteStudent = async (studentId: string) => {
    // Cascade delete for all related records
    const dependentTables = ['reports', 'attendance', 'academic_records', 'violations', 'quiz_points'];
    for (const table of dependentTables) {
        const { error } = await supabase.from(table).delete().eq('student_id', studentId);
        handleSupabaseError(error, `deleting from ${table} for student ${studentId}`);
    }
    const { error: studentError } = await supabase.from('students').delete().eq('id', studentId);
    handleSupabaseError(studentError, `deleting student ${studentId}`);
};

// --- Classes ---
export const getClasses = (userId: string) => supabase.from('classes').select('*').eq('user_id', userId);
export const addClass = (newClass: Omit<Class, 'id' | 'created_at'>) => supabase.from('classes').insert(newClass);
export const updateClass = (id: string, updateData: Partial<Class>) => supabase.from('classes').update(updateData).eq('id', id);
export const deleteClass = (classId: string) => supabase.from('classes').delete().eq('id', classId);

// --- Attendance ---
export const getAttendanceByDate = (studentIds: string[], date: string) => supabase.from('attendance').select('*').eq('date', date).in('student_id', studentIds);
export const getAttendanceByDateRange = (userId: string, startDate: string, endDate: string) => supabase.from('attendance').select('*').eq('user_id', userId).gte('date', startDate).lte('date', endDate);
export const upsertAttendance = (records: Partial<Attendance>[]) => supabase.from('attendance').upsert(records, { onConflict: 'student_id, date' });

// --- Tasks ---
export const getTasks = (userId: string) => supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false });
export const getIncompleteTasks = (userId: string) => supabase.from('tasks').select('*').eq('user_id', userId).neq('status', 'done').order('due_date');
export const addTask = (newTask: Omit<Task, 'id' | 'created_at'>) => supabase.from('tasks').insert(newTask);
export const updateTask = (id: string, updateData: Partial<Task>) => supabase.from('tasks').update(updateData).eq('id', id);
export const deleteTask = (id: string) => supabase.from('tasks').delete().eq('id', id);

// --- Schedules ---
export const getSchedules = (userId: string) => supabase.from('schedules').select('*').eq('user_id', userId).order('day').order('start_time');
export const addSchedule = (newSchedule: Omit<Schedule, 'id'>) => supabase.from('schedules').insert(newSchedule);
export const updateSchedule = (id: number, updateData: Partial<Schedule>) => supabase.from('schedules').update(updateData).eq('id', id);
export const deleteSchedule = (id: number) => supabase.from('schedules').delete().eq('id', id);

// --- Reports ---
export const getReportsByStudent = (studentId: string) => supabase.from('reports').select('*').eq('student_id', studentId);
export const addReport = (newReport: Omit<Report, 'id'|'created_at'>) => supabase.from('reports').insert(newReport);
export const updateReport = (id: string, updateData: Partial<Report>) => supabase.from('reports').update(updateData).eq('id', id);
export const deleteReport = (id: string) => supabase.from('reports').delete().eq('id', id);

// --- Academic Records ---
export const getAcademicRecordsByStudent = (studentId: string) => supabase.from('academic_records').select('*').eq('student_id', studentId);
export const addAcademicRecord = (newRecord: Omit<AcademicRecord, 'id'|'created_at'>) => supabase.from('academic_records').insert(newRecord);
export const addAcademicRecords = (newRecords: Omit<AcademicRecord, 'id'|'created_at'>[]) => supabase.from('academic_records').insert(newRecords);
export const updateAcademicRecord = (id: string, updateData: Partial<AcademicRecord>) => supabase.from('academic_records').update(updateData).eq('id', id);
export const deleteAcademicRecord = (id: string) => supabase.from('academic_records').delete().eq('id', id);

// --- Violations ---
export const getViolationsByStudent = (studentId: string) => supabase.from('violations').select('*').eq('student_id', studentId);
export const addViolations = (newRecords: Omit<Violation, 'id'|'created_at'>[]) => supabase.from('violations').insert(newRecords);
export const updateViolation = (id: string, updateData: Partial<Violation>) => supabase.from('violations').update(updateData).eq('id', id);
export const deleteViolation = (id: string) => supabase.from('violations').delete().eq('id', id);

// --- Quiz Points ---
export const getQuizPointsByStudent = (studentId: string) => supabase.from('quiz_points').select('*').eq('student_id', studentId);
export const addQuizPoints = (newRecords: Omit<QuizPoint, 'id'|'created_at'>[]) => supabase.from('quiz_points').insert(newRecords);
export const updateQuizPoint = (id: number, updateData: Partial<QuizPoint>) => supabase.from('quiz_points').update(updateData).eq('id', id);
export const deleteQuizPoint = (id: number) => supabase.from('quiz_points').delete().eq('id', id);


// --- Dashboard & Search Specific Queries ---
export const getDashboardData = async (userId: string, today: string, sevenDaysAgo: string, thirtyDaysAgo: string) => {
    const studentsPromise = supabase.from('students').select('id, name, gender').eq('user_id', userId);
    const reportsPromise = supabase.from('reports').select('student_id, students(name)').eq('user_id', userId).gte('date', sevenDaysAgo);
    const schedulesPromise = supabase.from('schedules').select('*').eq('user_id', userId);
    const classesPromise = supabase.from('classes').select('name').eq('user_id', userId);
    const tasksPromise = supabase.from('tasks').select('*').eq('user_id', userId).neq('status', 'done').order('due_date');
    const attendancePromise = supabase.from('attendance').select('student_id, status, students(name, avatar_url)').eq('user_id', userId).eq('date', today);
    const academicPromise = supabase.from('academic_records').select('student_id, subject, score').eq('user_id', userId).gte('created_at', thirtyDaysAgo);
    const violationsPromise = supabase.from('violations').select('student_id, points').eq('user_id', userId).gte('date', thirtyDaysAgo);

    const [
        studentsRes, reportsRes, schedulesRes, classesRes, tasksRes, attendanceRes, academicRes, violationsRes
    ] = await Promise.all([
        studentsPromise, reportsPromise, schedulesPromise, classesPromise, tasksPromise, attendancePromise, academicPromise, violationsPromise
    ]);

    handleSupabaseError(studentsRes.error, 'getDashboardData students');
    handleSupabaseError(reportsRes.error, 'getDashboardData reports');
    handleSupabaseError(schedulesRes.error, 'getDashboardData schedules');
    handleSupabaseError(classesRes.error, 'getDashboardData classes');
    handleSupabaseError(tasksRes.error, 'getDashboardData tasks');
    handleSupabaseError(attendanceRes.error, 'getDashboardData attendance');
    handleSupabaseError(academicRes.error, 'getDashboardData academic');
    handleSupabaseError(violationsRes.error, 'getDashboardData violations');

    return {
        students: studentsRes.data,
        recentReports: reportsRes.data,
        schedules: schedulesRes.data,
        classes: classesRes.data,
        tasks: tasksRes.data,
        todayAttendance: attendanceRes.data,
        recentAcademic: academicRes.data,
        recentViolations: violationsRes.data,
    };
};

export const getGlobalSearchData = async (userId: string) => {
    const studentsPromise = supabase.from('students').select('id, name, class_id').eq('user_id', userId);
    const classesPromise = supabase.from('classes').select('id, name').eq('user_id', userId);
    const schedulesPromise = supabase.from('schedules').select('id, subject, class_id, day').eq('user_id', userId);

    const [studentsRes, classesRes, schedulesRes] = await Promise.all([studentsPromise, classesPromise, schedulesPromise]);

    handleSupabaseError(studentsRes.error, 'getGlobalSearchData students');
    handleSupabaseError(classesRes.error, 'getGlobalSearchData classes');
    handleSupabaseError(schedulesRes.error, 'getGlobalSearchData schedules');

    return {
        students: studentsRes.data,
        classes: classesRes.data,
        schedules: schedulesRes.data,
    };
};

export const getStudentReportPageData = async (studentId: string, userId: string) => {
    const studentRes = await getStudentWithClass(studentId, userId);
    handleSupabaseError(studentRes.error, `getStudentReportPageData student`);

    const [reportsRes, attendanceRes, academicRes, violationsRes, quizPointsRes] = await Promise.all([
        getReportsByStudent(studentId),
        getAttendanceByStudent(studentId),
        getAcademicRecordsByStudent(studentId),
        getViolationsByStudent(studentId),
        getQuizPointsByStudent(studentId)
    ]);

    handleSupabaseError(reportsRes.error, `getStudentReportPageData reports`);
    handleSupabaseError(attendanceRes.error, `getStudentReportPageData attendance`);
    handleSupabaseError(academicRes.error, `getStudentReportPageData academic`);
    handleSupabaseError(violationsRes.error, `getStudentReportPageData violations`);
    handleSupabaseError(quizPointsRes.error, `getStudentReportPageData quizPoints`);

    return {
        student: studentRes.data,
        reports: reportsRes.data,
        attendanceRecords: attendanceRes.data,
        academicRecords: academicRes.data,
        violations: violationsRes.data,
        quizPoints: quizPointsRes.data,
    };
};

export const getStudentDetailsPageData = async (studentId: string, userId: string) => {
    const { data: studentData, error: studentError } = await getStudentWithClass(studentId, userId);
    handleSupabaseError(studentError, 'getStudentDetailsPageData student');

    if (!studentData) throw new Error('Student not found');

    const { data: classmates } = await supabase.from('students').select('id').eq('class_id', studentData.class_id!);
    const classmateIds = (classmates || []).map(s => s.id);

    const [reportsRes, attendanceRes, academicRes, quizPointsRes, violationsRes, classAcademicRes, classesRes] = await Promise.all([
        getReportsByStudent(studentId),
        getAttendanceByStudent(studentId),
        getAcademicRecordsByStudent(studentId),
        getQuizPointsByStudent(studentId),
        getViolationsByStudent(studentId),
        supabase.from('academic_records').select('subject, score').in('student_id', classmateIds),
        getClasses(userId),
    ]);

    handleSupabaseError(reportsRes.error, 'getStudentDetailsPageData reports');
    handleSupabaseError(attendanceRes.error, 'getStudentDetailsPageData attendance');
    handleSupabaseError(academicRes.error, 'getStudentDetailsPageData academic');
    handleSupabaseError(quizPointsRes.error, 'getStudentDetailsPageData quizPoints');
    handleSupabaseError(violationsRes.error, 'getStudentDetailsPageData violations');
    handleSupabaseError(classAcademicRes.error, 'getStudentDetailsPageData classAcademic');
    handleSupabaseError(classesRes.error, 'getStudentDetailsPageData classes');

    return {
        student: studentData,
        reports: reportsRes.data || [],
        attendanceRecords: attendanceRes.data || [],
        academicRecords: academicRes.data || [],
        quizPoints: quizPointsRes.data || [],
        violations: violationsRes.data || [],
        classAcademicRecords: classAcademicRes.data || [],
        classes: classesRes.data || [],
    };
};

const getAttendanceByStudent = (studentId: string) => supabase.from('attendance').select('*').eq('student_id', studentId);
