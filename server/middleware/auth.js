import jwt from 'jsonwebtoken';

const verifyToken = (req, res, next) => {
    // Ambil token dari header
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Akses ditolak! Token tidak ditemukan.' });
    }

    try {
        // Verifikasi token menggunakan secret key yang ada di .env
        const verified = jwt.verify(token, process.env.JWT_SECRET);

        // Simpan data user (id dan role) dari token ke dalam request
        req.user = verified;

        // Lanjut ke proses selanjutnya (misal: masuk ke controller transaksi)
        next();
    } catch (err) {
        res.status(403).json({ error: 'Token tidak valid atau sudah kadaluarsa!' });
    }
};

export default verifyToken;