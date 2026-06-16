import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Tes koneksi
pool.connect((err, client, release) => {
    if (err) {
        console.error('Koneksi ke database cloud gagal:', err.stack);
    } else {
        console.log('Berhasil terhubung ke database PostgreSQL.');
        release();
    }
});

export default pool;