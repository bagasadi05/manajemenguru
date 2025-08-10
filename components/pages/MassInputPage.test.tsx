import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MassInputPage from './MassInputPage';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { ToastProvider } from '@/hooks/useToast';

// Mock hooks
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useOfflineStatus');

const queryClient = new QueryClient();

const mockClasses = [{ id: 'c1', name: 'Kelas 1A', user_id: 'user-123' }];
const mockStudents = [{ id: 's1', name: 'Budi', class_id: 'c1', user_id: 'user-123' }];

// Mock supabase calls via react-query
vi.mock('@tanstack/react-query', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        useQuery: vi.fn((options: any) => {
            if (options.queryKey.includes('classes')) {
                return { data: mockClasses, isLoading: false, isError: false };
            }
            if (options.queryKey.includes('studentsOfClass')) {
                // Only return students if a class is selected
                if (options.queryKey[1]) {
                    return { data: mockStudents, isLoading: false, isError: false };
                }
                return { data: [], isLoading: false, isError: false };
            }
            return { data: undefined, isLoading: false, isError: false };
        }),
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
    };
});


const renderComponent = () => {
    return render(
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <MemoryRouter>
                    <MassInputPage />
                </MemoryRouter>
            </ToastProvider>
        </QueryClientProvider>
    );
};

describe('MassInputPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useAuth as vi.Mock).mockReturnValue({ user: { id: 'user-123' } });
        (useOfflineStatus as vi.Mock).mockReturnValue(true);
    });

    it('should allow typing multiple characters in the subject input field', async () => {
        renderComponent();

        const subjectGradeCard = screen.getByText(/Input Nilai Mapel/i);
        fireEvent.click(subjectGradeCard);

        const subjectInput = await screen.findByLabelText(/Mata Pelajaran/i);
        fireEvent.change(subjectInput, { target: { value: 'Matematika' } });
        expect(subjectInput).toHaveValue('Matematika');
    });

    it('should allow typing multiple characters in the notes input field', async () => {
        renderComponent();

        const subjectGradeCard = screen.getByText(/Input Nilai Mapel/i);
        fireEvent.click(subjectGradeCard);

        const notesInput = await screen.findByLabelText(/Catatan/i);
        fireEvent.change(notesInput, { target: { value: 'Catatan panjang' } });
        expect(notesInput).toHaveValue('Catatan panjang');
    });

    it('should allow typing multiple characters in the student score input', async () => {
        renderComponent();

        const subjectGradeCard = screen.getByText(/Input Nilai Mapel/i);
        fireEvent.click(subjectGradeCard);

        // Wait for the student's name to appear, which indicates the table has loaded
        const studentNameCell = await screen.findByText('Budi');

        // Find the table row associated with this student
        const studentRow = studentNameCell.closest('tr')!;
        expect(studentRow).not.toBeNull();

        // Find the input within that row (role for type="number" is "spinbutton")
        const scoreInput = within(studentRow).getByRole('spinbutton');

        // Interact with the specific input
        fireEvent.change(scoreInput, { target: { value: '95' } });
        expect(scoreInput).toHaveValue(95);
    });
});
