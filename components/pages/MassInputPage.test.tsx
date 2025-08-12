import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MassInputPage from './MassInputPage';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { ToastProvider } from '@/hooks/useToast';
import * as aiService from '@/services/aiService';

// Mock services and hooks
vi.mock('@/services/aiService');
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useOfflineStatus');

const queryClient = new QueryClient();

const mockClasses = [{ id: 'c1', name: 'Kelas 1A', user_id: 'user-123' }];
const mockStudents = [{ id: 's1', name: 'Budi', class_id: 'c1', user_id: 'user-123' }];

vi.mock('@tanstack/react-query', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        useQuery: vi.fn((options: any) => {
            if (options.queryKey.includes('classes')) return { data: mockClasses, isLoading: false, isError: false };
            if (options.queryKey.includes('studentsOfClass')) return { data: options.queryKey[1] ? mockStudents : [], isLoading: false, isError: false };
            return { data: undefined, isLoading: false, isError: false };
        }),
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
    };
});

const renderComponent = () => {
    return render(
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <MemoryRouter><MassInputPage /></MemoryRouter>
            </ToastProvider>
        </QueryClientProvider>
    );
};

describe('MassInputPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useAuth as vi.Mock).mockReturnValue({ user: { id: 'user-123' } });
        (useOfflineStatus as vi.Mock).mockReturnValue(true);
        (aiService.parseScoresWithAi as vi.Mock).mockResolvedValue({ 'Budi': 95 });
    });

    it('should allow typing multiple characters in the subject input field', async () => {
        renderComponent();
        fireEvent.click(screen.getByText(/Input Nilai Mapel/i));
        const subjectInput = await screen.findByLabelText(/Mata Pelajaran/i);
        fireEvent.change(subjectInput, { target: { value: 'Matematika' } });
        expect(subjectInput).toHaveValue('Matematika');
    });

    it('should allow typing multiple characters in the notes input field', async () => {
        renderComponent();
        fireEvent.click(screen.getByText(/Input Nilai Mapel/i));
        const notesInput = await screen.findByLabelText(/Catatan/i);
        fireEvent.change(notesInput, { target: { value: 'Catatan panjang' } });
        expect(notesInput).toHaveValue('Catatan panjang');
    });

    it('should allow typing multiple characters in the student score input', async () => {
        renderComponent();
        fireEvent.click(screen.getByText(/Input Nilai Mapel/i));
        const studentNameCell = await screen.findByText('Budi');
        const studentRow = studentNameCell.closest('tr')!;
        const scoreInput = within(studentRow).getByRole('spinbutton');
        fireEvent.change(scoreInput, { target: { value: '95' } });
        expect(scoreInput).toHaveValue(95);
    });

    it('should call aiService to parse scores and update the form', async () => {
        renderComponent();
        fireEvent.click(screen.getByText(/Input Nilai Mapel/i));

        const textarea = await screen.findByPlaceholderText(/Contoh:/i);
        fireEvent.change(textarea, { target: { value: 'Budi 95' } });

        const parseButton = screen.getByRole('button', { name: /Proses dengan AI/i });
        fireEvent.click(parseButton);

        // Check if the service was called
        await waitFor(() => {
            expect(aiService.parseScoresWithAi).toHaveBeenCalledWith('Budi 95', ['Budi']);
        });

        // Check if the score input was updated
        const studentNameCell = await screen.findByText('Budi');
        const studentRow = studentNameCell.closest('tr')!;
        const scoreInput = within(studentRow).getByRole('spinbutton');
        expect(scoreInput).toHaveValue(95);
    });
});
