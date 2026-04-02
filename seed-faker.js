const mongoose = require('mongoose');
const { fakerES: faker } = require('@faker-js/faker');
require('dotenv').config();

// Definir esquemas
const EmpresaSchema = new mongoose.Schema({
    ruc: String,
    razon_social: String,
    logo: String
});

const UsuarioSchema = new mongoose.Schema({
    username: String,
    password: { type: String, required: true },
    ruc_empresa: String,
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

// Datos de prueba
const EMPRESAS = [
    { ruc: '20510910517', razon_social: 'VENTURA SOLUCIONES S.A.C.', logo: 'assets/logo.png' },
    { ruc: '20601234567', razon_social: 'CORPORACION LOGISTICA S.A.C.', logo: 'assets/logo_logistica.png' }
];

const TIPOS_DOCUMENTO = {
    '01': { nombre: 'Factura', serie: 'F' },
    '03': { nombre: 'Boleta', serie: 'B' },
    '07': { nombre: 'Nota de Crédito', serie: 'FC' },
    '08': { nombre: 'Nota de Débito', serie: 'FD' }
};

const ESTADOS = ['Aceptado', 'Aceptado', 'Aceptado', 'Rechazado', 'Pendiente']; // Más probabilidad de 'Aceptado'
const MONEDAS = ['PEN', 'PEN', 'PEN', 'USD']; // Más probabilidad de PEN

// Generar RUC aleatorio (empresa o persona)
function generarRUC(esEmpresa = true) {
    if (esEmpresa) {
        return '20' + faker.string.numeric(8);
    } else {
        return '10' + faker.string.numeric(8);
    }
}

// Generar documento falso
function generarDocumento() {
    const tipoDoc = faker.helpers.arrayElement(Object.keys(TIPOS_DOCUMENTO));
    const tipoInfo = TIPOS_DOCUMENTO[tipoDoc];
    const serie = `${tipoInfo.serie}${faker.string.numeric(3)}`;
    const numero = faker.string.numeric({ length: 8, allowLeadingZeros: true });
    
    const emisor = faker.helpers.arrayElement(EMPRESAS);
    const esReceptorEmpresa = faker.datatype.boolean({ prob: 0.7 });
    const receptor = generarRUC(esReceptorEmpresa);
    
    const estado = faker.helpers.arrayElement(ESTADOS);
    const moneda = faker.helpers.arrayElement(MONEDAS);
    
    // Monto entre 50 y 10000
    const monto = parseFloat((Math.random() * 9950 + 50).toFixed(2));
    
    // Fecha en los últimos 90 días
    const fecha = faker.date.recent({ days: 90 });
    
    const doc = {
        tipo: tipoDoc,
        serie: serie.toUpperCase(),
        numero: numero,
        fecha: fecha,
        monto: monto,
        moneda: moneda,
        ruc_emisor: emisor.ruc,
        ruc_receptor: receptor,
        estado: estado,
        pdf_path: Math.random() > 0.1 ? `/downloads/${serie}-${numero}.pdf` : null,
        xml_path: Math.random() > 0.05 ? `/downloads/${serie}-${numero}.xml` : null,
        cdr_path: Math.random() > 0.3 ? `/downloads/${serie}-${numero}.cdr` : null
    };
    
    // Solo algunos documentos tienen CDR
    if (Math.random() > 0.7) {
        doc.cdr_path = null;
    }
    
    return doc;
}

async function seedFaker() {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27014/premium_portal';
    const NUM_DOCUMENTOS = 1000000; // 1 Millón de documentos

    try {
        console.log('📡 Conectando a MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado a MongoDB');

        // Limpiar solo documentos (mantener empresas y usuarios)
        await Documento.deleteMany({});
        console.log('🗑️  Documentos anteriores eliminados');

        // Generar documentos en lotes grandes para eficiencia
        console.log(`📝 Generando ${NUM_DOCUMENTOS.toLocaleString()} documentos falsos...\n`);
        
        let totalInsertados = 0;
        const BATCH_SIZE = 5000; // Lotes de 5000 para mejor rendimiento
        
        for (let i = 0; i < NUM_DOCUMENTOS; i += BATCH_SIZE) {
            const documentos = [];
            const batchSize = Math.min(BATCH_SIZE, NUM_DOCUMENTOS - i);
            
            for (let j = 0; j < batchSize; j++) {
                documentos.push(generarDocumento());
            }
            
            await Documento.insertMany(documentos);
            totalInsertados += batchSize;
            
            // Progreso cada 50,000 documentos
            if (totalInsertados % 50000 === 0) {
                const porcentaje = ((totalInsertados / NUM_DOCUMENTOS) * 100).toFixed(2);
                console.log(`   📦 ${totalInsertados.toLocaleString()}/${NUM_DOCUMENTOS.toLocaleString()} (${porcentaje}%)`);
            }
        }

        // Contar total
        const total = await Documento.countDocuments();
        console.log(`\n✅ ¡Base de datos poblada con ${total.toLocaleString()} documentos!`);

        // Mostrar estadísticas
        console.log('\n📊 ESTADÍSTICAS:');
        
        const porTipo = await Documento.aggregate([
            { $group: { _id: '$tipo', count: { $sum: 1 } } }
        ]);
        console.log('   Por tipo:', porTipo.map(t => `${t._id}: ${t.count}`));
        
        const porEstado = await Documento.aggregate([
            { $group: { _id: '$estado', count: { $sum: 1 } } }
        ]);
        console.log('   Por estado:', porEstado.map(e => `${e._id}: ${e.count}`));
        
        const porMoneda = await Documento.aggregate([
            { $group: { _id: '$moneda', count: { $sum: 1 } } }
        ]);
        console.log('   Por moneda:', porMoneda.map(m => `${m._id}: ${m.count}`));

        const montoPromedio = await Documento.aggregate([
            { $group: { _id: null, avg: { $avg: '$monto' }, max: { $max: '$monto' }, min: { $min: '$monto' } } }
        ]);
        console.log(`   Montos: Min=${montoPromedio[0].min.toFixed(2)}, Max=${montoPromedio[0].max.toFixed(2)}, Prom=${montoPromedio[0].avg.toFixed(2)}`);

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Conexión cerrada');
    }
}

seedFaker();
