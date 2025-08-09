
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { SearchIcon, UsersIcon, GraduationCapIcon, BookOpenIcon } from '../Icons';

type StudentResult = { id: string; name: string; class_id: string; };
type ClassResult = { id: string; name: string; studentCount: number };
type ScheduleResult = { id: string; subject: string; class_id: string; day: string };

type SearchResults = {
    students: StudentResult[];
    classes: ClassResult[];
    schedules: ScheduleResult[];
};

const fetchGlobalSearchData = async (userId: string) => {
    const [studentsRes, classesRes, schedulesRes] = await Promise.all([
        supabase.from('students').select('id, name, class_id').eq('user_id', userId),
        supabase.from('classes').select('id, name').eq('user_id', userId),
        supabase.from('schedules').select('id, subject, class_id, day').eq('user_id', userId),
    ]);

    if (studentsRes.error) throw studentsRes.error;
    if (classesRes.error) throw classesRes.error;
    if (schedulesRes.error) throw schedulesRes.error;

    const classStudentCounts = (studentsRes.data || []).reduce((acc, student) => {
        acc[student.class_id] = (acc[student.class_id] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return {
        students: studentsRes.data || [],
        classes: (classesRes.data || []).map(c => ({...c, studentCount: classStudentCounts[c.id] || 0 })),
        schedules: schedulesRes.data || [],
    };
};

const GlobalSearch: React.FC<{ isOpen: boolean; setIsOpen: (isOpen: boolean) => void }> = ({ isOpen, setIsOpen }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsContainerRef = useRef<HTMLDivElement>(null);

    const { data } = useQuery({
        queryKey: ['globalSearchData', user?.id],
        queryFn: () => fetchGlobalSearchData(user!.id),
        enabled: !!user && isOpen,
        staleTime: 1000 * 60 * 5, 
    });

    const searchResults = useMemo((): SearchResults => {
        if (!searchTerm.trim() || !data) {
            return { students: [], classes: [], schedules: [] };
        }
        const lowercasedTerm = searchTerm.toLowerCase();

        const filteredStudents = data.students
            .filter(s => s.name.toLowerCase().includes(lowercasedTerm))
            .slice(0, 5);

        const filteredClasses = data.classes
            .filter(c => c.name.toLowerCase().includes(lowercasedTerm))
            .slice(0, 3);
        
        const filteredSchedules = data.schedules
            .filter(s => s.subject.toLowerCase().includes(lowercasedTerm))
            .slice(0, 3);

        return { students: filteredStudents, classes: filteredClasses, schedules: filteredSchedules };
    }, [searchTerm, data]);

    const flatResults = useMemo(() => [
        ...searchResults.students.map(s => ({ type: 'Siswa' as const, ...s, path: `/siswa/${s.id}`, icon: UsersIcon })),
        ...searchResults.classes.map(c => ({ type: 'Kelas' as const, ...c, path: `/siswa`, icon: GraduationCapIcon })),
        ...searchResults.schedules.map(s => ({ type: 'Jadwal' as const, ...s, path: `/jadwal`, icon: BookOpenIcon }))
    ], [searchResults]);

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
        } else {
            setSearchTerm('');
            setActiveIndex(0);
        }
    }, [isOpen]);
    
    useEffect(() => {
        setActiveIndex(0);
    }, [searchTerm]);

    useEffect(() => {
        if (resultsContainerRef.current) {
            const activeElement = resultsContainerRef.current.querySelector(`[data-index="${activeIndex}"]`);
            if (activeElement) {
                activeElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [activeIndex]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (flatResults.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev + 1) % flatResults.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev - 1 + flatResults.length) % flatResults.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (flatResults[activeIndex]) {
                navigate(flatResults[activeIndex].path);
                setIsOpen(false);
            }
        }
    };
    
    if (!isOpen) return null;

    return (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsOpen(false)}
        >
            <div 
              className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl mx-auto mt-[15vh] animate-fade-in-up flex flex-col"
              onClick={e => e.stopPropagation()}
            >
                <div className="relative" onKeyDown={handleKeyDown}>
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                        <SearchIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Cari siswa, kelas, atau jadwal..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-14 bg-transparent pl-12 pr-4 text-base md:text-lg border-b border-gray-200 dark:border-gray-700 focus:outline-none"
                        aria-label="Kotak Pencarian Global"
                    />
                </div>
                <div className="p-2 md:p-4 max-h-[50vh] overflow-y-auto" ref={resultsContainerRef}>
                    {searchTerm.trim() && flatResults.length === 0 && (
                        <div className="text-center py-10 text-gray-500">
                            <p className="font-semibold">Tidak ada hasil ditemukan</p>
                            <p className="text-sm">Coba kata kunci yang berbeda.</p>
                        </div>
                    )}
                    {flatResults.length > 0 && (
                        <div className="space-y-1">
                            {flatResults.map((item, index) => {
                                const isActive = index === activeIndex;
                                const Icon = item.icon;
                                const title = item.type === 'Jadwal' ? item.subject : item.name;
                                const subtitle = item.type === 'Kelas' ? `${item.studentCount} siswa` : item.type;
                                
                                return (
                                    <Link 
                                      to={item.path} 
                                      key={`${item.type}-${item.id}`} 
                                      onClick={() => setIsOpen(false)}
                                      className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors ${isActive ? 'bg-blue-500/10 dark:bg-blue-500/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                      aria-current={isActive}
                                      data-index={index}
                                    >
                                        <div className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${isActive ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-100 dark:bg-gray-700/50'}`}>
                                            <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <p className={`font-semibold truncate ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>{title}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
                 <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                    Gunakan <kbd className="font-sans rounded bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5">↑</kbd> <kbd className="font-sans rounded bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5">↓</kbd> untuk navigasi dan <kbd className="font-sans rounded bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5">Enter</kbd> untuk memilih.
                 </div>
            </div>
        </div>
    );
};

export default GlobalSearch;
