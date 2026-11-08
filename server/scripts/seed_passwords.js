import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:pgsql12345@127.0.0.1:5432/simsarpras_migration_test';
const pool = new pg.Pool({ connectionString });

async function run() {
  try {
    console.log('Script seed_passwords telah dinonaktifkan agar tidak menambahkan kembali akun demo bawaan.');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
