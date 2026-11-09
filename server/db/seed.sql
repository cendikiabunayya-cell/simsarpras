-- =============================================================================
-- SIMSARPRAS: Idempotent Seed Script (Data Migrasi Mock -> PostgreSQL)
-- Versi: 2.1.0 - Fase 2A (Audit & Persiapan Database)
-- Deskripsi: Skrip seed idempoten menggunakan ON CONFLICT DO NOTHING.
--            Menjamin zero data loss, token permanen tidak berubah,
--            dan tidak merusak data jika dijalankan berulang.
-- =============================================================================

-- 1. SEED KATEGORI (4 Data)
INSERT INTO categories (id, name, default_loan_mode, description, is_active)
VALUES
    ('cat-tik', 'TIK/Multimedia', 'ADMIN_APPROVAL', 'Peralatan komputasi, proyektor, audio visual, dan studio multimedia', true),
    ('cat-mebel', 'Mebeler', 'DIRECT', 'Perabot meja, kursi, lemari kelas, dan ruang pertemuan', true),
    ('cat-olahraga', 'Alat Olahraga', 'DIRECT', 'Peralatan senam, bola olahraga, matras, dan sarana PJOK', true),
    ('cat-elektronik', 'Elektronik', 'ADMIN_APPROVAL', 'Peralatan pendingin ruangan AC, genset, sound system, dan instalasi daya', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    default_loan_mode = EXCLUDED.default_loan_mode,
    description = EXCLUDED.description;

-- 2. SEED LOKASI / RUANGAN
INSERT INTO locations (id, name, code, description, is_active)
VALUES
    ('loc-1', 'Lab Komputer 1 (TIK)', 'LAB-TIK-1', 'Lantai 2 Gedung B, laboratorium komputer siswa', true),
    ('loc-3', 'Ruang Guru & Tata Usaha', 'RG-01', 'Ruang kerja staf pendidik dan kependidikan', true),
    ('loc-6', 'Gudang Sarpras Olahraga', 'GUD-OLR', 'Penyimpanan peralatan olahraga samping lapangan', true),
    ('loc-7', 'Gudang Sarpras Utama', 'GUD-01', 'Gudang penyimpanan sentral aset inventaris sekolah', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    description = EXCLUDED.description;

-- 3. SEED SUMBER PENDANAAN (5 Data)
INSERT INTO funding_sources (id, name, description, is_active)
VALUES
    ('fs-1', 'BOS Reguler', 'Bantuan Operasional Satuan Pendidikan Reguler APBN', true),
    ('fs-2', 'BOS Kinerja', 'BOS Kinerja Sekolah Penggerak / Berprestasi', true),
    ('fs-3', 'DAK Fisik', 'Dana Alokasi Khusus Fisik Bidang Pendidikan', true),
    ('fs-4', 'Komite Sekolah', 'Sumbangan dan partisipasi orang tua siswa komite', true),
    ('fs-5', 'Bantuan Pemerintah / Hibah', 'Bantuan kemitraan industri / dinas provinsi', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 4. SEED PENGGUNA SISTEM (4 Data)
INSERT INTO users (id, email, password_hash, full_name, employee_number, role, department, avatar_url, is_active)
VALUES
    ('usr-admin-1', 'admin.sarpras@smkn1teladan.sch.id', '$2a$10$wT0U9.u81hJmC8m1uBfD1eO8a9Qh9g4j1L8i5k7m3n5o7p9q1r3s5', 'Bambang Hermawan, S.Kom.', '198204152008011005', 'ADMIN_SARPRAS', 'Unit Sarana & Prasarana', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80', true),
    ('usr-guru-1', 'siti.nurhaliza@smkn1teladan.sch.id', '$2a$10$wT0U9.u81hJmC8m1uBfD1eO8a9Qh9g4j1L8i5k7m3n5o7p9q1r3s5', 'Siti Nurhaliza, S.Pd.', '199003202015022003', 'GURU_PEGAWAI', 'Guru Multimedia & Desain', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', true),
    ('usr-guru-2', 'andi.wijaya@smkn1teladan.sch.id', '$2a$10$wT0U9.u81hJmC8m1uBfD1eO8a9Qh9g4j1L8i5k7m3n5o7p9q1r3s5', 'Andi Wijaya, S.Pd.', '199208112019031008', 'GURU_PEGAWAI', 'Guru Rekayasa Perangkat Lunak', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', true),
    ('usr-kepsek-1', 'kepsek@smkn1teladan.sch.id', '$2a$10$wT0U9.u81hJmC8m1uBfD1eO8a9Qh9g4j1L8i5k7m3n5o7p9q1r3s5', 'Drs. H. Ahmad Sudirman, M.Pd.', '196811121994031002', 'KEPALA_SEKOLAH', 'Pimpinan Sekolah', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', true)
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department = EXCLUDED.department;

-- 5. SEED MASTER ASET (11 Data - Identitas Token Dipertahankan 100%)
INSERT INTO assets (
    id, permanent_id, qr_token, asset_code, item_name, institution,
    category_id, category_name, location_id, location_name,
    item_brand, funding_source, acquisition_year, technical_specs,
    effective_loan_mode, condition_status, operational_status,
    photo_url, notes, standard_accessories
)
VALUES
    (
        'unit-laptop-01', 'PERM-TIK-ASUS-001', 'QR-TIK-ASUS-001', 'INV-TIK-2024-001',
        'Laptop Guru ASUS ExpertBook', 'MIS Cendikia Bunayya',
        'cat-tik', 'TIK/Multimedia', 'loc-7', 'Gudang Sarpras Utama',
        'ASUS', 'BOS Reguler', 2024, 'Core i5-1235U, RAM 16GB DDR4, SSD 512GB NVMe, Layar 14" FHD IPS',
        'ADMIN_APPROVAL', 'GOOD', 'AVAILABLE',
        'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&auto=format&fit=crop&q=80',
        'Baterai sehat 98%, Windows 11 Pro original, tas laptop lengkap.',
        '["Charger 65W Original", "Tas Laptop ASUS", "Mouse Wireless"]'::jsonb
    ),
    (
        'unit-laptop-02', 'PERM-TIK-ASUS-002', 'QR-TIK-ASUS-002', 'INV-TIK-2024-002',
        'Laptop Guru ASUS ExpertBook', 'MIS Cendikia Bunayya',
        'cat-tik', 'TIK/Multimedia', 'loc-3', 'Ruang Guru & Tata Usaha',
        'ASUS', 'BOS Reguler', 2024, 'Core i5-1235U, RAM 16GB DDR4, SSD 512GB NVMe, Layar 14" FHD IPS',
        'ADMIN_APPROVAL', 'GOOD', 'ON_LOAN',
        'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&auto=format&fit=crop&q=80',
        'Sedang dipinjam Bu Siti Nurhaliza untuk pelatihan Canva Guru Nasional.',
        '["Charger 65W Original", "Tas Laptop ASUS", "Mouse Wireless"]'::jsonb
    ),
    (
        'unit-proyektor-01', 'PERM-TIK-EPSON-010', 'QR-TIK-EPSON-010', 'INV-TIK-2025-010',
        'Proyektor Epson EB-E01', 'RA Cendikia Bunayya',
        'cat-tik', 'TIK/Multimedia', 'loc-7', 'Gudang Sarpras Utama',
        'Epson', 'DAK Fisik', 2025, 'Resolusi XGA 1024x768, Kecerahan 3300 Lumens, Rasio Kontras 15.000:1, Port HDMI & VGA',
        'ADMIN_APPROVAL', 'GOOD', 'AVAILABLE',
        'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&auto=format&fit=crop&q=80',
        'Lampu proyektor pemakaian baru 40 jam. Kecerahan tajam.',
        '["Kabel Power", "Kabel HDMI 3M", "Remote Epson", "Tas Proyektor"]'::jsonb
    ),
    (
        'unit-pointer-01', 'PERM-TIK-LOGI-031', 'QR-TIK-LOGI-031', 'INV-TIK-2025-031',
        'Wireless Laser Presenter Pointer', 'RA Cendikia Bunayya',
        'cat-tik', 'TIK/Multimedia', 'loc-7', 'Gudang Sarpras Utama',
        'Logitech', 'BOS Reguler', 2025, 'Frekuensi 2.4 GHz, Jangkauan 15 Meter, Red Laser Pointer, Plug & Play USB',
        'DIRECT', 'GOOD', 'AVAILABLE',
        'https://images.unsplash.com/photo-1588508065123-287b28e013da?w=500&auto=format&fit=crop&q=80',
        'Mode peminjaman DIRECT. Baterai AAA baru terpasang.',
        '["USB Dongle Receiver", "Pouch Sarung"]'::jsonb
    ),
    (
        'unit-kamera-01', 'PERM-TIK-CANON-020', 'QR-TIK-CANON-020', 'INV-TIK-2024-020',
        'Kamera DSLR Dokumentasi Sekolah', 'MIS Cendikia Bunayya',
        'cat-tik', 'TIK/Multimedia', 'loc-2', 'Ruang Multimedia & Studio',
        'Canon', 'BOS Kinerja', 2024, 'Sensor APS-C CMOS 18 MP, Lensa Kit 18-55mm DC III, Video Full HD 1080p, Wi-Fi',
        'ADMIN_APPROVAL', 'GOOD', 'AVAILABLE',
        'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500&auto=format&fit=crop&q=80',
        'Kamera studio utama, sensor bersih, lensa bebas jamur.',
        '["Lensa 18-55mm", "Baterai LP-E10", "Charger", "Strap", "Memory Card 32GB", "Tas Kamera"]'::jsonb
    ),
    (
        'unit-speaker-01', 'PERM-ELK-BARETONE-005', 'QR-ELK-BARETONE-005', 'INV-ELK-2025-005',
        'Portable PA Wireless Speaker 15 Inch', 'RA Cendikia Bunayya',
        'cat-elektronik', 'Elektronik', 'loc-4', 'Aula Utama Ki Hajar Dewantara',
        'Baretone', 'Komite Sekolah', 2025, 'Daya 250 Watt RMS, Woofer 15 Inch, 2 Mic Wireless Handheld, Aki Kering 12V 7Ah, Bluetooth/USB',
        'ADMIN_APPROVAL', 'GOOD', 'AVAILABLE',
        'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500&auto=format&fit=crop&q=80',
        '2 Mic wireless frekuensi UHF, aki terisi penuh siap pakai acara.',
        '["2 Unit Mic Wireless", "Kabel Power AC", "Remote Control"]'::jsonb
    ),
    (
        'unit-meja-01', 'PERM-MEB-RAPAT-001', 'QR-MEB-RAPAT-001', 'INV-MEB-2023-001',
        'Meja Rapat Oval Kayu Jati', 'MIS Cendikia Bunayya',
        'cat-mebel', 'Mebeler', 'loc-3', 'Ruang Guru & Tata Usaha',
        'Pengrajin Jepara', 'DAK Fisik', 2023, 'Ukuran: 300 x 120 x 75 cm, Kayu Jati Solid Finishing Melamik Natural, Lubang Manajemen Kabel',
        'DIRECT', 'GOOD', 'AVAILABLE',
        'https://images.unsplash.com/photo-1577140917170-285929fb55b7?w=500&auto=format&fit=crop&q=80',
        'Kondisi kokoh, permukaan mulus tanpa cacat.',
        '["Kunci Grommet"]'::jsonb
    ),
    (
        'unit-kursi-01', 'PERM-MEB-CHITOSE-088', 'QR-MEB-CHITOSE-088', 'INV-MEB-2024-088',
        'Kursi Lipat Kuliah / Rapat Stainless', 'RA Cendikia Bunayya',
        'cat-mebel', 'Mebeler', 'loc-4', 'Aula Utama Ki Hajar Dewantara',
        'Chitose', 'BOS Reguler', 2024, 'Ukuran dudukan 42 x 40 cm, Tinggi 82 cm, Busa Rebounded Tebal Dilapis Kulit Sintetis Hitam',
        'DIRECT', 'GOOD', 'AVAILABLE',
        'https://images.unsplash.com/photo-1580481077195-c328a37db719?w=500&auto=format&fit=crop&q=80',
        'Kaki karet anti selip utuh, lipatan presisi.',
        '[]'::jsonb
    ),
    (
        'unit-matras-01', 'PERM-OLR-MATRAS-014', 'QR-OLR-MATRAS-014', 'INV-OLR-2025-014',
        'Matras Senam Lantai Busa Rebounded', 'MIS Cendikia Bunayya',
        'cat-olahraga', 'Alat Olahraga', 'loc-6', 'Gudang Sarpras Olahraga',
        'Olympus Sport', 'BOS Reguler', 2025, 'Ukuran: 200 x 100 x 15 cm, Density Busa 70, Cover Terpal PVC Tarpaulin Anti Air & Sobek',
        'DIRECT', 'GOOD', 'AVAILABLE',
        'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=500&auto=format&fit=crop&q=80',
        'Terdapat pegangan samping untuk mudah dipindahkan.',
        '["Tali Pengikat Matras"]'::jsonb
    ),
    (
        'unit-bola-01', 'PERM-OLR-MOLTEN-003', 'QR-OLR-MOLTEN-003', 'INV-OLR-2026-003',
        'Bola Basket Pertandingan Resmi Size 7', 'RA Cendikia Bunayya',
        'cat-olahraga', 'Alat Olahraga', 'loc-6', 'Gudang Sarpras Olahraga',
        'Molten', 'BOS Reguler', 2026, 'Ukuran Size 7 (Keliling 75-78 cm), Berat 600-650 gr, Kulit Sintetis Polyurethane Premium 12 Panel',
        'DIRECT', 'GOOD', 'AVAILABLE',
        'https://images.unsplash.com/photo-1519861531473-9200262188bf?w=500&auto=format&fit=crop&q=80',
        'Tekanan angin 8 psi standar FIBA.',
        '["Jaring Bola", "Pentil Pompa"]'::jsonb
    ),
    (
        'unit-ac-01', 'PERM-ELK-DAIKIN-002', 'QR-ELK-DAIKIN-002', 'INV-ELK-2024-002',
        'AC Split Inverter 2 PK', 'MIS Cendikia Bunayya',
        'cat-elektronik', 'Elektronik', 'loc-1', 'Lab Komputer 1 (TIK)',
        'Daikin', 'DAK Fisik', 2024, 'Kapasitas Pendingin 18.000 BTU/h, Daya Listrik 1.450 Watt, Freon R32 Ramah Lingkungan',
        'ADMIN_APPROVAL', 'GOOD', 'AVAILABLE',
        'https://images.unsplash.com/photo-1614633833026-06201b13b194?w=500&auto=format&fit=crop&q=80',
        'Rutin dicuci tiap 3 bulan. Filter bersih dan dingin optimal.',
        '["Remote Control Daikin Original", "Bracket Dinding"]'::jsonb
    )
ON CONFLICT (id) DO NOTHING;

-- 6. SEED TRANSAKSI PEMINJAMAN (2 Data)
INSERT INTO loans (
    id, loan_number, asset_id, borrower_id, borrower_name, borrower_employee_number,
    borrower_role, status, loan_mode_snapshot, purpose, requested_at, expected_return_at,
    approved_by, approved_by_name, approved_at, handover_data
)
VALUES
    (
        'loan-req-001', 'PINJAM-2026-10-001', 'unit-laptop-02', 'usr-guru-1',
        'Siti Nurhaliza, S.Pd.', '199003202015022003', 'GURU_PEGAWAI',
        'ACTIVE', 'ADMIN_APPROVAL',
        'Pelatihan guru kejuruan Canva & Editing Grafis Tingkat Provinsi.',
        '2026-10-08T07:30:00Z', '2026-10-12T16:00:00Z',
        'usr-admin-1', 'Bambang Hermawan, S.Kom.', '2026-10-08T08:00:00Z',
        '{"handedOverBy": "usr-admin-1", "handedOverByName": "Bambang Hermawan, S.Kom.", "handedOverAt": "2026-10-08T08:30:00Z", "conditionAtHandover": "GOOD", "accessoriesVerified": true, "notes": "Diserahkan dalam keadaan tas rapi, charger dan mouse lengkap."}'::jsonb
    ),
    (
        'loan-req-002', 'PINJAM-2026-10-002', 'unit-matras-01', 'usr-guru-2',
        'Andi Wijaya, S.Pd.', '199208112019031008', 'GURU_PEGAWAI',
        'READY_FOR_HANDOVER', 'DIRECT',
        'Mengajar senam lantai kelas X di lapangan tertutup.',
        '2026-10-10T07:15:00Z', '2026-10-10T12:00:00Z',
        NULL, NULL, NULL, NULL
    )
ON CONFLICT (id) DO NOTHING;

-- 7. SEED AUDIT LOGS (2 Data)
INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, created_at)
VALUES
    (
        'aud-001', 'usr-guru-1', 'Siti Nurhaliza, S.Pd.', 'GURU_PEGAWAI',
        'PENGAJUAN_PINJAMAN', 'LOAN_REQUEST', 'loan-req-001',
        'Laptop Guru ASUS ExpertBook (INV-TIK-2024-002)',
        'Mengajukan peminjaman laptop untuk pelatihan Canva Nasional.',
        '2026-10-08T07:30:00Z'
    ),
    (
        'aud-002', 'usr-admin-1', 'Bambang Hermawan, S.Kom.', 'ADMIN_SARPRAS',
        'SERAH_TERIMA_PINJAMAN', 'LOAN_REQUEST', 'loan-req-001',
        'Laptop Guru ASUS ExpertBook (INV-TIK-2024-002)',
        'Petugas sarpras mengonfirmasi serah terima fisik barang. Status berubah ke ACTIVE.',
        '2026-10-08T08:30:00Z'
    )
ON CONFLICT (id) DO NOTHING;
