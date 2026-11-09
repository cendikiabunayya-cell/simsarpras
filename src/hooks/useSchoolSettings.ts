import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { SchoolSettings } from '../types';

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  schoolName: 'Madrasah Ibtidaiyah Swasta Cendikia Bunayya',
  address: 'Jalan Terus Jaya No. 2 Kec. Kabanjahe Kab. Karo Sumut',
  phone: '081234567890',
  email: 'sarpras@cendikiabunayya.sch.id',
  logoUrl: '/logo-cendikia.png',
  headmasterName: 'Drs. H. Ahmad Sudirman, M.Pd.',
  headmasterNip: '196811121994031002',
  sarprasManagerName: 'Bambang Hermawan, S.Kom.',
  sarprasManagerNip: '198204152008011005',
};

/**
 * Hook terpusat untuk membaca identitas sekolah yang telah dikonfigurasi di Pengaturan Sekolah.
 * Memastikan nama sekolah, logo, dan kontak tidak lagi di-hardcode di komponen manapun.
 */
export function useSchoolSettings() {
  const query = useQuery({
    queryKey: ['school-settings'],
    queryFn: () => api.getSchoolSettings(),
    staleTime: 1000 * 60 * 5,
  });

  const settings: SchoolSettings = query.data || DEFAULT_SCHOOL_SETTINGS;

  return {
    ...query,
    settings,
    schoolName: settings.schoolName || DEFAULT_SCHOOL_SETTINGS.schoolName,
    address: settings.address || DEFAULT_SCHOOL_SETTINGS.address,
    phone: settings.phone || DEFAULT_SCHOOL_SETTINGS.phone,
    email: settings.email || DEFAULT_SCHOOL_SETTINGS.email,
    logoUrl: settings.logoUrl || '',
    headmasterName: settings.headmasterName || DEFAULT_SCHOOL_SETTINGS.headmasterName || 'Drs. H. Ahmad Sudirman, M.Pd.',
    headmasterNip: settings.headmasterNip || DEFAULT_SCHOOL_SETTINGS.headmasterNip || '196811121994031002',
    sarprasManagerName: settings.sarprasManagerName || DEFAULT_SCHOOL_SETTINGS.sarprasManagerName || 'Bambang Hermawan, S.Kom.',
    sarprasManagerNip: settings.sarprasManagerNip || DEFAULT_SCHOOL_SETTINGS.sarprasManagerNip || '198204152008011005',
  };
}
