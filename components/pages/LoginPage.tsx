
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { useToast } from '../../hooks/useToast';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const greetingsList = [
    'Halo Guru! 👋',
    'Selamat datang! 😊',
    'Ayo masuk! 🚀',
    'Hari yang indah! ☀️',
    'Siap mengajar! 📚'
];

interface Particle {
  id: number;
  style: React.CSSProperties;
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, signup, session } = useAuth();
  const toast = useToast();
  const [formMode, setFormMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  
  const [particles, setParticles] = useState<Particle[]>([]);
  const [greeting, setGreeting] = useState(greetingsList[0]);
  const robotRef = useRef<HTMLDivElement>(null);
  const leftPupilRef = useRef<HTMLDivElement>(null);
  const rightPupilRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session) {
      navigate('/', { replace: true });
    }
  }, [session, navigate]);
  
  // Create particles on mount
  useEffect(() => {
    const colors = ['#4f46e5', '#7c3aed', '#60a5fa', '#818cf8', '#a78bfa'];
    const newParticles = Array.from({ length: 50 }, (_, i) => {
        const size = Math.random() * 10 + 5;
        return {
            id: i,
            style: {
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 15}s`,
                animationDuration: `${Math.random() * 10 + 15}s`,
                background: colors[Math.floor(Math.random() * colors.length)],
                opacity: Math.random() * 0.5 + 0.3,
                width: `${size}px`,
                height: `${size}px`,
                '--x-end': `${Math.random() * 200 - 100}px`
            } as React.CSSProperties,
        };
    });
    setParticles(newParticles);
  }, []);
  
  // Cycle through greetings
  useEffect(() => {
      const interval = setInterval(() => {
          setGreeting(prev => {
              const currentIndex = greetingsList.indexOf(prev);
              const nextIndex = (currentIndex + 1) % greetingsList.length;
              return greetingsList[nextIndex];
          });
      }, 5000);
      return () => clearInterval(interval);
  }, []);
  
  // Eye tracking effect
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (leftPupilRef.current && rightPupilRef.current) {
              const { clientX, clientY } = e;
              const moveX = (clientX / window.innerWidth - 0.5) * 10;
              const moveY = (clientY / window.innerHeight - 0.5) * 8;
              
              leftPupilRef.current.style.transform = `translate(${moveX}px, ${moveY}px)`;
              rightPupilRef.current.style.transform = `translate(${moveX}px, ${moveY}px)`;
          }
      };
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
        let response;
        if (formMode === 'login') {
            if (!email || !password) throw new Error("Email dan password harus diisi.");
            response = await login(email, password);
        } else {
            if (password !== confirmPassword) throw new Error('Password tidak cocok.');
            if (!name || !email || !password) throw new Error('Semua kolom pendaftaran harus diisi.');
            response = await signup(name, email, password);
            if (!response.error && response.data.user) {
                toast.success('Pendaftaran berhasil! Silakan periksa email Anda untuk verifikasi.');
                setFormMode('login'); // switch to login form
            }
        }

        if (response.error) {
            throw response.error;
        }
        
        // onAuthStateChange in useAuth will handle navigation
    } catch (err: any) {
        setError(err.message || (formMode === 'login' ? 'Gagal untuk login.' : 'Gagal untuk mendaftar.'));
    } finally {
        setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
        // v2: resetPasswordForEmail is directly on `supabase.auth`.
        const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
            redirectTo: window.location.origin + window.location.pathname.replace('index.html', ''),
        });
        if (error) throw error;
        toast.success(`Email pemulihan telah dikirim ke ${forgotEmail}. Silakan periksa kotak masuk Anda.`);
        setIsForgotModalOpen(false);
        setForgotEmail('');
    } catch (err: any) {
        setError(err.message || 'Gagal mengirim email pemulihan.');
        toast.error(err.message || 'Gagal mengirim email pemulihan.');
    } finally {
        setLoading(false);
    }
  };
  
  const isLoginMode = formMode === 'login';

  return (
    <>
        <div className="login-page-bg">
            <div className="particles">
                {particles.map(p => <div key={p.id} className="particle" style={p.style} />)}
            </div>
            
            <div className="login-container" style={{ paddingTop: isLoginMode ? '60px' : '80px' }}>
                <div className="greeting" key={greeting}>{greeting}</div>
                <div className="robot-container">
                    <div ref={robotRef} className="robot">
                        <div className="robot-head">
                            <div className="robot-eye left">
                                <div ref={leftPupilRef} className="robot-pupil"></div>
                            </div>
                            <div className="robot-eye right">
                                <div ref={rightPupilRef} className="robot-pupil"></div>
                            </div>
                            <div className="robot-mouth"></div>
                        </div>
                        <div className="robot-body">
                            <div className="robot-arm left"></div>
                            <div className="robot-arm right"></div>
                        </div>
                    </div>
                </div>
                
                <h1 className="login-title">{isLoginMode ? 'Manajemen Guru' : 'Buat Akun Baru'}</h1>
                <p className="login-subtitle">
                  {isLoginMode ? 'Masuk untuk mengelola siswa dan jadwal' : 'Isi formulir untuk mendaftar.'}
                </p>
                
                <form onSubmit={handleSubmit}>
                    {!isLoginMode && (
                        <div className="form-group">
                            <label htmlFor="full-name">Nama Lengkap</label>
                            <input type="text" id="full-name" placeholder="Masukkan nama lengkap" required value={name} onChange={e => setName(e.target.value)} />
                        </div>
                    )}
                    
                    <div className="form-group">
                        <label htmlFor="email-address">Email</label>
                        <input type="email" id="email-address" placeholder="Masukkan email" required value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input type="password" id="password" placeholder="Masukkan password" required value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    
                    {!isLoginMode && (
                        <div className="form-group">
                            <label htmlFor="confirm-password">Konfirmasi Password</label>
                            <input type="password" id="confirm-password" placeholder="Ulangi password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                        </div>
                    )}
                    
                    {error && (
                        <p className="text-center text-sm text-yellow-300 mb-4">{error}</p>
                    )}
                    
                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? 'Memproses...' : (isLoginMode ? 'Masuk' : 'Daftar')}
                    </button>
                </form>
                
                <div className="login-links">
                    <button type="button" onClick={() => {
                      setFormMode(isLoginMode ? 'signup' : 'login');
                      setError(null);
                      setEmail(''); setPassword(''); setName(''); setConfirmPassword('');
                    }}>
                        {isLoginMode ? 'Belum punya akun?' : 'Sudah punya akun?'}
                    </button>
                    <button type="button" onClick={() => setIsForgotModalOpen(true)}>Lupa password?</button>
                </div>
            </div>
        </div>

        <Modal title="Lupa Password" isOpen={isForgotModalOpen} onClose={() => setIsForgotModalOpen(false)}>
            <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Masukkan alamat email Anda. Kami akan mengirimkan tautan untuk mengatur ulang password Anda.
                </p>
                <div>
                    <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <Input
                        type="email"
                        id="forgot-email"
                        placeholder="Email terdaftar Anda"
                        required
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                    />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={() => setIsForgotModalOpen(false)} disabled={loading}>
                        Batal
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Mengirim...' : 'Kirim Tautan'}
                    </Button>
                </div>
            </form>
        </Modal>
    </>
  );
};

export default LoginPage;
