const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const ExcelJS = require('exceljs');
require('dotenv').config();
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// Servir archivos estáticos DESPUÉS de definir las rutas API (opcional, pero más limpio)
app.use(express.static('public'));

// Modelos de MongoDB
const EmpresaSchema = new mongoose.Schema({ ruc: String, razon_social: String, logo: String });
const UsuarioSchema = new mongoose.Schema({ username: String, password: { type: String, required: true }, ruc_empresa: String, role: { type: String, default: 'user' } });
const DocumentoSchema = new mongoose.Schema({ tipo: String, serie: String, numero: String, fecha: Date, monto: Number, moneda: String, ruc_emisor: String, ruc_receptor: String, estado: String, pdf_path: String, xml_path: String, cdr_path: String });

const Empresa = mongoose.model('Empresa', EmpresaSchema);
const Usuario = mongoose.model('Usuario', UsuarioSchema);
const Documento = mongoose.model('Documento', DocumentoSchema);

// --- RUTAS DE NAVEGACIÓN ---

// Ruta raíz corregida
app.get('/', (req, res) => {
    console.log("Acceso a la raíz '/' detectado");
    // Intentamos redirigir al login
    res.redirect('/login.html');
});

// Ruta de diagnóstico (para probar si el servidor responde)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: '🚀 API premium-portal funcionando correctamente' });
});

// --- RUTAS DE API ---

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
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso restringido' });
    next();
};

// Count aproximado: trae docs con limit y cuenta (no escanea todo)
async function getApproxCount(Model, filter, maxCount = 10000) {
    const docs = await Model.find(filter, { _id: 1 }).limit(maxCount + 1);
    return docs.length > maxCount ? maxCount : docs.length;
}

// Login Route
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        if (username === password) {
            const emp = await Empresa.findOne({ ruc: username });
            if (emp) {
                const token = jwt.sign({ id: 'admin', username: 'Administrador', ruc: emp.ruc, empresa: emp.razon_social, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
                return res.json({ token, user: { username: 'Administrador', ruc: emp.ruc, empresa: emp.razon_social, logo: emp.logo, role: 'admin' } });
            }
        }
        const user = await Usuario.findOne({ username });
        if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Contraseña incorrecta' });
        const emp = await Empresa.findOne({ ruc: user.ruc_empresa });
        const token = jwt.sign({ id: user._id, username: user.username, ruc: user.ruc_empresa, empresa: emp ? emp.razon_social : 'Empresa', role: user.role || 'user' }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, user: { username: user.username, ruc: user.ruc_empresa, empresa: emp ? emp.razon_social : 'Empresa', logo: emp ? emp.logo : null, role: user.role || 'user' } });
    } catch (err) {
        res.status(500).json({ error: 'Error interno' });
    }
});

