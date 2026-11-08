-- =============================================================================
-- SIMSARPRAS: Database Schema DDL (PostgreSQL 15 / Supabase)
-- Versi: 2.1.0 - Fase 2A (Audit & Persiapan Database)
-- Deskripsi: Skema relasional terpusat dengan integritas constraint, index,
--            dan kebijakan keamanan (RLS) untuk sistem inventaris sekolah.
-- =============================================================================

-- Ekstensi PostgreSQL yang Dibutuhkan
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. ENUMERASI STATUS SISTEM
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('ADMIN_SARPRAS', 'GURU_PEGAWAI', 'KEPALA_SEKOLAH');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loan_mode') THEN
        CREATE TYPE loan_mode AS ENUM ('DIRECT', 'ADMIN_APPROVAL');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'condition_status') THEN
        CREATE TYPE condition_status AS ENUM ('GOOD', 'MINOR_DAMAGE', 'MAJOR_DAMAGE', 'LOST');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operational_status') THEN
        CREATE TYPE operational_status AS ENUM (
            'AVAILABLE',
            'UNAVAILABLE',
            'RESERVED',
            'ON_LOAN',
            'RETURN_PENDING',
            'RETURN_INSPECTION',
            'MAINTENANCE',
            'INACTIVE',
            'LOST'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loan_status') THEN
        CREATE TYPE loan_status AS ENUM (
            'PENDING_APPROVAL',
            'APPROVED',
            'READY_FOR_HANDOVER',
            'ACTIVE',
            'RETURN_REQUESTED',
            'RETURN_RECEIVED',
            'RETURN_ISSUE',
            'COMPLETED',
            'REJECTED',
            'CANCELLED'
        );
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. TABEL MASTER: KATEGORI & LOKASI & SUMBER PENDANAAN
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    default_loan_mode loan_mode NOT NULL DEFAULT 'DIRECT',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(64) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS funding_sources (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_settings (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'default',
    school_name VARCHAR(255) NOT NULL DEFAULT 'MIS Cendikia Bunayya',
    address TEXT NOT NULL DEFAULT 'Jl. Pendidikan No. 123, Medan, Sumatera Utara',
    phone VARCHAR(64) NOT NULL DEFAULT '081234567890',
    email VARCHAR(128) NOT NULL DEFAULT 'sarpras@cendikiabunayya.sch.id',
    logo_url TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255) DEFAULT 'ADMIN_SARPRAS'
);

-- -----------------------------------------------------------------------------
-- 3. TABEL PENGGUNA (USERS & PROFILES)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    employee_number VARCHAR(64) DEFAULT '-',
    role user_role NOT NULL DEFAULT 'GURU_PEGAWAI',
    department VARCHAR(128) DEFAULT 'Guru / Pegawai',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 4. TABEL MASTER ASET (ASSETS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assets (
    id VARCHAR(64) PRIMARY KEY,
    permanent_id VARCHAR(64) NOT NULL UNIQUE,
    qr_token VARCHAR(64) NOT NULL UNIQUE,
    asset_code VARCHAR(64) NOT NULL UNIQUE,
    item_number VARCHAR(64),
    item_name VARCHAR(255) NOT NULL,
    institution VARCHAR(128) NOT NULL DEFAULT 'MIS Cendikia Bunayya',
    category_id VARCHAR(64) REFERENCES categories(id) ON DELETE RESTRICT,
    category_name VARCHAR(128) NOT NULL,
    location_id VARCHAR(64) NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    location_name VARCHAR(128) NOT NULL,
    item_brand VARCHAR(128),
    funding_source VARCHAR(128) REFERENCES funding_sources(name) ON DELETE RESTRICT,
    acquisition_year INT,
    technical_specs TEXT,
    effective_loan_mode loan_mode NOT NULL DEFAULT 'ADMIN_APPROVAL',
    condition_status condition_status NOT NULL DEFAULT 'GOOD',
    operational_status operational_status NOT NULL DEFAULT 'AVAILABLE',
    photo_url TEXT,
    notes TEXT,
    standard_accessories JSONB DEFAULT '[]'::jsonb,
    is_decommissioned BOOLEAN NOT NULL DEFAULT false,
    decommissioned_at TIMESTAMPTZ,
    decommissioned_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indeks Kinerja Query Barcode & Status
CREATE INDEX IF NOT EXISTS idx_assets_qr_token ON assets(qr_token);
CREATE INDEX IF NOT EXISTS idx_assets_asset_code ON assets(asset_code);
CREATE INDEX IF NOT EXISTS idx_assets_permanent_id ON assets(permanent_id);
CREATE INDEX IF NOT EXISTS idx_assets_operational_status ON assets(operational_status);
CREATE INDEX IF NOT EXISTS idx_assets_location_id ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_category_id ON assets(category_id);

-- -----------------------------------------------------------------------------
-- 5. TABEL TRANSAKSI PEMINJAMAN (LOANS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loans (
    id VARCHAR(64) PRIMARY KEY,
    loan_number VARCHAR(64) NOT NULL UNIQUE,
    asset_id VARCHAR(64) NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    borrower_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL, -- Nullable untuk mendukung peminjaman mandiri guest/guru publik
    borrower_name VARCHAR(255) NOT NULL,
    borrower_employee_number VARCHAR(64) DEFAULT '-',
    borrower_role VARCHAR(64) DEFAULT 'GURU_PEGAWAI',
    status loan_status NOT NULL DEFAULT 'PENDING_APPROVAL',
    loan_mode_snapshot loan_mode NOT NULL,
    purpose TEXT NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_return_at TIMESTAMPTZ NOT NULL,
    approved_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    approved_by_name VARCHAR(255),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    handover_data JSONB,
    return_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loans_asset_id ON loans(asset_id);
CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_loan_number ON loans(loan_number);

-- -----------------------------------------------------------------------------
-- 6. TABEL VERIFIKASI PENGEMBALIAN FISIK (RETURN_INSPECTIONS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS return_inspections (
    id VARCHAR(64) PRIMARY KEY,
    loan_id VARCHAR(64) NOT NULL UNIQUE REFERENCES loans(id) ON DELETE CASCADE,
    received_by VARCHAR(64) NOT NULL REFERENCES users(id),
    received_by_name VARCHAR(255) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    inspected_by VARCHAR(64) NOT NULL REFERENCES users(id),
    inspected_by_name VARCHAR(255) NOT NULL,
    inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by VARCHAR(64) REFERENCES users(id),
    approved_by_name VARCHAR(255),
    approved_at TIMESTAMPTZ,
    condition_at_return condition_status NOT NULL DEFAULT 'GOOD',
    accessories_complete BOOLEAN NOT NULL DEFAULT true,
    issue_description TEXT,
    notes TEXT,
    photo_url TEXT,
    resulting_status operational_status NOT NULL DEFAULT 'AVAILABLE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_inspections_loan_id ON return_inspections(loan_id);

-- -----------------------------------------------------------------------------
-- 7. TABEL AUDIT LOG (IMMUTABLE AUDIT TRAIL)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    user_name VARCHAR(255) NOT NULL,
    user_role VARCHAR(64),
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(128) NOT NULL,
    entity_name VARCHAR(255),
    details TEXT NOT NULL,
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);

-- -----------------------------------------------------------------------------
-- -----------------------------------------------------------------------------
-- 8. KEBIJAKAN ROW-LEVEL SECURITY (RLS) - PERLINDUNGAN MENYELURUH (FASE 2G-1)
-- -----------------------------------------------------------------------------
-- Memastikan keberadaan peran standar Supabase jika dijalankan pada PostgreSQL lokal
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;
EXCEPTION WHEN duplicate_object OR insufficient_privilege THEN
    NULL;
END $$;

-- 8.1. AKTIFKAN RLS PADA SELURUH 8 TABEL SISTEM
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_sources ENABLE ROW LEVEL SECURITY;

-- 8.2. PENCABUTAN HAK AKSES PUBLIK (REVOKE DEFENSE-IN-DEPTH - HARDENED FASE 2I.4)
-- Mencabut seluruh hak akses (termasuk assets) dari peran publik (anon, authenticated, public)
-- Mencegah mass scraping katalog inventaris via Supabase PostgREST API
REVOKE ALL ON TABLE users FROM anon, authenticated, public;
REVOKE ALL ON TABLE assets FROM anon, authenticated, public;
REVOKE ALL ON TABLE loans FROM anon, authenticated, public;
REVOKE ALL ON TABLE return_inspections FROM anon, authenticated, public;
REVOKE ALL ON TABLE audit_logs FROM anon, authenticated, public;
REVOKE ALL ON TABLE categories FROM anon, authenticated, public;
REVOKE ALL ON TABLE locations FROM anon, authenticated, public;
REVOKE ALL ON TABLE funding_sources FROM anon, authenticated, public;

-- Memberikan hak akses penuh kepada service_role (backend Express berwenang)
GRANT ALL ON TABLE users TO service_role;
GRANT ALL ON TABLE categories TO service_role;
GRANT ALL ON TABLE locations TO service_role;
GRANT ALL ON TABLE funding_sources TO service_role;
GRANT ALL ON TABLE assets TO service_role;
GRANT ALL ON TABLE loans TO service_role;
GRANT ALL ON TABLE return_inspections TO service_role;
GRANT ALL ON TABLE audit_logs TO service_role;

-- 8.4. KEBIJAKAN AKSES SERVICE_ROLE (BACKEND RESMI DENGAN KUNCI RAHASIA)
-- Seluruh mutasi dan akses data sensitif diisolasi khusus untuk service_role
DO $$ BEGIN
    -- Aset
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_assets') THEN
        CREATE POLICY service_role_all_assets ON assets
        FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    END IF;
    -- Pinjaman
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_loans') THEN
        CREATE POLICY service_role_all_loans ON loans
        FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    END IF;
    -- Verifikasi Pengembalian
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_return_inspections') THEN
        CREATE POLICY service_role_all_return_inspections ON return_inspections
        FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    END IF;
    -- Audit Logs
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_audit') THEN
        CREATE POLICY service_role_all_audit ON audit_logs
        FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    END IF;
    -- Pengguna Sistem (Users - Isolasi password_hash & data pribadi secara ketat)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_users') THEN
        CREATE POLICY service_role_all_users ON users
        FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    END IF;
    -- Kategori Master
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_categories') THEN
        CREATE POLICY service_role_all_categories ON categories
        FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    END IF;
    -- Lokasi Master
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_locations') THEN
        CREATE POLICY service_role_all_locations ON locations
        FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    END IF;
    -- Sumber Pendanaan Master
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_funding_sources') THEN
        CREATE POLICY service_role_all_funding_sources ON funding_sources
        FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    END IF;
END $$;
