
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { useToast } from '../../hooks/useToast';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { MailIcon, LockIcon, UserCircleIcon, EyeIcon, EyeOffIcon } from '../Icons';

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
  const [showPassword, setShowPassword] = useState(false);

  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  
  useEffect(() => {
    if (session) {
      navigate('/dashboard', { replace: true });
    }
  }, [session, navigate]);
  
  const handleFocus = () => document.body.setAttribute('data-focused', 'true');
  const handleBlur = () => document.body.setAttribute('data-focused', 'false');

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
        if (response.error) throw response.error;
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
        const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
            redirectTo: window.location.origin + '/',
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
        <div className="flex items-center justify-center min-h-screen">
            <div className="glass-container">
                <div className="holographic-orb-container">
                    <div className="holographic-orb"><div className="orb-glow"></div><div className="orb-core"></div><div className="orb-ring orb-ring-1"></div><div className="orb-ring orb-ring-2"></div></div>
                </div>
                
                <h1 className="form-title">
                    {isLoginMode ? 'Selamat Datang Kembali' : 'Buat Akun Guru'}
                </h1>
                <p className="form-subtitle">
                  {isLoginMode ? 'Masuk untuk melanjutkan ke Portal Guru' : 'Satu langkah lagi menuju kelas digital Anda.'}
                </p>
                
                <form onSubmit={handleSubmit}>
                    {!isLoginMode && (
                        <div className="form-group-icon"><UserCircleIcon className="icon h-5 w-5" /><input type="text" placeholder="Nama Lengkap" required value={name} onChange={e => setName(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} /></div>
                    )}
                    <div className="form-group-icon"><MailIcon className="icon h-5 w-5" /><input type="email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)} onFocus={handleFocus} onBlur={handleBlur}/></div>
                    <div className="form-group-icon"><LockIcon className="icon h-5 w-5" /><input type={showPassword ? 'text' : 'password'} placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white z-10">{showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}</button></div>
                    {!isLoginMode && (
                        <div className="form-group-icon"><LockIcon className="icon h-5 w-5" /><input type={showPassword ? 'text' : 'password'} placeholder="Konfirmasi Password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} onFocus={handleFocus} onBlur={handleBlur} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white z-10">{showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}</button></div>
                    )}
                    
                    {error && <p className="text-center text-sm text-yellow-300 mb-4">{error}</p>}
                    
                    <button type="submit" className="form-btn" disabled={loading}>
                        {loading ? 'Memproses...' : (isLoginMode ? 'Masuk' : 'Daftar')}
                    </button>
                </form>
                
                <div className="form-links">
                    <button type="button" onClick={() => { setFormMode(isLoginMode ? 'signup' : 'login'); setError(null); setEmail(''); setPassword(''); setName(''); setConfirmPassword(''); }}>
                        {isLoginMode ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
                    </button>
                    {isLoginMode && <button type="button" onClick={() => setIsForgotModalOpen(true)}>Lupa password?</button>}
                </div>
                
                <div className="text-center mt-6 border-t border-white/10 pt-4">
                     <Link to="/" className="form-links a">
                        Kembali ke pemilihan peran
                    </Link>
                </div>
            </div>
        </div>

        <Modal title="Lupa Password" isOpen={isForgotModalOpen} onClose={() => setIsForgotModalOpen(false)}>
            <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Masukkan alamat email Anda. Kami akan mengirimkan tautan untuk mengatur ulang password Anda.</p>
                <div><label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label><Input type="email" id="forgot-email" placeholder="Email terdaftar Anda" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}/></div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => setIsForgotModalOpen(false)} disabled={loading}>Batal</Button><Button type="submit" disabled={loading}>{loading ? 'Mengirim...' : 'Kirim Tautan'}</Button></div>
            </form>
        </Modal>
    </>
  );
};

export default LoginPage;