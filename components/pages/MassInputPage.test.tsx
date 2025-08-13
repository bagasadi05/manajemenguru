import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MassInputPage from './MassInputPage';
import { useAuth } from '@/hooks/useAuth';
import * as db from '@/services/databaseService';
import * as ai from '@/services/aiService';

// Mock services and hooks
vi.mock('@/services/aiService');
vi.mock('@/services/databaseService');
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }) }));
vi.mock('@/hooks/useOfflineStatus', () => ({ useOfflineStatus: () => true }));

const mockClasses = [{ id: 'c1', name: 'Kelas 1A', user_id: 'user-123', created_at: new Date().toISOString() }];
const mockStudents = [{ id: 's1', name: 'Budi', class_id: 'c1', user_id: 'user-123', created_at: new Date().toISOString(), gender: 'Laki-laki', avatar_url: '' }];

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });

const renderComponent = () => {
    return render(
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <MemoryRouter><MassInputPage /></MemoryRouter>
            </ToastProvider>
        </QueryClientProvider>
    );
};

// Need to mock ToastProvider since it's used
const ToastProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

describe('MassInputPage', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        (useAuth as vi.Mock).mockReturnValue({ user: { id: 'user-123' } });
        (db.getClasses as vi.Mock).mockResolvedValue({ data: mockClasses, error: null });
        (db.getStudentsByClass as vi.Mock).mockResolvedValue({ data: mockStudents, error: null });
        (ai.parseScoresWithAi as vi.Mock).mockResolvedValue({ 'Budi': 95 });
    });

    it('should allow typing multiple characters in the subject input field', async () => {
        renderComponent();
        fireEvent.click(screen.getByText(/Input Nilai Mapel/i));
        const subjectInput = await screen.findByLabelText(/Mata Pelajaran/i);
        fireEvent.change(subjectInput, { target: { value: 'Matematika' } });
        expect(subjectInput).toHaveValue('Matematika');
    });

    it('should call aiService to parse scores and update the form', async () => {
        renderComponent();
        fireEvent.click(screen.getByText(/Input Nilai Mapel/i));

        const textarea = await screen.findByPlaceholderText(/Contoh:/i);
        fireEvent.change(textarea, { target: { value: 'Budi 95' } });

        const parseButton = screen.getByRole('button', { name: /Proses dengan AI/i });
        fireEvent.click(parseButton);

        await waitFor(() => {
            expect(ai.parseScoresWithAi).toHaveBeenCalledWith('Budi 95', ['Budi']);
        });

        const studentNameCell = await screen.findByText('Budi');
        const studentRow = studentNameCell.closest('tr')!;
        const scoreInput = within(studentRow).getByRole('spinbutton');
        expect(scoreInput).toHaveValue(95);
    });
});
