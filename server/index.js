import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';
import transactionRoutes from './routes/transactions.js';
import userRoutes from './routes/users.js';
import settingsRoutes from './routes/settings.js';

dotenv.config();

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        status: 'success',
        message: 'API Aplikasi Keuangan Berjalan Lancar!'
    });
});
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server backend berjalan di http://localhost:${PORT}`);
});