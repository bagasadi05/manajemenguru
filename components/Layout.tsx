
import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { HomeIcon, UsersIcon, CalendarIcon, ClipboardIcon, LogoutIcon, SettingsIcon, GraduationCapIcon, SearchIcon, CheckSquareIcon, BrainCircuitIcon, ClipboardPenIcon } from './Icons';
import ThemeToggle from './ui/ThemeToggle';
import GlobalSearch from './ui/GlobalSearch';
import { Button } from './ui/Button';
import AiChatAssistant from './AiChatAssistant';

const navItems = [
  { href: '/', label: 'Dashboard', icon: HomeIcon },
  { href: '/absensi', label: 'Absensi', icon: ClipboardIcon },
  { href: '/siswa', label: 'Siswa', icon: UsersIcon },
  { href: '/jadwal', label: 'Jadwal', icon: CalendarIcon },
  { href: '/tugas', label: 'Tugas', icon: CheckSquareIcon },
  { href: '/input-massal', label: 'Input Massal', icon: ClipboardPenIcon },
  { href: '/pengaturan', label: 'Pengaturan', icon: SettingsIcon },
];

interface SidebarProps {
  onLinkClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLinkClick }) => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const handleLogout = async () => {
        if (onLinkClick) {
            onLinkClick();
        }
        await logout();
        navigate('/login', { replace: true });
    };

    return (
        <aside className="w-64 flex-shrink-0 bg-gradient-to-b from-indigo-700 via-purple-800 to-slate-900 flex flex-col p-4 text-white">
            <div className="flex items-center gap-3 px-2 mb-8">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <GraduationCapIcon className="w-6 h-6 text-purple-300" />
                </div>
                <h1 className="text-xl font-bold tracking-wider text-white">Portal Guru</h1>
            </div>

            <div className="flex items-center gap-4 mb-8 p-3 rounded-xl bg-black/20 border border-white/10">
                <img
                    className="h-11 w-11 rounded-full object-cover border-2 border-purple-400"
                    src={user?.avatarUrl}
                    alt="User avatar"
                />
                <div>
                    <p className="font-semibold text-base text-white">{user?.name}</p>
                    <p className="text-xs text-gray-400">{user?.email}</p>
                </div>
            </div>

            <nav className="flex-1 space-y-2">
                {navItems.map((item) => (
                    <NavLink
                        key={item.href}
                        to={item.href}
                        end={item.href === '/'}
                        onClick={onLinkClick}
                        className={({ isActive }) =>
                          `flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-300 transform hover:bg-white/10 hover:translate-x-1 text-gray-300 hover:text-white group ${
                            isActive ? 'bg-gradient-to-r from-purple-600 to-blue-500 shadow-lg text-white font-semibold' : ''
                          }`
                        }
                    >
                        <item.icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>
            <div className="mt-auto pt-4 border-t border-white/10">
                <button
                    onClick={handleLogout}
                    className="flex items-center w-full gap-4 px-4 py-3 text-gray-300 rounded-lg hover:bg-red-500/80 hover:text-white transition-all duration-300"
                >
                    <LogoutIcon className="w-5 h-5" />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
};


const Header: React.FC<{ onMenuClick: () => void; onSearchClick: () => void; }> = ({ onMenuClick, onSearchClick }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isProfileMenuOpen, setProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);

    const handleLogout = async () => {
        setProfileMenuOpen(false);
        await logout();
        navigate('/login', { replace: true });
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setProfileMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [profileMenuRef]);

    return (
        <header className="h-16 bg-white/80 dark:bg-gray-950/70 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
             <button onClick={onMenuClick} className="md:hidden text-gray-500 dark:text-gray-400" aria-label="Buka menu">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
             </button>
            <div className="flex-1"></div>
            <div className="flex items-center space-x-2">
                <Button
                    variant="outline"
                    className="h-9 px-4 hidden sm:inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-gray-900/50"
                    onClick={onSearchClick}
                >
                    <SearchIcon className="h-4 w-4" />
                    <span className="text-sm">Cari...</span>
                    <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-gray-100 dark:bg-gray-700 px-1.5 font-mono text-[10px] font-medium text-gray-600 dark:text-gray-300">
                        ⌘K
                    </kbd>
                </Button>
                <Button variant="ghost" size="icon" onClick={onSearchClick} aria-label="Cari" className="sm:hidden text-gray-500 dark:text-gray-400">
                    <SearchIcon className="h-5 w-5" />
                </Button>
                <ThemeToggle />
                <div className="relative" ref={profileMenuRef}>
                    <button onClick={() => setProfileMenuOpen(prev => !prev)} className="flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 rounded-full">
                         <img
                            className="h-9 w-9 rounded-full object-cover"
                            src={user?.avatarUrl}
                            alt="User avatar"
                        />
                    </button>
                    {isProfileMenuOpen && (
                        <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl shadow-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-md ring-1 ring-black ring-opacity-5 dark:ring-white dark:ring-opacity-10 focus:outline-none animate-fade-in-up" style={{animationDuration: '0.2s'}}>
                            <div className="p-2">
                                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100" aria-hidden="true">{user?.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                                </div>
                                <div className="py-1 mt-1">
                                    <Link to="/pengaturan" onClick={() => setProfileMenuOpen(false)} className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50">
                                        <SettingsIcon className="w-4 h-4 mr-3" />
                                        <span>Pengaturan</span>
                                    </Link>
                                </div>
                                <div className="py-1 border-t border-gray-200 dark:border-gray-700">
                                    <button onClick={handleLogout} className="flex items-center w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10">
                                        <LogoutIcon className="w-4 h-4 mr-3" />
                                        <span>Logout</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
  
    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
            {/* Desktop Sidebar */}
            <div className="hidden md:flex">
                <Sidebar />
            </div>

             {/* Mobile Sidebar */}
            <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}>
                <div className="flex">
                  <Sidebar onLinkClick={() => setSidebarOpen(false)} />
                </div>
                <div className="flex-shrink-0 w-14" onClick={() => setSidebarOpen(false)}></div>
            </div>
            {sidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden" onClick={() => setSidebarOpen(false)}></div>}

            <div className="flex-1 flex flex-col overflow-hidden">
                <Header onMenuClick={() => setSidebarOpen(true)} onSearchClick={() => setSearchOpen(true)} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-transparent">
                    <div className="container mx-auto px-4 sm:px-6 py-8">
                        {children}
                    </div>
                </main>
            </div>
            <GlobalSearch isOpen={searchOpen} setIsOpen={setSearchOpen} />
            <div className="fixed bottom-6 right-6 z-30">
                <Button
                    size="icon"
                    className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 text-white shadow-xl hover:shadow-2xl hover:shadow-purple-500/40 transform hover:-translate-y-1 transition-all"
                    onClick={() => setIsAiAssistantOpen(true)}
                    aria-label="Buka Asisten AI"
                >
                    <BrainCircuitIcon className="h-7 w-7" />
                </Button>
            </div>
            <AiChatAssistant isOpen={isAiAssistantOpen} setIsOpen={setIsAiAssistantOpen} />
        </div>
    );
};

export default Layout;