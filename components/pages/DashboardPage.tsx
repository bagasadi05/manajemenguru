import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/Card';
import { ArrowUpRight, UsersIcon, CheckCircleIcon, CalendarIcon, ListTodoIcon, BarChartIcon, AlertCircleIcon } from '../Icons';
import LoadingSpinner from '../LoadingSpinner';
import GreetingRobot from '../GreetingRobot';
import * as db from '@/services/databaseService';

const DashboardPage: React.FC = () => {
    const { user } = useAuth();
    const [showGreeting, setShowGreeting] = useState(true);

    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const sevenDaysAgo = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().slice(0, 10);
    }, []);
    const thirtyDaysAgo = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().slice(0, 10);
    }, []);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['dashboardData', user?.id],
        queryFn: () => db.getDashboardData(user!.id, today, sevenDaysAgo, thirtyDaysAgo),
        enabled: !!user,
    });

    const stats = useMemo(() => {
        if (!data) return {};
        const totalStudents = data.students?.length || 0;
        const totalClasses = data.classes?.length || 0;
        const totalSchedules = data.schedules?.length || 0;
        const totalTasks = data.tasks?.length || 0;
        const presentToday = data.todayAttendance?.filter(a => a.status === 'Hadir').length || 0;
        const attendancePercentage = totalStudents > 0 ? (presentToday / totalStudents * 100).toFixed(0) : 100;

        return {
            totalStudents, totalClasses, totalSchedules, totalTasks, attendancePercentage,
            recentReports: data.recentReports || [],
            tasks: data.tasks || [],
            todayAttendance: data.todayAttendance || [],
        };
    }, [data]);

    if (isLoading) return <LoadingSpinner fullScreen />;
    if (isError) return <div className="text-center py-10">Gagal memuat data dashboard.</div>;

    return (
        <div className="space-y-6">
            {showGreeting && user && (
                <GreetingRobot userName={user.user_metadata.full_name || 'Pengguna'} onAnimationEnd={() => setShowGreeting(false)} />
            )}
            {/* ... Other JSX ... */}
        </div>
    );
};

export default DashboardPage;
