import React, { useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/hooks/useToast';
import { violationList } from '@/services/violations.data';
import { ModalState } from './types';
import { Database } from '@/services/database.types';
import { ConfirmActionModal } from './ConfirmActionModal';
import { useStudentMutations } from '@/hooks/useStudentMutations';
import { useAuth } from '@/hooks/useAuth';
import LoadingSpinner from '@/components/LoadingSpinner';
import { CameraIcon } from '@/components/Icons';

type StudentRow = Database['public']['Tables']['students']['Row'];
type ClassRow = Database['public']['Tables']['classes']['Row'];
type ReportRow = Database['public']['Tables']['reports']['Row'];
type AcademicRecordRow = Database['public']['Tables']['academic_records']['Row'];
type QuizPointRow = Database['public']['Tables']['quiz_points']['Row'];
type ViolationRow = Database['public']['Tables']['violations']['Row'];
type ViolationItem = typeof violationList[0];

interface StudentDetailModalsProps {
    modalState: ModalState;
    onClose: () => void;
    student: StudentRow;
    classes: ClassRow[];
    isOnline: boolean;
    studentId: string;
}

export const StudentDetailModals: React.FC<StudentDetailModalsProps> = ({ modalState, onClose, student, classes, isOnline, studentId }) => {
    const { user } = useAuth();
    const {
        updateStudentMutation, createOrUpdateReportMutation, deleteReportMutation,
        createOrUpdateAcademicMutation, deleteAcademicMutation,
        createOrUpdateQuizPointMutation, deleteQuizPointMutation,
        createOrUpdateViolationMutation, deleteViolationMutation,
        updateAvatarMutation, deleteStudentMutation
    } = useStudentMutations(studentId, user);

    const toast = useToast();
    const [reportFile, setReportFile] = useState<File | null>(null);
    const [violationSelection, setViolationSelection] = useState<ViolationItem | null>(null);
    const [violationEntryMode, setViolationEntryMode] = useState<'list' | 'custom'>('list');
    const avatarFileInputRef = useRef<HTMLInputElement>(null);

    const getLocalDateString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleReportFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const editingReport = modalState.type === 'report' ? modalState.data : null;
        const formData = new FormData(e.currentTarget);
        const payload: Omit<ReportRow, 'created_at' | 'id'> & { id?: string } = {
            id: editingReport?.id ?? undefined, title: formData.get('title') as string, notes: formData.get('notes') as string,
            attachment_url: editingReport?.attachment_url || null, date: editingReport?.date || getLocalDateString(),
            student_id: studentId!, user_id: user!.id,
        };
        createOrUpdateReportMutation.mutate({ payload, file: reportFile });
        setReportFile(null);
        onClose();
    };

    const handleAcademicRecordFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const editingRecord = modalState.type === 'academic' ? modalState.data : null;
        const formData = new FormData(e.currentTarget);
        const payload = {
            id: editingRecord?.id,
            subject: formData.get('subject') as string,
            score: Number(formData.get('score')),
            notes: formData.get('notes') as string,
            student_id: studentId!,
            user_id: user!.id,
        };
        createOrUpdateAcademicMutation.mutate(payload);
        onClose();
    };

    const handleQuizPointFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const editingRecord = modalState.type === 'quiz' ? modalState.data : null;
        const formData = new FormData(e.currentTarget);
        const payload = {
            id: editingRecord?.id,
            subject: formData.get('subject') as string,
            quiz_name: formData.get('quiz_name') as string,
            points: 1,
            max_points: 1,
            quiz_date: formData.get('quiz_date') as string,
            student_id: studentId!,
            user_id: user!.id,
        };
        createOrUpdateQuizPointMutation.mutate(payload);
        onClose();
    };

    const handleViolationFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (modalState.type !== 'violation') return;

        const formData = new FormData(e.currentTarget);
        let payload: Database['public']['Tables']['violations']['Insert'];

        if (modalState.mode === 'add') {
            if (violationEntryMode === 'list') {
                const violationCode = formData.get('violation_code') as string;
                const selectedViolation = violationList.find(v => v.code === violationCode);
                if (!selectedViolation) {
                    toast.error("Silakan pilih jenis pelanggaran.");
                    return;
                }
                payload = {
                    date: (formData.get('date') as string) || getLocalDateString(),
                    description: selectedViolation.description,
                    points: selectedViolation.points,
                    student_id: studentId!,
                    user_id: user!.id,
                };
            } else { // custom mode
                payload = {
                    date: (formData.get('date') as string) || getLocalDateString(),
                    description: formData.get('description') as string,
                    points: Number(formData.get('points')),
                    student_id: studentId!,
                    user_id: user!.id,
                };
            }
        } else {
            const editingViolation = modalState.data!;
            payload = {
                id: editingViolation.id,
                date: formData.get('date') as string,
                description: formData.get('description') as string,
                points: Number(formData.get('points')),
                student_id: studentId!,
                user_id: user!.id,
            };
        }

        createOrUpdateViolationMutation.mutate(payload);
        onClose();
    };

    const handleUpdateStudent = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault(); if(!student) return;
        const formData = new FormData(e.currentTarget);
        const name = formData.get('name') as string;
        const class_id = formData.get('class_id') as string;
        const gender = formData.get('gender') as 'Laki-laki' | 'Perempuan';

        const updatedData: Database['public']['Tables']['students']['Update'] = { name, class_id, gender };

        if (student.gender !== gender && student.avatar_url.includes('avatar.iran.liara.run')) {
             const avatarGender = gender === 'Laki-laki' ? 'boy' : 'girl';
            const new_avatar_url = `https://avatar.iran.liara.run/public/${avatarGender}?username=${encodeURIComponent(name || Date.now())}`;
            updatedData.avatar_url = new_avatar_url;
        }

        updateStudentMutation.mutate(updatedData);
        onClose();
    };

    if (modalState.type === 'closed') return null;

    if (modalState.type === 'confirmDelete') {
        return <ConfirmActionModal modalState={modalState} onClose={onClose} />;
    }

    if (modalState.type === 'report') {
        return <Modal title={modalState.data ? "Edit Catatan" : "Tambah Catatan Baru"} isOpen={true} onClose={onClose}><form onSubmit={handleReportFormSubmit} className="space-y-4"><div><label htmlFor="report-title">Judul</label><Input id="report-title" name="title" defaultValue={modalState.data?.title || ''} required /></div><div><label htmlFor="report-notes">Catatan</label><textarea id="report-notes" name="notes" defaultValue={modalState.data?.notes || ''} rows={5} className="w-full p-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-md"></textarea></div><div><label htmlFor="report-attachment">Lampiran (Opsional)</label><Input id="report-attachment" name="attachment" type="file" onChange={(e) => setReportFile(e.target.files ? e.target.files[0] : null)} /></div><div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={onClose}>Batal</Button><Button type="submit" disabled={createOrUpdateReportMutation.isPending || !isOnline}>{createOrUpdateReportMutation.isPending ? 'Menyimpan...' : 'Simpan'}</Button></div></form></Modal>;
    }

    if (modalState.type === 'academic') {
        return <Modal title={modalState.data ? "Edit Nilai Mata Pelajaran" : "Tambah Nilai Mata Pelajaran"} isOpen={true} onClose={onClose}>
            <form onSubmit={handleAcademicRecordFormSubmit} className="space-y-4">
                <div><label>Mata Pelajaran</label><Input name="subject" placeholder="cth. Matematika" defaultValue={modalState.data?.subject || ''} required /></div>
                <div><label>Nilai</label><Input name="score" type="number" min="0" max="100" defaultValue={modalState.data?.score ?? ''} required /></div>
                <div><label>Catatan</label><textarea name="notes" defaultValue={modalState.data?.notes || ''} rows={3} className="w-full p-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-md"></textarea></div>
                <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={onClose}>Batal</Button><Button type="submit" disabled={createOrUpdateAcademicMutation.isPending || !isOnline}>{createOrUpdateAcademicMutation.isPending ? 'Menyimpan...' : 'Simpan'}</Button></div>
            </form>
        </Modal>;
    }

    if (modalState.type === 'quiz') {
        return <Modal title={modalState.data ? "Edit Poin Keaktifan" : "Tambah Poin Keaktifan"} isOpen={true} onClose={onClose}>
            <form onSubmit={handleQuizPointFormSubmit} className="space-y-4">
                <div><label htmlFor="quiz-subject">Mata Pelajaran</label><Input id="quiz-subject" name="subject" placeholder="cth. Matematika" defaultValue={modalState.data?.subject || ''} required /></div>
                <div><label htmlFor="quiz-name">Nama Aktivitas</label><Input id="quiz-name" name="quiz_name" placeholder="cth. Maju ke depan kelas" defaultValue={modalState.data?.quiz_name || ''} required /></div>
                <div><label htmlFor="quiz-date">Tanggal</label><Input id="quiz-date" name="quiz_date" type="date" defaultValue={modalState.data?.quiz_date || getLocalDateString()} required /></div>
                <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={onClose}>Batal</Button><Button type="submit" disabled={createOrUpdateQuizPointMutation.isPending || !isOnline}>{createOrUpdateQuizPointMutation.isPending ? 'Menyimpan...' : 'Simpan'}</Button></div>
            </form>
        </Modal>;
    }

    if (modalState.type === 'violation') {
        return <Modal title={modalState.mode === 'add' ? 'Tambah Pelanggaran Baru' : 'Edit Pelanggaran'} isOpen={true} onClose={() => { onClose(); setViolationSelection(null);}}>
            <form onSubmit={handleViolationFormSubmit} className="space-y-4">
                {modalState.mode === 'add' && (
                    <div className="flex justify-center gap-2 mb-4 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <Button type="button" size="sm" variant={violationEntryMode === 'list' ? 'default' : 'ghost'} onClick={() => setViolationEntryMode('list')} className="flex-1">Pilih dari Daftar</Button>
                        <Button type="button" size="sm" variant={violationEntryMode === 'custom' ? 'default' : 'ghost'} onClick={() => setViolationEntryMode('custom')} className="flex-1">Input Manual</Button>
                    </div>
                )}

                <div>
                    <label htmlFor="violation-date">Tanggal</label>
                    <Input id="violation-date" name="date" type="date" defaultValue={modalState.data?.date || getLocalDateString()} required />
                </div>

                {modalState.mode === 'edit' || violationEntryMode === 'custom' ? (
                    <>
                        <div>
                            <label htmlFor="violation-description">Deskripsi Pelanggaran</label>
                            <textarea id="violation-description" name="description" defaultValue={modalState.data?.description} rows={3} className="w-full p-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-md" required></textarea>
                        </div>
                        <div>
                            <label htmlFor="violation-points">Poin</label>
                            <Input id="violation-points" name="points" type="number" min="1" defaultValue={modalState.data?.points} required />
                        </div>
                    </>
                ) : (
                     <>
                        <div>
                            <label htmlFor="violation-code">Jenis Pelanggaran</label>
                            <Select id="violation-code" name="violation_code" required
                                onChange={(e) => {
                                    const v = violationList.find(v => v.code === e.target.value);
                                    setViolationSelection(v || null);
                                }}
                                defaultValue="">
                                <option value="" disabled>Pilih jenis pelanggaran</option>
                                {['Ringan', 'Sedang', 'Berat'].map(category => (
                                    <optgroup key={category} label={`Pelanggaran ${category}`}>
                                        {violationList.filter(v => v.category === category).map(v => (
                                            <option key={v.code} value={v.code}>{`${v.code} - ${v.description}`}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </Select>
                        </div>
                        {violationSelection && (
                            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md text-gray-800 dark:text-gray-200">
                                <p className="font-semibold">Poin: <span className="text-red-500 font-bold text-lg">{violationSelection.points}</span></p>
                            </div>
                        )}
                    </>
                )}
                <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => { onClose(); setViolationSelection(null);}}>Batal</Button><Button type="submit" disabled={createOrUpdateViolationMutation.isPending || !isOnline}>{createOrUpdateViolationMutation.isPending ? 'Menyimpan...' : 'Simpan'}</Button></div>
            </form>
        </Modal>;
    }

    if (modalState.type === 'editStudent') {
        return <Modal title="Edit Profil Siswa" isOpen={true} onClose={onClose}>
            <form onSubmit={handleUpdateStudent} className="space-y-6">
                <div className="flex justify-center">
                    <div className="relative">
                        <img src={student.avatar_url} alt={student.name} className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700" />
                        <input type="file" ref={avatarFileInputRef} onChange={() => {}} accept="image/png, image/jpeg" className="hidden" disabled={updateAvatarMutation.isPending}/>
                        <button type="button" onClick={() => avatarFileInputRef.current?.click()} disabled={updateAvatarMutation.isPending || !isOnline} className="absolute -bottom-1 -right-1 p-2 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full shadow-md hover:scale-110 transition-transform" aria-label="Ubah foto profil">
                            {updateAvatarMutation.isPending ? <LoadingSpinner sizeClass="w-5 h-5" borderWidthClass="border-2" colorClass="border-white" /> : <CameraIcon className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
                <div><label htmlFor="edit-student-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Siswa</label><Input id="edit-student-name" name="name" defaultValue={student.name} required /></div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis Kelamin</label>
                    <div className="flex gap-4 mt-2">
                        <label className="flex items-center text-gray-700 dark:text-gray-300"><input type="radio" name="gender" value="Laki-laki" defaultChecked={student.gender === 'Laki-laki'} className="form-radio" /><span className="ml-2">Laki-laki</span></label>
                        <label className="flex items-center text-gray-700 dark:text-gray-300"><input type="radio" name="gender" value="Perempuan" defaultChecked={student.gender === 'Perempuan'} className="form-radio" /><span className="ml-2">Perempuan</span></label>
                    </div>
                </div>
                <div><label htmlFor="edit-student-class" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelas</label><select id="edit-student-class" name="class_id" defaultValue={student.class_id || ''} className="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-transparent dark:border-gray-600 dark:bg-gray-800 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900">{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button type="button" variant="outline" onClick={() => deleteStudentMutation.mutate()} disabled={!isOnline}>Hapus Siswa</Button>
                    <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
                    <Button type="submit" disabled={updateStudentMutation.isPending || !isOnline}>{updateStudentMutation.isPending ? 'Menyimpan...' : 'Simpan'}</Button>
                </div>
            </form>
        </Modal>;
    }

    return null;
}
