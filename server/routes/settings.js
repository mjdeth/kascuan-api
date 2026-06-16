import express from 'express';
import pool from '../db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.put('/', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { businessProfile, userProfile } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query(
            `UPDATE business_profiles 
             SET name = $1, type = $2, address = $3, phone = $4, logo_url = $5
             WHERE user_id = $6`,
            [
                businessProfile.name,
                businessProfile.type,
                businessProfile.address,
                businessProfile.phone,
                businessProfile.logoUrl,
                userId
            ]
        );

        await client.query(
            `UPDATE users 
             SET full_name = $1, email = $2
             WHERE id = $3`,
            [userProfile.fullName, userProfile.email, userId]
        );

        await client.query('COMMIT');

        res.status(200).json({ message: 'Pengaturan berhasil diperbarui!' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error saat update settings:', err.message);
        res.status(500).json({ error: 'Gagal memperbarui pengaturan' });
    } finally {
        client.release();
    }
});

router.get('/', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const client = await pool.connect();

    try {
        const userRes = await client.query('SELECT full_name, email, role, avatar_url FROM users WHERE id = $1', [userId]);
        const bizRes = await client.query('SELECT name, type, address, phone, logo_url FROM business_profiles WHERE user_id = $1', [userId]);

        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        const userData = userRes.rows[0];
        const bizData = bizRes.rows[0] || {};

        res.status(200).json({
            userProfile: {
                fullName: userData.full_name,
                email: userData.email,
                role: userData.role,
                avatarUrl: userData.avatar_url || 'https://lh3.googleusercontent.com/'
            },
            businessProfile: {
                name: bizData.name || 'Belum Diatur',
                type: bizData.type || 'Belum Diatur',
                address: bizData.address || '',
                phone: bizData.phone || '',
                logoUrl: bizData.logo_url || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
            }
        });
    } catch (err) {
        console.error('Error fetch settings:', err.message);
        res.status(500).json({ error: 'Gagal memuat profil perusahaan' });
    } finally {
        client.release();
    }
});

export default router;