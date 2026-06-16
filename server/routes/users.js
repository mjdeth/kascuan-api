import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import pool from '../db.js';

const router = express.Router();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    },
    tls: {
        rejectUnauthorized: false
    }
});

transporter.verify(function (error, success) {
    if (error) {
        console.log("Koneksi error:", error);
    } else {
        console.log("Server siap mengirim pesan!");
    }
});

router.post('/register', async (req, res) => {
    const client = await pool.connect();
    try {
        const { full_name, email, password, role, business_name } = req.body;

        const userExist = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExist.rows.length > 0) {
            return res.status(400).json({ error: 'Email sudah terdaftar!' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const verificationToken = crypto.randomBytes(32).toString('hex');

        await client.query('BEGIN');

        const newUser = await client.query(
            `INSERT INTO users (full_name, email, password_hash, role, verification_token, is_verified) 
             VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id`,
            [full_name, email, password_hash, role || 'Admin Bisnis', verificationToken]
        );

        const userId = newUser.rows[0].id;

        await client.query(
            `INSERT INTO business_profiles (user_id, name, type, address, phone) 
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, business_name || 'Belum Diatur', 'Belum Diatur', '', '']
        );

        await client.query('COMMIT');

        const verificationUrl = `http://localhost:5173/verify-email?token=${verificationToken}`;
        await transporter.sendMail({
            from: `"KasCuan" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verifikasi Akun KasCuan Anda',
            html: `<h3>Selamat datang di EquiCount!</h3>
                   <p>Halo ${full_name}, silakan klik tautan di bawah ini untuk memverifikasi akun Anda:</p>
                   <a href="${verificationUrl}" style="padding:10px 20px; background-color:#006c49; color:white; text-decoration:none; border-radius:8px;">Verifikasi Email Saya</a>
                   <p>Jika Anda tidak mendaftar, abaikan email ini.</p>`
        });

        res.status(201).json({
            message: 'Registrasi berhasil! Silakan cek email Anda untuk verifikasi sebelum masuk.'
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ error: 'Server error saat registrasi' });
    } finally {
        client.release();
    }
});

router.get('/verify-email', async (req, res) => {
    const { token } = req.query;
    try {
        const result = await pool.query(
            'UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE verification_token = $1 RETURNING id',
            [token]
        );
        if (result.rows.length === 0) return res.status(400).json({ error: 'Token tidak valid atau sudah kedaluwarsa.' });
        res.status(200).json({ message: 'Email berhasil diverifikasi! Anda sekarang bisa masuk.' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/request-reset-password', async (req, res) => {
    const { email } = req.body;
    try {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expireDate = new Date(Date.now() + 3600000);
        const result = await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3 RETURNING full_name',
            [resetToken, expireDate, email]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Email tidak ditemukan.' });

        // Kirim Email
        const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;
        await transporter.sendMail({
            from: `"KasCuan" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Permintaan Perubahan Kata Sandi',
            html: `<p>Halo ${result.rows[0].full_name},</p>
                   <p>Kami menerima permintaan untuk mengubah kata sandi Anda. Klik tombol di bawah ini:</p>
                   <a href="${resetUrl}">Ubah Kata Sandi</a>`
        });

        res.status(200).json({ message: 'Tautan reset sandi telah dikirim ke email Anda.' });
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengirim email reset sandi.' });
    }
});

router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        // Cek token apakah valid dan belum expired
        const userRes = await pool.query(
            'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
            [token]
        );

        if (userRes.rows.length === 0) return res.status(400).json({ error: 'Token tidak valid atau sudah kedaluwarsa.' });

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword, salt);

        // Update sandi dan hapus token
        await pool.query(
            'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
            [password_hash, userRes.rows[0].id]
        );

        res.status(200).json({ message: 'Kata sandi berhasil diubah! Silakan masuk kembali.' });
    } catch (err) {
        res.status(500).json({ error: 'Gagal mengubah kata sandi.' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Cari user berdasarkan email
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            return res.status(401).json({ error: 'Email atau password salah!' });
        }

        if (!user.rows[0].is_verified) {
            return res.status(401).json({ error: 'Harap verifikasi email Anda terlebih dahulu! Cek kotak masuk Anda.' });
        }
        const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Email atau password salah!' });
        }

        const token = jwt.sign(
            { id: user.rows[0].id, role: user.rows[0].role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            message: 'Login berhasil!',
            token,
            user: {
                id: user.rows[0].id,
                full_name: user.rows[0].full_name,
                email: user.rows[0].email,
                role: user.rows[0].role
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error saat login' });
    }
});

export default router;