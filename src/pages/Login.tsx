import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Boxes,
  Lock,
  LogIn,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  User,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSchoolSettings } from '../hooks/useSchoolSettings';
import { Button } from '../components/ui/Button';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { allUsers, switchUser, login, isMock } = useAuth();
  const { schoolName, logoUrl } = useSchoolSettings();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const logoutNotice =
    (location.state as any)?.notice ||
    (new URLSearchParams(location.search).get('logged_out') === '1'
      ? 'Anda telah berhasil keluar dari sistem.'
      : null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (isMock) {
        // Mode simulasi / mock lokal: fallback pencarian akun demo
        const matched = allUsers.find(
          (u) =>
            u.employeeNumber === identifier.trim() ||
            u.email.toLowerCase() === identifier.trim().toLowerCase()
        );

        if (matched) {
          await switchUser(matched);
          setIsLoading(false);
          navigate('/');
        } else {
          setIsLoading(false);
          setErrorMessage(
            'NIP atau Email tidak terdaftar dalam basis data sistem sarpras sekolah.'
          );
        }
      } else {
        // Mode operasional nyata: panggil API login ke backend Express
        await login(identifier.trim(), password);
        setIsLoading(false);
        navigate('/');
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || 'Login gagal. Silakan periksa NIP/Email dan kata sandi Anda.');
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/30 mb-2 overflow-hidden relative">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={schoolName}
                className="w-full h-full object-contain p-1"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.login-fallback-icon');
                  if (fallback) fallback.classList.remove('hidden');
                }}
              />
            ) : null}
            <Boxes className={`w-8 h-8 ${logoUrl ? 'hidden login-fallback-icon' : ''}`} />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            SI-SARPRAS
          </h1>
          <p className="text-xs text-blue-200">
            Sistem Informasi Inventaris Sarana dan Prasarana Sekolah
            <br />
            <span className="text-blue-400 font-semibold">{schoolName}</span>
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 sm:p-8 space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Masuk ke Sistem</h2>
            <p className="text-xs text-slate-500">
              Gunakan Nomor Induk Pegawai (NIP) atau email kedinasan Anda.
            </p>
          </div>

          {logoutNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{logoutNotice}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                NIP atau Alamat Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Masukkan NIP atau Email (contoh: admin.bunayya@gmail.com)"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Kata Sandi</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              className="w-full bg-blue-800 hover:bg-blue-900 font-bold shadow-md"
              leftIcon={<LogIn className="w-4 h-4" />}
            >
              Masuk
            </Button>
          </form>

          {/* Akses Cepat Scan QR Code Tanpa Login */}
          <div className="pt-4 border-t border-slate-100 space-y-2 text-center">
            <p className="text-[11px] text-slate-500 font-medium">
              Guru, Pegawai, atau Tamu ingin memindai barcode fisik barang?
            </p>
            <Link
              to="/scan"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs transition-colors shadow-2xs"
            >
              <QrCode className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Scan QR Code / Pinjam Barang (Tanpa Login)</span>
            </Link>
          </div>
        </div>

        {/* Security Disclaimers */}
        <div className="text-center text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Kredensial Aman • Terenkripsi End-to-End</span>
          </div>
          <div>Sistem Informasi Inventaris Sarana dan Prasarana Sekolah</div>
        </div>
      </div>
    </div>
  );
};
