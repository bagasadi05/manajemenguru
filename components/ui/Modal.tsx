
import React, { useEffect } from 'react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, icon }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-4 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
      >
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200/20 dark:border-gray-700/50">
            {/* Decorative Header Gradient */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-purple-600 to-blue-500 opacity-10 dark:opacity-20 pointer-events-none"></div>

            <div className="relative p-6 border-b border-gray-200/80 dark:border-gray-800/60">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        {icon && (
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg">
                                {icon}
                            </div>
                        )}
                        <h2 id="modal-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} aria-label="Tutup modal" className="rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </Button>
                </div>
            </div>
            
            <div className="p-6">
                {children}
            </div>
        </div>
      </div>
    </div>
  );
};
