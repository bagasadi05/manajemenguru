import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';
import { Database } from './database.types';
import { AttendanceStatus } from '../types';

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
    const { student, academicRecords, violations, attendanceRecords } = data;
    const studentInfo = { name: student.name, nisn: student.id.substring(0, 8), className: student.classes?.name || 'N/A', phase: 'E' };
    const pageW = doc.internal.pageSize.getWidth(); const margin = 40; let y = 60;

    doc.setFont('Tinos', 'bold');
    doc.setFontSize(16); doc.text(reportHeader.title, pageW / 2, y, { align: 'center' }); y += 18;
    doc.setFontSize(14); doc.text(reportHeader.schoolName, pageW / 2, y, { align: 'center' }); y += 16;
    doc.setFont('Tinos', 'normal');
    doc.setFontSize(11); doc.text(reportHeader.academicYear, pageW / 2, y, { align: 'center' }); y += 10;
    doc.setLineWidth(2); doc.line(margin, y, pageW - margin, y); y += 25;

    doc.setFontSize(10);
    autoTable(doc, {
        body: [
            [{content: 'Nama Siswa', styles: {fontStyle: 'bold'}}, `: ${studentInfo.name}`, {content: 'Kelas', styles: {fontStyle: 'bold'}}, `: ${studentInfo.className}`],
            [{content: 'No. Induk / NISN', styles: {fontStyle: 'bold'}}, `: ${studentInfo.nisn}`, {content: 'Fase', styles: {fontStyle: 'bold'}}, `: ${studentInfo.phase}`],
        ],
        startY: y, theme: 'plain', styles: { fontSize: 10, font: 'Tinos', cellPadding: 1 },
        columnStyles: { 0: {cellWidth: 100}, 2: {cellWidth: 100} }
    });
    y = (doc as any).lastAutoTable.finalY + 20;

    doc.setFont('Tinos', 'bold'); doc.setFontSize(12); doc.text('A. Nilai Akademik (Sumatif)', margin, y); y += 5;
    const academicDataBody = academicRecords.map((r, i) => { const predicate = getPredicate(r.score); return [i + 1, r.subject, r.score, predicate.p, predicate.d]; });
    autoTable(doc, {
        head: [['No', 'Mata Pelajaran', 'Nilai', 'Predikat', 'Deskripsi']], body: academicDataBody, startY: y, theme: 'grid',
        headStyles: { fillColor: [229, 231, 235], textColor: 20, fontStyle: 'bold', font: 'Tinos' }, styles: { fontSize: 9, font: 'Tinos', cellPadding: 5, lineColor: [0,0,0], lineWidth: 0.5 },
        columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 2: { halign: 'center', cellWidth: 40 }, 3: { halign: 'center', cellWidth: 50 }, 4: { halign: 'justify' } }
    });
    y = (doc as any).lastAutoTable.finalY + 20;

    const attendanceSummary = attendanceRecords.reduce((acc, record) => { if (record.status !== 'Hadir') { acc[record.status] = (acc[record.status] || 0) + 1; } return acc; }, { Sakit: 0, Izin: 0, Alpha: 0 } as Record<Exclude<AttendanceStatus, 'Hadir'>, number>);
    const behavioralNote = violations.length > 0 ? `Terdapat ${violations.length} catatan pelanggaran.` : "Tidak ada catatan pelanggaran. Siswa menunjukkan sikap yang baik dan terpuji selama proses pembelajaran.";

    doc.setFont('Tinos', 'bold'); doc.setFontSize(12); doc.text('C. Kepribadian dan Sikap', margin, y); y += 15;
    doc.setFontSize(11); doc.text('1. Ketidakhadiran', margin, y); y += 15;
    autoTable(doc, { body: [[{ content: `Sakit: ${attendanceSummary.Sakit} hari`, styles: { halign: 'center' } }, { content: `Izin: ${attendanceSummary.Izin} hari`, styles: { halign: 'center' } }, { content: `Alpha: ${attendanceSummary.Alpha} hari`, styles: { halign: 'center' } }]], startY: y, theme: 'grid', styles: { font: 'Tinos', fontSize: 10, cellPadding: 5 } });
    y = (doc as any).lastAutoTable.finalY + 15;

    doc.setFont('Tinos', 'bold'); doc.setFontSize(11); doc.text('2. Catatan Perilaku', margin, y); y += 12;
    doc.setFont('Tinos', 'normal'); doc.setFontSize(10);
    const behaviorLines = doc.splitTextToSize(behavioralNote, pageW - margin * 2 - 30);
    doc.text(behaviorLines, margin + 15, y, { align: 'justify' });
    y += (behaviorLines.length * 12) + (violations.length > 0 ? 15 : 25);

    if (violations.length > 0) {
        doc.setFont('Tinos', 'bold'); doc.setFontSize(10); doc.text('Rincian Pelanggaran', margin + 15, y); y += 5;
        autoTable(doc, {
            head: [['No', 'Tanggal', 'Deskripsi', 'Poin']], body: violations.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((v, i) => [i + 1, v.date, v.description, v.points]), startY: y, theme: 'grid',
            headStyles: { fillColor: [229, 231, 235], textColor: 20, fontStyle: 'bold', font: 'Tinos' }, styles: { fontSize: 9, font: 'Tinos', cellPadding: 5, lineColor: [0,0,0], lineWidth: 0.5 },
            columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 3: { halign: 'center', cellWidth: 40 } }
        });
        y = (doc as any).lastAutoTable.finalY + 20;
    }

    const teacherNote = `Ananda ${student.name.split(' ')[0]} menunjukkan perkembangan yang baik. Terus tingkatkan prestasi dan semangat belajar!`;
    doc.setFont('Tinos', 'bold'); doc.setFontSize(12); doc.text('D. Catatan Wali Kelas', margin, y); y += 12;
    doc.setFont('Tinos', 'normal');
    const teacherNoteLines = doc.splitTextToSize(teacherNote, pageW - margin * 2 - 20);
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.rect(margin, y - 5, pageW - margin * 2, teacherNoteLines.length * 12 + 20, 'S');
    doc.text(teacherNoteLines, margin + 10, y + 10, { align: 'justify', maxWidth: pageW - margin * 2 - 20 });
};


