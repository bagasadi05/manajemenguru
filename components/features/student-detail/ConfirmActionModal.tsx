import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertCircleIcon } from '@/components/Icons';
import { ModalState } from './types';

export const ConfirmActionModal: React.FC<{ modalState: Extract<ModalState, { type: 'confirmDelete' }>; onClose: () => void }> = ({ modalState, onClose }) => (
    <Modal isOpen={true} onClose={onClose} title={modalState.title} icon={<AlertCircleIcon className="w-5 h-5"/>}>
        <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">{modalState.message}</p>
            <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={onClose} disabled={modalState.isPending}>Batal</Button>
                <Button variant="destructive" onClick={modalState.onConfirm} disabled={modalState.isPending}>
                    {modalState.isPending ? 'Menghapus...' : 'Ya, Hapus'}
                </Button>
            </div>
        </div>
    </Modal>
);
