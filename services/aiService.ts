import { GoogleGenAI, Type } from '@google/genai';
import { Database } from '@/services/database.types';
import { StudentDetailsData } from '@/hooks/useStudentData';
import { AttendanceStatus } from '@/types';

type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type ViolationRow = Database['public']['Tables']['violations']['Row'];

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a comprehensive student summary using Google's Gemini AI.
 * @param data - The complete data for a single student.
 * @returns A structured AI summary.
 */
export const generateStudentSummary = async (data: StudentDetailsData) => {
    const { student, academicRecords, quizPoints, attendanceRecords, reports, violations } = data;
    const attendanceSummary = attendanceRecords.reduce((acc, record) => { acc[record.status] = (acc[record.status] || 0) + 1; return acc; }, {} as Record<AttendanceStatus, number>);
    const totalAttendanceDays = attendanceRecords.length;

    const academicData = academicRecords.length > 0 ? academicRecords.map(r => `- Nilai Mapel ${r.subject}: ${r.score}, Catatan: ${r.notes}`).join('\n') : 'Tidak ada data nilai mata pelajaran.';
    const activityData = quizPoints.length > 0 ? `Total ${quizPoints.length} poin keaktifan tercatat. Aktivitas: ${[...new Set(quizPoints.map(q => q.quiz_name))].join(', ')}.` : 'Tidak ada data poin keaktifan.';
    const attendanceData = totalAttendanceDays > 0 ? Object.entries(attendanceSummary).map(([status, count]) => `- ${status}: ${count} hari`).join('\n') : 'Tidak ada data kehadiran.';
    const reportData = reports.length > 0 ? reports.map(r => `- ${r.title}: ${r.notes}`).join('\n') : 'Tidak ada catatan perkembangan.';
    const violationData = violations.length > 0 ? violations.map(v => `- ${v.description}: ${v.points} poin`).join('\n') : 'Tidak ada data pelanggaran.';

    const systemInstruction = `Anda adalah seorang psikolog pendidikan dan analis performa siswa yang sangat berpengalaman. Gaya tulisan Anda suportif, profesional, dan mudah dipahami oleh guru dan orang tua. Hindari jargon teknis dan bahasa yang terlalu kaku seperti AI. Ubah data mentah menjadi wawasan naratif yang dapat ditindaklanjuti. Anda HARUS memberikan output dalam format JSON yang valid sesuai skema.`;

    const prompt = `Analisis data siswa berikut untuk ${student.name} dan hasilkan ringkasan evaluasi yang komprehensif dalam format JSON. Tulis setiap bagian dalam bentuk paragraf yang mengalir alami dan informatif.

**Data Nilai Mata Pelajaran:**
${academicData}

**Data Poin Keaktifan:**
${activityData}

**Ringkasan Kehadiran:**
${attendanceData}

**Catatan Guru Sebelumnya:**
${reportData}

**Data Pelanggaran:**
${violationData}

Isi struktur JSON sesuai dengan data yang diberikan.`;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            general_evaluation: { type: Type.STRING, description: "Satu paragraf (2-4 kalimat) untuk evaluasi umum siswa, ditulis dalam bahasa yang alami." },
            strengths: { type: Type.STRING, description: "Satu paragraf (2-4 kalimat) yang merinci kekuatan utama siswa." },
            development_focus: { type: Type.STRING, description: "Satu paragraf (2-4 kalimat) yang menjelaskan area fokus untuk pengembangan siswa." },
            recommendations: { type: Type.STRING, description: "Satu paragraf (2-4 kalimat) dengan rekomendasi yang dapat ditindaklanjuti untuk guru/orang tua." },
        },
        required: ["general_evaluation", "strengths", "development_focus", "recommendations"]
    };

    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction, responseMimeType: "application/json", responseSchema } });
    return JSON.parse(response.text ?? '{}');
};

/**
 * Generates a behavioral analysis for a student.
 * @param studentName - The name of the student.
 * @param attendance - The student's attendance records.
 * @param violations - The student's violation records.
 * @returns A text-based analysis of the student's behavior.
 */
export const generateBehaviorAnalysis = async (studentName: string, attendance: AttendanceRow[], violations: ViolationRow[]) => {
    const absencesByDay = attendance.reduce((acc, record) => {
        if (record.status === 'Alpha') {
            const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date(record.date).getUTCDay()];
            if (dayName !== 'Sabtu' && dayName !== 'Minggu') {
                acc[dayName] = (acc[dayName] || 0) + 1;
            }
        }
        return acc;
    }, {} as Record<string, number>);

    const systemInstruction = "Anda adalah seorang konselor sekolah yang menganalisis data perilaku siswa. Berikan analisis singkat, jelas, dan profesional dalam 1-2 paragraf. Fokus pada pola yang muncul dan berikan saran konstruktif jika diperlukan.";

    const attendanceSummary = attendance.length > 0 ? `Total ${attendance.filter(a => a.status === 'Alpha').length} kali alpha, ${attendance.filter(a => a.status === 'Sakit').length} kali sakit, ${attendance.filter(a => a.status === 'Izin').length} kali izin.` : 'Tidak ada data absensi.';
    const violationSummary = violations.length > 0 ? `Total ${violations.length} pelanggaran dengan total ${violations.reduce((sum, v) => sum + v.points, 0)} poin.` : 'Tidak ada catatan pelanggaran.';

    const prompt = `
        Analisis data perilaku untuk siswa bernama ${studentName}.

        Data Absensi:
        ${attendanceSummary}
        Rincian alpha per hari: ${JSON.stringify(absencesByDay)}

        Data Pelanggaran:
        ${violationSummary}

        Berikan analisis singkat tentang pola perilaku yang mungkin terlihat dari data ini.
    `;

    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction } });
    return response.text ?? '';
};

/**
 * Parses a string of text containing student names and scores using AI.
 * @param pasteData - The raw text data to parse.
 * @param studentNames - A list of valid student names to match against.
 * @returns A record mapping student names to their parsed scores.
 */
export const parseScoresWithAi = async (pasteData: string, studentNames: string[]): Promise<Record<string, number>> => {
    const systemInstruction = `Anda adalah asisten pemrosesan data. Tugas Anda adalah membaca teks yang berisi nama siswa dan nilai, lalu mencocokkannya dengan daftar nama siswa yang diberikan. Hasilnya harus dalam format JSON yang valid, di mana kunci adalah nama siswa yang cocok dari daftar, dan nilainya adalah skor numerik yang ditemukan. Abaikan nama yang tidak ada dalam daftar.`;
    const prompt = `
        Daftar Siswa: ${JSON.stringify(studentNames)}

        Teks Data Nilai:
        """
        ${pasteData}
        """

        Proses teks di atas dan kembalikan JSON berisi pasangan nama dan nilai.
    `;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {},
        description: "An object where keys are student names (string) and values are their scores (number)."
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { systemInstruction, responseMimeType: "application/json", responseSchema }
    });

    return JSON.parse(response.text ?? '{}');
};