const fetchBulkReportData = async (studentIds: string[], userId: string): Promise<ReportData[]> => {
    const { data: studentsData, error: sErr } = await supabase.from('students').select('*, classes(id, name)').in('id', studentIds).eq('user_id', userId);
    if (sErr) throw sErr;
    const [rep, att, aca, vio, qui] = await Promise.all([
        supabase.from('reports').select('*').in('student_id', studentIds), supabase.from('attendance').select('*').in('student_id', studentIds),
        supabase.from('academic_records').select('*').in('student_id', studentIds), supabase.from('violations').select('*').in('student_id', studentIds),
        supabase.from('quiz_points').select('*').in('student_id', studentIds)
    ]);
    if (rep.error || att.error || aca.error || vio.error || qui.error) throw new Error('Gagal ambil data rapor.');
    return studentsData.map(s => ({ student: s as StudentWithClass, reports: (rep.data||[]).filter(r=>r.student_id===s.id), attendanceRecords: (att.data||[]).filter(r=>r.student_id===s.id), academicRecords: (aca.data||[]).filter(r=>r.student_id===s.id), violations: (vio.data||[]).filter(r=>r.student_id===s.id), quizPoints: (qui.data||[]).filter(r=>r.student_id===s.id) }));
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
        const studentReportDataArray = await fetchBulkReportData([id], userId);

        if (studentReportDataArray && studentReportDataArray.length > 0) {
            generateSingleReportPage(doc, studentReportDataArray[0], reportHeader);
            if (i < studentIds.length - 1) {
                doc.addPage();
            }
        }
    }

    doc.save(`Rapor_Massal_${className || 'Kelas'}.pdf`);
};
