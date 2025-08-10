import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../../hooks/useToast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Switch } from '../ui/Switch';
import { Modal } from '../ui/Modal';
import { UserCircleIcon, PaletteIcon, BellIcon, ShieldIcon, CameraIcon, SunIcon, MoonIcon, CheckCircleIcon, LinkIcon, DownloadCloudIcon } from '../Icons';
import * as ics from 'ics';
import type { EventAttributes } from 'ics';
import { supabase } from '../../services/supabase';
import { Database } from '../../services/database.types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { optimizeImage } from '../utils/image';
import LoadingSpinner from '../LoadingSpinner';


type ScheduleRow = Database['public']['Tables']['schedules']['Row'];
type ClassRow = Database['public']['Tables']['classes']['Row'];
type ScheduleWithClassName = ScheduleRow & { className?: string };

const ProfileSection: React.FC = () => {
    const { user, updateUser } = useAuth();
    const toast = useToast();
    const isOnline = useOfflineStatus();
    const [name, setName] = useState(user?.name || '');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setName(user?.name || '');
    }, [user]);

    const handleAvatarUpload = async (file: File) => {
        if (!user) return;
        setUploading(true);

        try {
            const optimizedBlob = await optimizeImage(file, { maxWidth: 300, quality: 0.8 });
            const optimizedFile = new File([optimizedBlob], `${user.id}-avatar.jpg`, { type: 'image/jpeg' });
            
            const filePath = `${user.id}/avatar-${new Date().getTime()}.jpg`;
            
            const { error: uploadError } = await supabase.storage
                .from('teacher_assets')
                .upload(filePath, optimizedFile, {
                    cacheControl: '3600',
                    upsert: true, // Upsert to overwrite if a file with the same name exists (e.g. retry)
                });

            if (uploadError) {
                throw uploadError;
            }
            
            const { data: publicUrlData } = supabase.storage
                .from('teacher_assets')
                .getPublicUrl(filePath);

            if (publicUrlData.publicUrl) {
                const { error: updateUserError } = await updateUser({ avatar_url: publicUrlData.publicUrl });
                if (updateUserError) {
                    throw updateUserError;
                } else {
                    toast.success("Foto profil berhasil diperbarui!");
                }
            } else {
                throw new Error("Tidak bisa mendapatkan URL publik untuk foto.");
            }

        } catch (error: any) {
            toast.error(`Gagal mengunggah foto: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleAvatarUpload(file);
        }
    };

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await updateUser({ name });
        if (error) {
            toast.error(`Gagal memperbarui profil: ${error.message}`);
        } else {
            toast.success("Profil berhasil diperbarui!");
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Profil Pengguna</CardTitle>
                <CardDescription>Perbarui informasi profil dan foto Anda.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleProfileSubmit} className="space-y-6">
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            <img
                                key={user?.avatarUrl} // Add key to force re-render of img tag
                                src={user?.avatarUrl || `https://i.pravatar.cc/150?u=${user?.id}`}
                                alt="Avatar"
                                className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700"
                            />
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg" className="hidden" disabled={uploading}/>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading || !isOnline}
                                className="absolute -bottom-1 -right-1 p-2 bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full shadow-md hover:scale-110 transition-transform"
                                aria-label="Ubah foto profil"
                            >
                                {uploading ? (
                                    <LoadingSpinner sizeClass="w-5 h-5" borderWidthClass="border-2" colorClass="border-white" />
                                ) : (
                                    <CameraIcon className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold">{user?.name}</h3>
                            <p className="text-gray-500 dark:text-gray-400">{user?.email}</p>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nama Lengkap</label>
                        <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1"/>
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit" disabled={!isOnline}>Simpan Perubahan</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
};

const AppearanceSection: React.FC = () => {
    const { theme, setTheme } = useTheme();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tampilan</CardTitle>
                <CardDescription>Pilih tema warna favorit Anda untuk aplikasi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Mode Warna</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button onClick={() => setTheme('light')} className={`p-4 rounded-lg border-2 transition-all ${theme === 'light' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-300 dark:border-gray-700 hover:border-blue-400'}`}>
                        <div className="flex items-center gap-4">
                            <SunIcon className="w-6 h-6 text-yellow-500"/>
                            <div>
                                <p className="font-semibold text-gray-800 dark:text-gray-200 text-left">Terang</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 text-left">Gunakan tema terang.</p>
                            </div>
                            {theme === 'light' && <CheckCircleIcon className="w-6 h-6 text-blue-500 ml-auto"/>}
                        </div>
                    </button>
                    <button onClick={() => setTheme('dark')} className={`p-4 rounded-lg border-2 transition-all ${theme === 'dark' ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-gray-300 dark:border-gray-700 hover:border-purple-400'}`}>
                        <div className="flex items-center gap-4">
                            <MoonIcon className="w-6 h-6 text-purple-400"/>
                            <div>
                                <p className="font-semibold text-gray-800 dark:text-gray-200 text-left">Gelap</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 text-left">Gunakan tema gelap.</p>
                            </div>
                            {theme === 'dark' && <CheckCircleIcon className="w-6 h-6 text-purple-500 ml-auto"/>}
                        </div>
                    </button>
                </div>
            </CardContent>
        </Card>
    );
};

const NotificationsSection: React.FC = () => {
    const { user } = useAuth();
    const enableScheduleNotifications = async (_schedule: ScheduleWithClassName[]) => false;
    const disableScheduleNotifications = async () => {};
    const toast = useToast();
    const isOnline = useOfflineStatus();
    const [isEnabled, setIsEnabled] = useState(() => localStorage.getItem('scheduleNotificationsEnabled') === 'true');
    const [isLoading, setIsLoading] = useState(false);

    const { data: scheduleData } = useQuery({
        queryKey: ['scheduleWithClasses', user?.id],
        queryFn: async () => {
            const { data: schedule, error: scheduleError } = await supabase
                .from('schedules')
                .select('*')
                .eq('user_id', user!.id);

            const { data: classes, error: classesError } = await supabase
                .from('classes')
                .select('id, name')
                .eq('user_id', user!.id);
            
            if (scheduleError || classesError) {
                throw scheduleError || classesError;
            }

            const classMap = new Map(classes.map(c => [c.id, c.name]));
            
            return schedule.map(item => ({
                ...item,
                className: classMap.get(item.class_id) || item.class_id
            }));
        },
        enabled: !!user
    });

    const handleToggle = async (checked: boolean) => {
        setIsLoading(true);
        if (checked) {
            if (!scheduleData || scheduleData.length === 0) {
                toast.warning("Tidak ada data jadwal untuk notifikasi.");
                setIsLoading(false);
                return;
            }
            const success = await enableScheduleNotifications(scheduleData as ScheduleWithClassName[]);
            if (success) {
                toast.success("Notifikasi jadwal diaktifkan!");
                setIsEnabled(true);
            } else {
                 toast.error("Gagal mengaktifkan notifikasi.");
            }
        } else {
            await disableScheduleNotifications();
            toast.info("Notifikasi jadwal dinonaktifkan.");
            setIsEnabled(false);
        }
        setIsLoading(false);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Notifikasi</CardTitle>
                <CardDescription>Dapatkan pengingat 5 menit sebelum kelas dimulai.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800/50 rounded-lg">
                    <div>
                        <p className="font-medium text-gray-800 dark:text-gray-200">Notifikasi Jadwal</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Izinkan pemberitahuan di browser Anda.</p>
                    </div>
                    <Switch checked={isEnabled} onChange={(e) => handleToggle(e.target.checked)} disabled={isLoading || !isOnline} />
                </div>
            </CardContent>
        </Card>
    );
};

const IntegrationsSection: React.FC = () => {
    const { user } = useAuth();
    const toast = useToast();
    const isOnline = useOfflineStatus();

    const { data: scheduleData } = useQuery({
        queryKey: ['scheduleForICS', user?.id],
        queryFn: async () => {
             const { data, error } = await supabase
                .from('schedules')
                .select('*')
                .eq('user_id', user!.id);
            if (error) throw error;
            return data;
        },
        enabled: !!user,
    });

    const handleExport = () => {
        if (!scheduleData || scheduleData.length === 0) {
            toast.warning("Tidak ada jadwal untuk diekspor.");
            return;
        }

        // Map Indonesian day names to iCalendar BYDAY values
        const dayToICalDay: Record<string, 'MO' | 'TU' | 'WE' | 'TH' | 'FR'> = {
            'Senin': 'MO',
            'Selasa': 'TU',
            'Rabu': 'WE',
            'Kamis': 'TH',
            'Jumat': 'FR',
        };
        const dayNameToIndex: Record<string, number> = { 'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6 };

        const events: EventAttributes[] = scheduleData.map(item => {
            const [startHour, startMinute] = item.start_time.split(':').map(Number);
            const [endHour, endMinute] = item.end_time.split(':').map(Number);

            // Find the date of the next occurrence of the specified day
            const now = new Date();
            const targetDayIndex = dayNameToIndex[item.day];
            const currentDayIndex = now.getDay();
            
            let dayDifference = targetDayIndex - currentDayIndex;
            // If the day has already passed this week, schedule it for next week.
            if (dayDifference < 0 || (dayDifference === 0 && (now.getHours() > startHour || (now.getHours() === startHour && now.getMinutes() > startMinute)))) {
                dayDifference += 7;
            }

            const eventDate = new Date();
            eventDate.setDate(now.getDate() + dayDifference);

            const year = eventDate.getFullYear();
            const month = eventDate.getMonth() + 1;
            const day = eventDate.getDate();

            // The recurrence rule should be specific to the day of the event
            const recurrenceRule = `FREQ=WEEKLY;BYDAY=${dayToICalDay[item.day]}`;
            
            return {
                uid: `guru-pwa-${item.id}@myapp.com`,
                title: `${item.subject} (Kelas ${item.class_id})`,
                start: [year, month, day, startHour, startMinute] as [number, number, number, number, number],
                end: [year, month, day, endHour, endMinute] as [number, number, number, number, number],
                recurrenceRule,
                description: `Jadwal mengajar untuk kelas ${item.class_id}`,
                location: 'Sekolah',
                startOutputType: 'local',
                endOutputType: 'local',
            };
        });

        ics.createEvents(events, (error, value) => {
            if (error) {
                toast.error("Gagal membuat file kalender.");
                console.error(error);
                return;
            }
            const blob = new Blob([value], { type: 'text/calendar;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'jadwal_mengajar.ics';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("File kalender berhasil diunduh!");
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Integrasi Kalender</CardTitle>
                <CardDescription>Ekspor jadwal mengajar Anda ke aplikasi kalender favorit.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="flex items-start justify-between p-4 bg-gray-100 dark:bg-gray-800/50 rounded-lg">
                    <div>
                        <p className="font-medium text-gray-800 dark:text-gray-200">Ekspor ke iCalendar (.ics)</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Impor jadwal Anda ke Google Calendar, Apple Calendar, atau Outlook.</p>
                    </div>
                    <Button onClick={handleExport} variant="outline" disabled={!isOnline}><DownloadCloudIcon className="w-4 h-4 mr-2"/> Ekspor</Button>
                </div>
            </CardContent>
        </Card>
    );
};


const AccountSection: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const { updateUser } = useAuth();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isOnline = useOfflineStatus();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            toast.error("Password tidak cocok.");
            return;
        }
        if (password.length < 6) {
            toast.error("Password minimal harus 6 karakter.");
            return;
        }
        const { error } = await updateUser({ password });
        if (error) {
            toast.error(`Gagal mengubah password: ${error.message}`);
        } else {
            toast.success("Password berhasil diubah!");
            setPassword('');
            setConfirmPassword('');
        }
    };

    const handleDeleteAccount = async () => {
        const { error } = await supabase.rpc('delete_user_account', {});
        if (error) {
            toast.error(`Gagal menghapus akun: ${error.message}`);
        } else {
            toast.success("Akun berhasil dihapus. Anda akan logout.");
            await queryClient.clear();
            onLogout();
        }
        setDeleteModalOpen(false);
    };

    return (
        <>
            <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Ubah Password</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium">Password Baru</label>
                                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-1" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Konfirmasi Password Baru</label>
                                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="mt-1" />
                            </div>
                            <div className="flex justify-end">
                                <Button type="submit" disabled={!isOnline}>Simpan Password</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
                <Card className="border-red-500/30 dark:border-red-500/50">
                    <CardHeader>
                        <CardTitle className="text-red-600 dark:text-red-400">Zona Berbahaya</CardTitle>
                        <CardDescription>Tindakan di bawah ini tidak dapat diurungkan.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <div>
                                <p className="font-semibold text-red-800 dark:text-red-200">Hapus Akun Ini</p>
                                <p className="text-xs text-red-600 dark:text-red-300">Semua data Anda akan dihapus secara permanen.</p>
                            </div>
                            <Button variant="destructive" onClick={() => setDeleteModalOpen(true)} disabled={!isOnline}>Hapus Akun</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <Modal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Konfirmasi Penghapusan Akun">
                <div className="space-y-4">
                    <p>Ini adalah tindakan permanen. Semua data siswa, laporan, dan jadwal Anda akan hilang. Untuk melanjutkan, ketik <strong className="text-red-500">HAPUS</strong> di bawah ini.</p>
                    <Input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="HAPUS" />
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>Batal</Button>
                        <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleteConfirmText !== 'HAPUS' || !isOnline}>
                            Saya Mengerti, Hapus Akun Saya
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};


const SettingsPage: React.FC = () => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    
    const navItems = [
        { id: 'profile', label: 'Profil', icon: UserCircleIcon }, { id: 'appearance', label: 'Tampilan', icon: PaletteIcon },
        { id: 'notifications', label: 'Notifikasi', icon: BellIcon }, { id: 'integrations', label: 'Integrasi', icon: LinkIcon },
        { id: 'account', label: 'Akun & Keamanan', icon: ShieldIcon },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'profile': return <ProfileSection />;
            case 'appearance': return <AppearanceSection />;
            case 'notifications': return <NotificationsSection />;
            case 'integrations': return <IntegrationsSection />;
            case 'account': return <AccountSection onLogout={logout} />;
            default: return null;
        }
    }

    return (
        <div className="space-y-8 animate-fade-in-up">
            <header className="relative p-8 rounded-2xl bg-gradient-to-br from-indigo-700 via-purple-800 to-slate-900 text-white shadow-2xl shadow-indigo-500/30 overflow-hidden">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full"></div><div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-white/10 rounded-full"></div>
                <div className="relative z-10"><h1 className="text-3xl md:text-4xl font-bold">Pengaturan</h1><p className="mt-2 text-indigo-200 max-w-2xl">Kelola profil, tampilan, dan preferensi notifikasi Anda di satu tempat.</p></div>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <aside className="lg:col-span-1">
                    <nav className="flex flex-wrap lg:flex-col gap-2">
                        {navItems.map((item) => (
                            <button 
                                key={item.id} 
                                onClick={() => setActiveTab(item.id)} 
                                className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${ activeTab === item.id ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white font-semibold shadow-md' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800/60 hover:text-purple-600 dark:hover:text-purple-400' }`}
                            >
                                <item.icon className="w-5 h-5 flex-shrink-0" /> 
                                <span className="text-sm font-medium">{item.label}</span>
                            </button>
                        ))}
                    </nav>
                </aside>
                <main className="lg:col-span-3">
                    <div key={activeTab} className="transition-all duration-300 animate-fade-in">
                        {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SettingsPage;
