import express from 'express';
import pool from '../db.js';
import verifyToken from '../middleware/auth.js';

const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
    try {
        const { user_id, date, type, category, note, amount, status } = req.body;

        // Generate ID (contoh simpel menggunakan timestamp agar unik: tx-1715001234)
        // Alternatifnya bisa query ID terakhir lalu di-increment (tx-1, tx-2)
        const id = `tx-${Date.now()}`;

        const newTransaction = await pool.query(
            `INSERT INTO transactions (id, user_id, date, type, category, note, amount, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [id, user_id, date, type, category, note, amount, status]
        );

        res.status(201).json(newTransaction.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error saat menambah transaksi' });
    }
});

// --- R: READ (Ambil Semua Transaksi Milik User Tertentu) ---
router.get('/:userId', verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const allTransactions = await pool.query(
            'SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC',
            [userId]
        );

        res.json(allTransactions.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error saat mengambil data' });
    }
});

// --- U: UPDATE (Edit Transaksi) ---
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { date, type, category, note, amount, status } = req.body;

        const updateTransaction = await pool.query(
            `UPDATE transactions 
             SET date = $1, type = $2, category = $3, note = $4, amount = $5, status = $6 
             WHERE id = $7 RETURNING *`,
            [date, type, category, note, amount, status, id]
        );

        if (updateTransaction.rows.length === 0) {
            return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
        }

        res.json({ message: 'Transaksi berhasil diupdate!', data: updateTransaction.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error saat update transaksi' });
    }
});

// --- D: DELETE (Hapus Transaksi) ---
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const deleteTransaction = await pool.query(
            'DELETE FROM transactions WHERE id = $1 RETURNING *',
            [id]
        );

        if (deleteTransaction.rows.length === 0) {
            return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
        }

        res.json({ message: 'Transaksi berhasil dihapus!' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error saat menghapus transaksi' });
    }
});

export default router;