const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Redirigir raíz a login
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

let pool;

async function initDB() {
    pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
}

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso restringido a administradores' });
    next();
};

// Login Route
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        // Special case: RUC as login/password
        if (username === password) {
            const [empRows] = await pool.query('SELECT * FROM empresas WHERE ruc = ?', [username]);
            if (empRows.length > 0) {
                const emp = empRows[0];
                const token = jwt.sign({ 
                    id: 0, 
                    username: 'Administrador', 
                    ruc: emp.ruc,
                    empresa: emp.razon_social,
                    role: 'admin'
                }, process.env.JWT_SECRET, { expiresIn: '8h' });
                
                return res.json({ 
                    token, 
                    user: { 
                        username: 'Administrador', 
                        ruc: emp.ruc, 
                        empresa: emp.razon_social,
                        logo: emp.logo,
                        role: 'admin'
                    } 
                });
            }
        }

        // Standard user login
        const [rows] = await pool.query('SELECT u.*, e.razon_social, e.logo FROM usuarios u JOIN empresas e ON u.ruc_empresa = e.ruc WHERE u.username = ?', [username]);
        
        if (rows.length === 0) return res.status(401).json({ error: 'Usuario no encontrado' });
        
        const user = rows[0];
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) return res.status(401).json({ error: 'Contraseña incorrecta' });
        
        const token = jwt.sign({ 
            id: user.id, 
            username: user.username, 
            ruc: user.ruc_empresa,
            empresa: user.razon_social,
            role: 'user'
        }, process.env.JWT_SECRET, { expiresIn: '8h' });
        
        res.json({ 
            token, 
            user: { 
                username: user.username, 
                ruc: user.ruc_empresa, 
                empresa: user.razon_social,
                logo: user.logo,
                role: 'user'
            } 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Documents Route (Multi-Company)
app.get('/api/documents', authenticateToken, async (req, res) => {
    const ruc = req.user.ruc;
    const { tipo, serie, numero, estado } = req.query;

    try {
        let query = 'SELECT * FROM documentos WHERE (ruc_emisor = ? OR ruc_receptor = ?)';
        let params = [ruc, ruc];

        if (tipo) { query += ' AND tipo = ?'; params.push(tipo); }
        if (serie) { query += ' AND serie LIKE ?'; params.push(`%${serie}%`); }
        if (numero) { query += ' AND numero LIKE ?'; params.push(`%${numero}%`); }
        if (estado) { query += ' AND estado = ?'; params.push(estado); }

        const [rows] = await pool.query(query + ' ORDER BY fecha DESC', params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al consultar documentos' });
    }
});

// User Management Routes
app.get('/api/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, username, ruc_empresa FROM usuarios WHERE ruc_empresa = ?', [req.user.ruc]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar usuarios' });
    }
});

app.post('/api/users', authenticateToken, isAdmin, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO usuarios (username, password, ruc_empresa) VALUES (?, ?, ?)', 
            [username, hashedPassword, req.user.ruc]);
        res.status(201).json({ message: 'Usuario creado con éxito' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

app.delete('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM usuarios WHERE id = ? AND ruc_empresa = ?', [req.params.id, req.user.ruc]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json({ message: 'Usuario eliminado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

const PORT = process.env.PORT || 3000;
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});
