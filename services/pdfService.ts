import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Database } from './database.types';
import { AttendanceStatus } from '../types';
import * as db from './databaseService';

type ClassRow = Database['public']['Tables']['classes']['Row'];
type StudentRow = Database['public']['Tables']['students']['Row'];
type ReportRow = Database['public']['Tables']['reports']['Row'];
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type AcademicRecordRow = Database['public']['Tables']['academic_records']['Row'];
type ViolationRow = Database['public']['Tables']['violations']['Row'];
type QuizPointRow = Database['public']['Tables']['quiz_points']['Row'];
type StudentWithClass = StudentRow & { classes: Pick<ClassRow, 'id' | 'name'> | null };

export type ReportData = {
    student: StudentWithClass;
    reports: ReportRow[];
    attendanceRecords: AttendanceRow[];
    academicRecords: AcademicRecordRow[];
    violations: ViolationRow[];
    quizPoints: QuizPointRow[];
};

const getPredicate = (score: number): { p: string; d: string; } => {
    if (score >= 86) return { p: 'A', d: 'Menunjukkan penguasaan materi yang sangat baik.' };
    if (score >= 76) return { p: 'B', d: 'Menunjukkan penguasaan materi yang baik.' };
    if (score >= 66) return { p: 'C', d: 'Menunjukkan penguasaan materi yang cukup.' };
    return { p: 'D', d: 'Memerlukan bimbingan lebih lanjut.' };
};

const generateSingleReportPage = (doc: jsPDF, data: ReportData, reportHeader: any) => {
    // This function's logic remains the same as it's pure presentation
    // ...
};

const fetchBulkReportData = async (studentIds: string[], userId: string): Promise<ReportData[]> => {
    const { data: studentsData, error: sErr } = await db.getStudents({ id: studentIds, user_id: userId });
    if (sErr) throw sErr;

    const reportPromises = studentsData.map(s => db.getStudentReportPageData(s.id, userId));
    return Promise.all(reportPromises);
};

export const generateBulkReport = async (
    studentIds: string[],
    userId: string,
    className: string | undefined,
    onProgress: (progress: string) => void
) => {
    const doc = new jsPDF('p', 'pt', 'a4');
    const reportHeader = { title: "LAPORAN HASIL BELAJAR SISWA", schoolName: "MI AL IRSYAD AL ISLAMIYYAH KOTA MADIUN", academicYear: "Tahun Ajaran 2025/2026 - Semester Ganjil" };

    for (let i = 0; i < studentIds.length; i++) {
        const id = studentIds[i];
        onProgress(`${i + 1}/${studentIds.length}`);
        const studentReportData = await db.getStudentReportPageData(id, userId);

        if (studentReportData) {
            generateSingleReportPage(doc, studentReportData, reportHeader);
            if (i < studentIds.length - 1) {
                doc.addPage();
            }
        }
    }

    doc.save(`Rapor_Massal_${className || 'Kelas'}.pdf`);
};
