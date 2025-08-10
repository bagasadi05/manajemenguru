import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StudentDetailPage from './StudentDetailPage';
import { useAuth } from '@/hooks/useAuth';
import { useStudentData } from '@/hooks/useStudentData';
import { useStudentMutations } from '@/hooks/useStudentMutations';
import { useToast } from '@/hooks/useToast';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';

// Mock the custom hooks and react-router-dom
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useStudentData');
vi.mock('@/hooks/useStudentMutations');
vi.mock('@/hooks/useToast');
vi.mock('@/hooks/useOfflineStatus');
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return {
        ...actual,
        useNavigate: vi.fn(),
        useParams: () => ({ studentId: '1' }), // Mock useParams directly
    };
});

const mockStudentData = {
    student: { id: '1', name: 'Budi Pekerti', avatar_url: 'http://example.com/avatar.png', class_id: 'c1', classes: { id: 'c1', name: 'Kelas 1A' } },
    reports: [],
    attendanceRecords: [],
    academicRecords: [],
    quizPoints: [],
    violations: [],
    classAcademicRecords: [],
    classes: [{ id: 'c1', name: 'Kelas 1A' }],
};

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false, // Disable retries for tests
        },
    },
});

const renderComponent = () => {
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/siswa/1']}>
                <Routes>
                    <Route path="/siswa/:studentId" element={<StudentDetailPage />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    );
};

describe('StudentDetailPage', () => {
    let mockNavigate: vi.Mock;

    beforeEach(() => {
        // Reset mocks before each test
        vi.resetAllMocks();
        mockNavigate = vi.fn();

        // Setup default mocks
        (useNavigate as vi.Mock).mockReturnValue(mockNavigate);
        (useAuth as vi.Mock).mockReturnValue({ user: { id: 'user-123' } });
        (useToast as vi.Mock).mockReturnValue({ success: vi.fn(), error: vi.fn(), warning: vi.fn() });
        (useOfflineStatus as vi.Mock).mockReturnValue(true);
        (useStudentData as vi.Mock).mockReturnValue({ data: mockStudentData, isLoading: false, isError: false, error: null });
        (useStudentMutations as vi.Mock).mockReturnValue({
            updateStudentMutation: { mutate: vi.fn(), isPending: false },
            updateAvatarMutation: { mutate: vi.fn(), isPending: false },
            deleteStudentMutation: { mutate: vi.fn(), isPending: false },
            createOrUpdateReportMutation: { mutate: vi.fn(), isPending: false },
            deleteReportMutation: { mutate: vi.fn(), isPending: false },
            createOrUpdateAcademicMutation: { mutate: vi.fn(), isPending: false },
            deleteAcademicMutation: { mutate: vi.fn(), isPending: false },
            createOrUpdateQuizPointMutation: { mutate: vi.fn(), isPending: false },
            deleteQuizPointMutation: { mutate: vi.fn(), isPending: false },
            createOrUpdateViolationMutation: { mutate: vi.fn(), isPending: false },
            deleteViolationMutation: { mutate: vi.fn(), isPending: false },
        });
    });

    it('should render student name and class', () => {
        renderComponent();
        expect(screen.getByText('Budi Pekerti')).toBeInTheDocument();
        expect(screen.getByText('Kelas 1A')).toBeInTheDocument();
    });

    it('should show loading spinner when data is loading', () => {
        (useStudentData as vi.Mock).mockReturnValue({ data: null, isLoading: true, isError: false, error: null });
        renderComponent();
        expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
    });

    it('should show an error message if data fetching fails', () => {
        (useStudentData as vi.Mock).mockReturnValue({ data: null, isLoading: false, isError: true, error: new Error('Failed to fetch') });
        renderComponent();
        expect(screen.getByText(/Siswa tidak ditemukan atau terjadi kesalahan./i)).toBeInTheDocument();
    });

    it('should open the edit student modal when "Edit" button is clicked', async () => {
        renderComponent();

        const editButton = screen.getByRole('button', { name: /edit/i });
        fireEvent.click(editButton);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /Edit Profil Siswa/i })).toBeInTheDocument();
        });
    });

    it('should render all stat cards with correct values', () => {
        renderComponent();

        const presenceCard = screen.getByText('Kehadiran').parentElement!;
        expect(within(presenceCard).getByText('100%')).toBeInTheDocument();

        const averageScoreCard = screen.getByText('Rata-rata Nilai').parentElement!;
        expect(within(averageScoreCard).getByText('0')).toBeInTheDocument();

        const reportCard = screen.getByText('Total Laporan').parentElement!;
        expect(within(reportCard).getByText('0')).toBeInTheDocument();

        const alphaCard = screen.getByText('Total Alpha').parentElement!;
        expect(within(alphaCard).getByText('0')).toBeInTheDocument();

        const violationCard = screen.getByText('Poin Pelanggaran').parentElement!;
        expect(within(violationCard).getByText('0')).toBeInTheDocument();
    });
});
