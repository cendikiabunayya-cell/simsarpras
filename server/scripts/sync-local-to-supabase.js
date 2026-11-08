import pg from 'pg';

async function sync() {
  const local = new pg.Client({
    connectionString: 'postgresql://postgres:pgsql12345@127.0.0.1:5432/simsarpras_migration_test'
  });
  const remote = new pg.Client({
    host: 'aws-0-ap-northeast-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.fmounzjzgnfchcmpmnfg',
    password: '@Bunayya123456789',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await local.connect();
  await remote.connect();
  console.log('Kedua database terhubung (Lokal & Supabase)!');

  // 1. Sync Categories
  const catRows = (await local.query('SELECT * FROM categories')).rows;
  for (const c of catRows) {
    await remote.query(
      `INSERT INTO categories (id, name, default_loan_mode, description, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         default_loan_mode = EXCLUDED.default_loan_mode,
         description = EXCLUDED.description,
         is_active = EXCLUDED.is_active`,
      [c.id, c.name, c.default_loan_mode, c.description, c.is_active, c.created_at]
    );
  }
  console.log(`✓ ${catRows.length} kategori tersinkronisasi.`);

  // 2. Sync Locations
  const locRows = (await local.query('SELECT * FROM locations')).rows;
  for (const l of locRows) {
    await remote.query(
      `INSERT INTO locations (id, name, code, description, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         code = EXCLUDED.code,
         description = EXCLUDED.description,
         is_active = EXCLUDED.is_active`,
      [l.id, l.name, l.code, l.description, l.is_active, l.created_at]
    );
  }
  console.log(`✓ ${locRows.length} lokasi tersinkronisasi.`);

  // 3. Sync Funding Sources
  const fundRows = (await local.query('SELECT * FROM funding_sources')).rows;
  for (const f of fundRows) {
    await remote.query(
      `INSERT INTO funding_sources (id, name, description, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         is_active = EXCLUDED.is_active`,
      [f.id, f.name, f.description, f.is_active, f.created_at]
    );
  }
  console.log(`✓ ${fundRows.length} sumber pendanaan tersinkronisasi.`);

  // 4. Sync Users
  const userRows = (await local.query('SELECT * FROM users')).rows;
  for (const u of userRows) {
    await remote.query(
      `INSERT INTO users (id, email, password_hash, full_name, employee_number, role, department, avatar_url, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         full_name = EXCLUDED.full_name,
         employee_number = EXCLUDED.employee_number,
         role = EXCLUDED.role,
         department = EXCLUDED.department,
         avatar_url = EXCLUDED.avatar_url,
         is_active = EXCLUDED.is_active`,
      [u.id, u.email, u.password_hash, u.full_name, u.employee_number, u.role, u.department, u.avatar_url, u.is_active, u.created_at, u.updated_at]
    );
  }
  console.log(`✓ ${userRows.length} pengguna (termasuk yudha@bunayya.com) tersinkronisasi.`);

  // 5. Sync Assets
  const assetRows = (await local.query('SELECT * FROM assets')).rows;
  for (const a of assetRows) {
    await remote.query(
      `INSERT INTO assets (
         id, permanent_id, qr_token, asset_code, item_number, item_name, institution,
         category_id, category_name, location_id, location_name, item_brand,
         funding_source, acquisition_year, technical_specs, effective_loan_mode,
         condition_status, operational_status, photo_url, notes, standard_accessories,
         is_decommissioned, decommissioned_at, decommissioned_reason, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12,
         $13, $14, $15, $16,
         $17, $18, $19, $20, $21,
         $22, $23, $24, $25, $26
       ) ON CONFLICT (id) DO UPDATE SET
         item_number = EXCLUDED.item_number,
         item_name = EXCLUDED.item_name,
         institution = EXCLUDED.institution,
         operational_status = EXCLUDED.operational_status,
         condition_status = EXCLUDED.condition_status,
         notes = EXCLUDED.notes`,
      [
        a.id, a.permanent_id, a.qr_token, a.asset_code, a.item_number, a.item_name, a.institution,
        a.category_id, a.category_name, a.location_id, a.location_name, a.item_brand,
        a.funding_source, a.acquisition_year, a.technical_specs, a.effective_loan_mode,
        a.condition_status, a.operational_status, a.photo_url, a.notes, JSON.stringify(a.standard_accessories || []),
        a.is_decommissioned, a.decommissioned_at, a.decommissioned_reason, a.created_at, a.updated_at
      ]
    );
  }
  console.log(`✓ ${assetRows.length} barang inventaris tersinkronisasi penuh ke Supabase!`);

  await local.end();
  await remote.end();
  console.log('Sinkronisasi selesai 100%!');
}

sync().catch(console.error);
