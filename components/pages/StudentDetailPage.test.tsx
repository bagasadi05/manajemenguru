import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StudentDetailPage from './StudentDetailPage';
import { useAuth } from '@/hooks/useAuth';
import * as db from '@/services/databaseService';
import * as ai from '@/services/aiService';

// Mock services and hooks
vi.mock('@/services/aiService');
vi.mock('@/services/databaseService');
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }) }));
vi.mock('@/hooks/useOfflineStatus', () => ({ useOfflineStatus: () => true }));
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return { ...actual, useNavigate: vi.fn(), useParams: () => ({ studentId: '1' }) };
});

const mockStudentData = {
    student: { id: '1', name: 'Budi Pekerti', avatar_url: 'http://example.com/avatar.png', class_id: 'c1', classes: { id: 'c1', name: 'Kelas 1A' } },
    reports: [], attendanceRecords: [], academicRecords: [], quizPoints: [], violations: [], classAcademicRecords: [], classes: [{ id: 'c1', name: 'Kelas 1A' }],
};

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });

const renderComponent = () => {
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/siswa/1']}>
                <Routes><Route path="/siswa/:studentId" element={<StudentDetailPage />} /></Routes>
            </MemoryRouter>
        </QueryClientProvider>
    );
};

describe('StudentDetailPage', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        (useNavigate as vi.Mock).mockReturnValue(vi.fn());
        (useAuth as vi.Mock).mockReturnValue({ user: { id: 'user-123' } });
        (db.getStudentDetailsPageData as vi.Mock).mockResolvedValue(mockStudentData);
        (ai.generateStudentSummary as vi.Mock).mockResolvedValue({ general_evaluation: 'Test summary' });
    });

    it('should render student name and class after data loading', async () => {
        renderComponent();
        expect(await screen.findByText('Budi Pekerti')).toBeInTheDocument();
        expect(screen.getByText('Kelas 1A')).toBeInTheDocument();
    });
});
