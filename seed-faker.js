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
function generarDocumento(rucFijo = null) {
    const tipoDoc = faker.helpers.arrayElement(Object.keys(TIPOS_DOCUMENTO));
    const tipoInfo = TIPOS_DOCUMENTO[tipoDoc];
    const serie = `${tipoInfo.serie}${faker.string.numeric(3)}`;
    const numero = faker.string.numeric({ length: 8, allowLeadingZeros: true });

    // Si hay RUC fijo, usarlo como emisor
    const emisor = rucFijo ? { ruc: rucFijo } : faker.helpers.arrayElement(EMPRESAS);
    const receptor = generarRUC(false); // Receptor siempre aleatorio

    const estado = faker.helpers.arrayElement(ESTADOS);
    const moneda = faker.helpers.arrayElement(MONEDAS);

    // Monto entre 50 y 10000
    const monto = parseFloat((Math.random() * 9950 + 50).toFixed(2));

    // Fecha en los últimos 365 días (1 año)
    const fecha = faker.date.recent({ days: 365 });

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
        pdf_path: Math.random() > 0.1 ? `/downloads/${emisor.ruc}-${tipoDoc}-${serie.toUpperCase()}-${numero}.pdf` : null,
        xml_path: Math.random() > 0.05 ? `/downloads/${emisor.ruc}-${tipoDoc}-${serie.toUpperCase()}-${numero}.xml` : null,
        cdr_path: Math.random() > 0.3 ? `/downloads/${emisor.ruc}-${tipoDoc}-${serie.toUpperCase()}-${numero}.zip` : null
    };

    // Solo algunos documentos tienen CDR
    if (Math.random() > 0.7) {
        doc.cdr_path = null;
    }

    return doc;
}

async function seedFaker() {
    // Forzar MongoDB local
    const MONGO_URI = 'mongodb://127.0.0.1:27017/premium_portal';
    const NUM_DOCUMENTOS = 10000000; // 10 Millones de documentos
    const RUC_UNICO = '20510910517'; // Un solo RUC para pruebas de estrés

    try {
        console.log('📡 Conectando a MongoDB Local...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado a MongoDB Local');

        // Limpiar solo documentos (mantener empresas y usuarios)
        await Documento.deleteMany({});
        console.log('🗑️  Documentos anteriores eliminados');

        // Generar documentos en lotes grandes para eficiencia
        console.log(`📝 Generando ${NUM_DOCUMENTOS.toLocaleString()} documentos para RUC: ${RUC_UNICO}\n`);
        
        let totalInsertados = 0;
        const BATCH_SIZE = 50000; // Lotes de 50,000 para máximo rendimiento
        const inicioTiempo = Date.now();
        
        for (let i = 0; i < NUM_DOCUMENTOS; i += BATCH_SIZE) {
            const documentos = [];
            const batchSize = Math.min(BATCH_SIZE, NUM_DOCUMENTOS - i);
            
            for (let j = 0; j < batchSize; j++) {
                documentos.push(generarDocumento(RUC_UNICO));
            }
            
            await Documento.insertMany(documentos);
            totalInsertados += batchSize;
            
            // Progreso cada 500,000 documentos
            if (totalInsertados % 500000 === 0) {
                const porcentaje = ((totalInsertados / NUM_DOCUMENTOS) * 100).toFixed(2);
                const tiempoTranscurrido = ((Date.now() - inicioTiempo) / 1000).toFixed(1);
                const velocidad = Math.round(totalInsertados / ((Date.now() - inicioTiempo) / 1000));
                const tiempoRestante = ((NUM_DOCUMENTOS - totalInsertados) / velocidad).toFixed(0);
                console.log(`   📦 ${totalInsertados.toLocaleString()}/${NUM_DOCUMENTOS.toLocaleString()} (${porcentaje}%) | ${velocidad.toLocaleString()} docs/s | ~${tiempoRestante}s restantes`);
            }
        }

        const tiempoTotal = ((Date.now() - inicioTiempo) / 1000).toFixed(1);
        const velocidadFinal = Math.round(NUM_DOCUMENTOS / (tiempoTotal));

        // Contar total
        const total = await Documento.countDocuments();
        console.log(`\n✅ ¡Base de datos poblada con ${total.toLocaleString()} documentos!`);
        console.log(`⏱️  Tiempo total: ${tiempoTotal}s (${(tiempoTotal/60).toFixed(1)} minutos)`);
        console.log(`🚀 Velocidad promedio: ${velocidadFinal.toLocaleString()} documentos/segundo`);

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
