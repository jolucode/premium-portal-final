const mongoose = require('mongoose');
const { fakerES: faker } = require('@faker-js/faker');
require('dotenv').config();

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

const Documento = mongoose.model('Documento', DocumentoSchema);

const TIPOS_DOCUMENTO = {
    '01': { nombre: 'Factura', serie: 'F' },
    '03': { nombre: 'Boleta', serie: 'B' },
    '07': { nombre: 'Nota de Crédito', serie: 'FC' },
    '08': { nombre: 'Nota de Débito', serie: 'FD' }
};

const ESTADOS = ['Aceptado', 'Aceptado', 'Aceptado', 'Rechazado', 'Pendiente'];
const MONEDAS = ['PEN', 'PEN', 'PEN', 'USD'];

function generarRUC() {
    return '10' + faker.string.numeric(8);
}

function generarDocumento(rucFijo) {
    const tipoDoc = faker.helpers.arrayElement(Object.keys(TIPOS_DOCUMENTO));
    const tipoInfo = TIPOS_DOCUMENTO[tipoDoc];
    const serie = `${tipoInfo.serie}${faker.string.numeric(3)}`;
    const numero = faker.string.numeric({ length: 8, allowLeadingZeros: true });

    const receptor = generarRUC();
    const estado = faker.helpers.arrayElement(ESTADOS);
    const moneda = faker.helpers.arrayElement(MONEDAS);
    const monto = parseFloat((Math.random() * 9950 + 50).toFixed(2));
    const fecha = faker.date.recent({ days: 365 });

    return {
        tipo: tipoDoc,
        serie: serie.toUpperCase(),
        numero: numero,
        fecha: fecha,
        monto: monto,
        moneda: moneda,
        ruc_emisor: rucFijo,
        ruc_receptor: receptor,
        estado: estado,
        pdf_path: Math.random() > 0.1 ? `/downloads/${serie}-${numero}.pdf` : null,
        xml_path: Math.random() > 0.05 ? `/downloads/${serie}-${numero}.xml` : null,
        cdr_path: Math.random() > 0.3 ? null : `/downloads/${serie}-${numero}.cdr`
    };
}

async function completar() {
    const MONGO_URI = 'mongodb://127.0.0.1:27017/premium_portal';
    const META_TOTAL = 10000000;
    const RUC_FIJO = '20510910517';

    try {
        console.log('📡 Conectando a MongoDB Local...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado a MongoDB Local');

        const actuales = await Documento.countDocuments();
        const faltantes = META_TOTAL - actuales;

        if (faltantes <= 0) {
            console.log(`✅ Ya tienes ${actuales.toLocaleString()} documentos. ¡Meta alcanzada!`);
            return;
        }

        console.log(`📊 Documentos actuales: ${actuales.toLocaleString()}`);
        console.log(`🎯 Documentos a agregar: ${faltantes.toLocaleString()}`);
        console.log(`🎯 Meta final: ${META_TOTAL.toLocaleString()}\n`);

        let totalInsertados = 0;
        const BATCH_SIZE = 50000;
        const inicioTiempo = Date.now();

        for (let i = 0; i < faltantes; i += BATCH_SIZE) {
            const documentos = [];
            const batchSize = Math.min(BATCH_SIZE, faltantes - i);

            for (let j = 0; j < batchSize; j++) {
                documentos.push(generarDocumento(RUC_FIJO));
            }

            await Documento.insertMany(documentos);
            totalInsertados += batchSize;

            if (totalInsertados % 500000 === 0 || totalInsertados === faltantes) {
                const porcentaje = ((totalInsertados / faltantes) * 100).toFixed(2);
                const tiempoTranscurrido = ((Date.now() - inicioTiempo) / 1000).toFixed(1);
                const velocidad = Math.round(totalInsertados / ((Date.now() - inicioTiempo) / 1000));
                const tiempoRestante = ((faltantes - totalInsertados) / velocidad).toFixed(0);
                const totalActual = (actuales + totalInsertados).toLocaleString();
                console.log(`   📦 ${totalInsertados.toLocaleString()}/${faltantes.toLocaleString()} (${porcentaje}%) | ${velocidad.toLocaleString()} docs/s | ~${tiempoRestante}s restantes | Total: ${totalActual}`);
            }
        }

        const tiempoTotal = ((Date.now() - inicioTiempo) / 1000).toFixed(1);
        const velocidadFinal = Math.round(totalInsertados / (tiempoTotal));
        const totalFinal = await Documento.countDocuments();

        console.log(`\n✅ ¡Completado! Total de documentos: ${totalFinal.toLocaleString()}`);
        console.log(`⏱️  Tiempo: ${tiempoTotal}s (${(tiempoTotal/60).toFixed(1)} minutos)`);
        console.log(`🚀 Velocidad promedio: ${velocidadFinal.toLocaleString()} docs/s`);

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Conexión cerrada');
    }
}

completar();