// Documents Route
app.get('/api/documents', authenticateToken, async (req, res) => {
    const ruc = req.user.ruc;
    const { tipo, search, estado, fechaDesde, fechaHasta, page = 1, limit = 50 } = req.query;
    try {
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Función para construir filtro base
        function buildFilter(target) {
            const filter = target === 'emisor' ? { ruc_emisor: ruc } : { ruc_receptor: ruc };
            if (tipo) filter.tipo = tipo;
            if (estado) filter.estado = estado;
            if (fechaDesde || fechaHasta) {
                filter.fecha = {};
                if (fechaDesde) filter.fecha.$gte = new Date(fechaDesde + 'T00:00:00.000Z');
                if (fechaHasta) filter.fecha.$lte = new Date(fechaHasta + 'T23:59:59.999Z');
            }
            return filter;
        }

        // Agregar filtros de búsqueda
        function addSearchFilter(filter) {
            if (!search) return filter;
            const parts = search.split('-');
            if (parts.length === 2) {
                filter.serie = { $regex: '^' + parts[0].replace(/[^a-zA-Z0-9]/g, '') };
                filter.numero = { $regex: '^' + parts[1].replace(/[^0-9]/g, '') };
            } else {
                const cleanSearch = search.replace(/[^a-zA-Z0-9]/g, '');
                filter.$or = [
                    { serie: { $regex: '^' + cleanSearch } },
                    { numero: { $regex: '^' + cleanSearch } }
                ];
            }
            return filter;
        }

        // Proyección para reducir datos transferidos
        const projection = {
            tipo: 1, serie: 1, numero: 1, fecha: 1, monto: 1,
            moneda: 1, estado: 1, ruc_emisor: 1, ruc_receptor: 1,
            pdf_path: 1, xml_path: 1, cdr_path: 1
        };

        // Construir filtros separados
        const filterEmisor = addSearchFilter(buildFilter('emisor'));
        const filterReceptor = addSearchFilter(buildFilter('receptor'));

        // Optimización de count: estrategia según tipo de consulta
        let total;
        const hasFilters = tipo || estado || fechaDesde || fechaHasta || search;
        const hasSearch = !!search;

        if (!hasFilters) {
            // Sin filtros: metadata instantánea
            total = await Documento.estimatedDocumentCount();
        } else if (hasSearch) {
            // Con búsqueda de texto: count exacto (pocos resultados)
            const [totalEmisor, totalReceptor] = await Promise.all([
                Documento.countDocuments(filterEmisor),
                Documento.countDocuments(filterReceptor)
            ]);
            total = totalEmisor + totalReceptor;
        } else {
            // Con filtros normales (tipo/estado/fecha): count aproximado
            // Para evitar escanear millones de documentos
            const [totalEmisor, totalReceptor] = await Promise.all([
                getApproxCount(Documento, filterEmisor),
                getApproxCount(Documento, filterReceptor)
            ]);
            total = totalEmisor + totalReceptor;
        }

        // Documentos en paralelo
        // Limitar skip máximo para evitar escaneo excesivo
        const maxSkip = 10000;
        const effectiveSkip = Math.min(skip, maxSkip);
        
        const [docsEmisor, docsReceptor] = await Promise.all([
            Documento.find(filterEmisor, projection).sort({ fecha: -1 }).skip(effectiveSkip).limit(limitNum),
            Documento.find(filterReceptor, projection).sort({ fecha: -1 }).skip(effectiveSkip).limit(limitNum)
        ]);

        // Combinar y limitar al límite solicitado
        const allDocs = [...docsEmisor, ...docsReceptor].slice(0, limitNum);

        const maxPaginas = Math.ceil(maxSkip / limitNum);
        
        res.json({
            documentos: allDocs,
            paginacion: {
                pagina: pageNum,
                limite: limitNum,
                total: total,
                totalPaginas: Math.ceil(total / limitNum),
                tieneAnterior: pageNum > 1,
                tieneSiguiente: pageNum < Math.ceil(total / limitNum),
                aproximado: hasFilters && !hasSearch,
                skipLimitado: skip > maxSkip,
                maxPaginas: maxPaginas
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al consultar' });
    }
});

// Exportar Excel Route
app.get('/api/documents/export', authenticateToken, async (req, res) => {
    const ruc = req.user.ruc;
    const { tipo, search, estado, fechaDesde, fechaHasta } = req.query;

    // Límite máximo de exportación para evitar sobrecarga
    const MAX_EXPORT = 10000;

    try {
        let filter = { $or: [{ ruc_emisor: ruc }, { ruc_receptor: ruc }] };
        if (tipo) filter.tipo = tipo;
        if (estado) filter.estado = estado;

        // Filtro de fechas
        if (fechaDesde || fechaHasta) {
            filter.fecha = {};
            if (fechaDesde) filter.fecha.$gte = new Date(fechaDesde + 'T00:00:00.000Z');
            if (fechaHasta) filter.fecha.$lte = new Date(fechaHasta + 'T23:59:59.999Z');
        }

        // Búsqueda optimizada (sin $options:'i')
        if (search) {
            const parts = search.split('-');
            if (parts.length === 2) {
                filter.serie = { $regex: '^' + parts[0].replace(/[^a-zA-Z0-9]/g, '') };
                filter.numero = { $regex: '^' + parts[1].replace(/[^0-9]/g, '') };
            } else {
                const cleanSearch = search.replace(/[^a-zA-Z0-9]/g, '');
                delete filter.$or;
                filter.$and = [
                    { $or: [{ ruc_emisor: ruc }, { ruc_receptor: ruc }] },
                    { $or: [
                        { serie: { $regex: '^' + cleanSearch } },
                        { numero: { $regex: '^' + cleanSearch } }
                    ]}
                ];
            }
        }

        // Contar total para verificar límite
        const total = await Documento.countDocuments(filter);

        if (total > MAX_EXPORT) {
            return res.status(400).json({
                error: `Demasiados documentos para exportar (${total.toLocaleString()}). Por favor aplica más filtros (fecha, tipo, estado) para reducir a máximo ${MAX_EXPORT.toLocaleString()} documentos.`
            });
        }

        // Obtener TODOS los documentos (sin paginación) con proyección
        const docs = await Documento.find(filter, {
            tipo: 1, serie: 1, numero: 1, fecha: 1, monto: 1,
            moneda: 1, estado: 1, ruc_emisor: 1, ruc_receptor: 1
        }).sort({ fecha: -1 }).limit(MAX_EXPORT);

        // Crear libro de Excel
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Premium Portal';
        workbook.created = new Date();
        workbook.subject = `Exportación de ${docs.length} documentos`;

        const worksheet = workbook.addWorksheet('Documentos');

        // Configurar columnas
        worksheet.columns = [
            { header: 'Tipo', key: 'tipo', width: 12 },
            { header: 'Serie', key: 'serie', width: 10 },
            { header: 'Número', key: 'numero', width: 12 },
            { header: 'Fecha Emisión', key: 'fecha', width: 15 },
            { header: 'RUC Emisor', key: 'ruc_emisor', width: 15 },
            { header: 'RUC Receptor', key: 'ruc_receptor', width: 15 },
            { header: 'Estado', key: 'estado', width: 12 },
            { header: 'Moneda', key: 'moneda', width: 10 },
            { header: 'Monto', key: 'monto', width: 15, numFmt: '#,##0.00' }
        ];

        // Estilos de encabezado
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0EA5E9' }
        };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Agregar datos
        const tipoMap = { '01': 'Factura', '03': 'Boleta', '07': 'Nota Crédito', '08': 'Nota Débito' };
        
        docs.forEach(doc => {
            worksheet.addRow({
                tipo: `${tipoMap[doc.tipo] || 'Documento'} (${doc.tipo})`,
                serie: doc.serie,
                numero: doc.numero,
                fecha: new Date(doc.fecha).toLocaleDateString('es-PE'),
                ruc_emisor: doc.ruc_emisor,
                ruc_receptor: doc.ruc_receptor,
                estado: doc.estado,
                moneda: doc.moneda,
                monto: doc.monto
            });
        });

        // Auto-filter en encabezado
        worksheet.autoFilter = 'A1:I1';

        // Generar buffer y enviar
        const buffer = await workbook.xlsx.writeBuffer();

        const fecha = new Date().toISOString().split('T')[0];
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="documentos_${fecha}.xlsx"`);
        
        res.send(buffer);
    } catch (err) {
        console.error('Error exportando Excel:', err);
        res.status(500).json({ error: 'Error al exportar' });
    }
});

// User Routes
app.get('/api/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const users = await Usuario.find({ ruc_empresa: req.user.ruc }, 'username ruc_empresa');
        res.json(users.map(u => ({ id: u._id, username: u.username, ruc_empresa: u.ruc_empresa })));
    } catch (err) {
        res.status(500).json({ error: 'Error al listar' });
    }
});

app.post('/api/users', authenticateToken, isAdmin, async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await new Usuario({ username, password: hashedPassword, ruc_empresa: req.user.ruc, role: 'user' }).save();
        res.status(201).json({ message: 'OK' });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear' });
    }
});

app.put('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
    const { username, password } = req.body;
    try {
        const updateData = { username };
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }
        await Usuario.updateOne({ _id: req.params.id, ruc_empresa: req.user.ruc }, { $set: updateData });
        res.json({ message: 'OK' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

app.delete('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await Usuario.deleteOne({ _id: req.params.id, ruc_empresa: req.user.ruc });
        res.json({ message: 'OK' });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar' });
    }
});

// --- CONFIGURACIÓN DE ARRANQUE ---
const PORT = process.env.PORT || 3000;

// FORZAR MONGO LOCAL PARA PRUEBAS DE PERFORMANCE
const MONGO_URI = 'mongodb://127.0.0.1:27017/premium_portal';

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
    console.log(`📡 Conectando a: ${MONGO_URI}`);
    if (MONGO_URI) {
        mongoose.connect(MONGO_URI)
            .then(() => console.log('✅ Conectado a Atlas'))
            .catch(err => console.error('❌ Error Atlas:', err));
    }
});
