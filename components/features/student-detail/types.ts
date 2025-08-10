import { Database } from '@/services/database.types';

export type ReportRow = Database['public']['Tables']['reports']['Row'];
export type AcademicRecordRow = Database['public']['Tables']['academic_records']['Row'];
export type QuizPointRow = Database['public']['Tables']['quiz_points']['Row'];
export type ViolationRow = Database['public']['Tables']['violations']['Row'];

export type ModalState =
    | { type: 'closed' }
    | { type: 'editStudent' }
    | { type: 'report', data: ReportRow | null }
    | { type: 'academic', data: AcademicRecordRow | null }
    | { type: 'quiz', data: QuizPointRow | null }
    | { type: 'violation', mode: 'add' | 'edit', data: ViolationRow | null }
    | { type: 'confirmDelete', title: string; message: string; onConfirm: () => void; isPending: boolean };

export type AiSummary = {
    general_evaluation: string;
    strengths: string;
    development_focus: string;
    recommendations: string;
};
