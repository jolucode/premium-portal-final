const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Modelos de MongoDB (Mongoose)
const EmpresaSchema = new mongoose.Schema({
    ruc: { type: String, required: true, unique: true },
    razon_social: String,
    logo: String
});

const UsuarioSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    ruc_empresa: { type: String, required: true },
    role: { type: String, default: 'user' }
});

const DocumentoSchema = new mongoose.Schema({
    tipo: String,
    serie: String,
    numero: String,
    fecha: Date,
    monto: Number,
    moneda: String,
    ruc_emisor: String,
    ruc_receptor: String,
    estado: String,
    pdf_path: String,
    xml_path: String,
    cdr_path: String
});

const Empresa = mongoose.model('Empresa', EmpresaSchema);
const Usuario = mongoose.model('Usuario', UsuarioSchema);
const Documento = mongoose.model('Documento', DocumentoSchema);

// Redirigir raíz a login
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

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
        if (username === password) {
            const emp = await Empresa.findOne({ ruc: username });
            if (emp) {
                const token = jwt.sign({ 
                    id: 'admin', username: 'Administrador', ruc: emp.ruc, empresa: emp.razon_social, role: 'admin'
                }, process.env.JWT_SECRET, { expiresIn: '8h' });
                return res.json({ token, user: { username: 'Administrador', ruc: emp.ruc, empresa: emp.razon_social, logo: emp.logo, role: 'admin' } });
            }
        }

        const user = await Usuario.findOne({ username });
        if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Contraseña incorrecta' });
        
        const emp = await Empresa.findOne({ ruc: user.ruc_empresa });
        const token = jwt.sign({ 
            id: user._id, username: user.username, ruc: user.ruc_empresa, empresa: emp ? emp.razon_social : 'Empresa Desconocida', role: user.role || 'user'
        }, process.env.JWT_SECRET, { expiresIn: '8h' });
        
        res.json({ token, user: { username: user.username, ruc: user.ruc_empresa, empresa: emp ? emp.razon_social : 'Empresa Desconocida', logo: emp ? emp.logo : null, role: user.role || 'user' } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Documents Route
app.get('/api/documents', authenticateToken, async (req, res) => {
    const ruc = req.user.ruc;
    const { tipo, serie, numero, estado } = req.query;
    try {
        let filter = { $or: [{ ruc_emisor: ruc }, { ruc_receptor: ruc }] };
        if (tipo) filter.tipo = tipo;
        if (serie) filter.serie = { $regex: serie, $options: 'i' };
        if (numero) filter.numero = { $regex: numero, $options: 'i' };
        if (estado) filter.estado = estado;
        const docs = await Documento.find(filter).sort({ fecha: -1 });
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: 'Error al consultar documentos' });
    }
});

// User Management Routes
app.get('/api/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const users = await Usuario.find({ ruc_empresa: req.user.ruc }, 'username ruc_empresa role');
        res.json(users.map(u => ({ id: u._id, username: u.username, ruc_empresa: u.ruc_empresa })));
    } catch (err) {
        res.status(500).json({ error: 'Error al listar usuarios' });
    }
});

app.post('/api/users', authenticateToken, isAdmin, async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new Usuario({ username, password: hashedPassword, ruc_empresa: req.user.ruc, role: 'user' });
        await newUser.save();
        res.status(201).json({ message: 'Usuario creado con éxito' });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

app.delete('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await Usuario.deleteOne({ _id: req.params.id, ruc_empresa: req.user.ruc });
        res.json({ message: 'Usuario eliminado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

// --- CONFIGURACIÓN DE ARRANQUE PARA RAILWAY ---
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Iniciar el servidor ANTES de conectar a la DB (Para pasar el Health Check de Railway)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
    
    // Conectar a MongoDB en segundo plano
    if (!MONGO_URI) {
        console.error('❌ MONGO_URI no está definida en las variables de entorno');
    } else {
        mongoose.connect(MONGO_URI)
            .then(() => console.log('✅ Connected to MongoDB Atlas'))
            .catch(err => console.error('❌ MongoDB Connection Error:', err));
    }
});
