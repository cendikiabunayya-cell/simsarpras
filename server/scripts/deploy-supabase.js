import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const client = new pg.Client({
    host: 'aws-0-ap-northeast-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.fmounzjzgnfchcmpmnfg',
    password: '@Bunayya123456789',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  console.log('Menghubungkan ke Supabase PostgreSQL...');
  await client.connect();
  console.log('✓ Terhubung ke Supabase!');

  // 1. Schema
  console.log('1. Membaca schema.sql...');
  const schemaPath = path.resolve(__dirname, '../db/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  console.log('2. Mengeksekusi schema.sql ke Supabase...');
  await client.query(schemaSql);
  console.log('✓ Seluruh tabel skema SIMSARPRAS berhasil dibuat!');

  // 2. Seed
  console.log('3. Membaca seed.sql...');
  const seedPath = path.resolve(__dirname, '../db/seed.sql');
  const seedSql = fs.readFileSync(seedPath, 'utf-8');
  console.log('4. Mengeksekusi seed.sql ke Supabase...');
  await client.query(seedSql);
  console.log('✓ Seluruh data awal (seed) berhasil dimasukkan!');

  // 3. Verifikasi
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Daftar Tabel yang Terbentuk di Supabase:');
  console.table(tablesRes.rows);

  const [uRes, aRes, cRes, lRes, fRes, loanRes] = await Promise.all([
    client.query('SELECT count(*) FROM users'),
    client.query('SELECT count(*) FROM assets'),
    client.query('SELECT count(*) FROM categories'),
    client.query('SELECT count(*) FROM locations'),
    client.query('SELECT count(*) FROM funding_sources'),
    client.query('SELECT count(*) FROM loans'),
  ]);

  console.log('Ringkasan Data di Supabase Cloud:');
  console.log('- Pengguna (users):', uRes.rows[0].count);
  console.log('- Barang / Aset (assets):', aRes.rows[0].count);
  console.log('- Kategori (categories):', cRes.rows[0].count);
  console.log('- Lokasi / Ruang (locations):', lRes.rows[0].count);
  console.log('- Sumber Dana (funding_sources):', fRes.rows[0].count);
  console.log('- Peminjaman (loans):', loanRes.rows[0].count);

  await client.end();
  console.log('Deploy skema & data ke Supabase SELESAI DENGAN SUKSES 100%!');
}

main().catch((err) => {
  console.error('Error deploy ke Supabase:', err);
  process.exit(1);
});
