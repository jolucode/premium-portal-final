const mongoose = require('mongoose');
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

async function contarDocumentos() {
    const MONGO_URI = process.env.MONGO_URI;

    try {
        console.log('📡 Conectando a MongoDB...\n');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado a MongoDB\n');

        // Total general
        const total = await Documento.countDocuments();
        console.log(`📊 TOTAL DOCUMENTOS: ${total.toLocaleString()}\n`);

        // Por empresa emisora
        console.log('📈 POR EMPRESA EMISORA:');
        const porEmisor = await Documento.aggregate([
            { $group: { _id: '$ruc_emisor', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        porEmisor.forEach(e => {
            console.log(`   - ${e._id}: ${e.count.toLocaleString()} documentos`);
        });

        // Documentos donde el RUC es emisor O receptor (como ve un usuario)
        console.log('\n📈 LO QUE VERÍA CADA EMPRESA (emisor O receptor):');
        
        const ventura = await Documento.countDocuments({
            $or: [{ ruc_emisor: '20510910517' }, { ruc_receptor: '20510910517' }]
        });
        console.log(`   - VENTURA SOLUCIONES (20510910517): ${ventura.toLocaleString()} documentos`);
        
        const logistica = await Documento.countDocuments({
            $or: [{ ruc_emisor: '20601234567' }, { ruc_receptor: '20601234567' }]
        });
        console.log(`   - CORP LOGISTICA (20601234567): ${logistica.toLocaleString()} documentos`);

        // Documentos con otros RUCs (receptores aleatorios)
        const otros = await Documento.countDocuments({
            $and: [
                { ruc_emisor: { $ne: '20510910517', $ne: '20601234567' } },
                { ruc_receptor: { $ne: '20510910517', $ne: '20601234567' } }
            ]
        });
        console.log(`   - Otros (solo receptores aleatorios): ${otros.toLocaleString()} documentos`);

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Conexión cerrada');
    }
}

contarDocumentos();
