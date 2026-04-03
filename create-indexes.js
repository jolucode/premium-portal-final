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

async function createIndexes() {
    // Forzar MongoDB local
    const MONGO_URI = 'mongodb://127.0.0.1:27017/premium_portal';

    try {
        console.log('📡 Conectando a MongoDB...\n');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado a MongoDB\n');

        const collection = mongoose.connection.collection('documentos');

        // Índices compuestos optimizados para las consultas del portal
        console.log('🔧 Creando índices optimizados...\n');

        // Índice 1: RUC emisor + fecha (para ordenamiento por fecha)
        console.log('1️⃣  Índice: ruc_emisor + fecha (-1)');
        await collection.createIndex({ ruc_emisor: 1, fecha: -1 });
        console.log('   ✅ Creado\n');

        // Índice 2: RUC receptor + fecha (para documentos recibidos)
        console.log('2️⃣  Índice: ruc_receptor + fecha (-1)');
        await collection.createIndex({ ruc_receptor: 1, fecha: -1 });
        console.log('   ✅ Creado\n');

        // Índice 3: RUC emisor + tipo + fecha (para filtro por tipo)
        console.log('3️⃣  Índice: ruc_emisor + tipo + fecha (-1)');
        await collection.createIndex({ ruc_emisor: 1, tipo: 1, fecha: -1 });
        console.log('   ✅ Creado\n');

        // Índice 4: RUC emisor + estado + fecha (para filtro por estado)
        console.log('4️⃣  Índice: ruc_emisor + estado + fecha (-1)');
        await collection.createIndex({ ruc_emisor: 1, estado: 1, fecha: -1 });
        console.log('   ✅ Creado\n');

        // Índice 5: RUC emisor + tipo + estado + fecha (para filtros combinados)
        console.log('5️⃣  Índice: ruc_emisor + tipo + estado + fecha (-1)');
        await collection.createIndex({ ruc_emisor: 1, tipo: 1, estado: 1, fecha: -1 });
        console.log('   ✅ Creado\n');

        // Índice 6: serie + numero (índice de texto combinado - solo 1 por colección)
        console.log('6️⃣  Índice: serie + numero (texto combinado)');
        try {
            await collection.createIndex({ serie: 'text', numero: 'text' });
            console.log('   ✅ Creado\n');
        } catch (e) {
            console.log('   ⚠️  Ya existe un índice de texto\n');
        }

        // Índice 7: ruc_emisor + serie + numero (para búsquedas combinadas)
        console.log('7️⃣  Índice: ruc_emisor + serie + numero');
        await collection.createIndex({ ruc_emisor: 1, serie: 1, numero: 1 });
        console.log('   ✅ Creado\n');

        console.log('✅ ¡Todos los índices fueron creados!\n');

        // Listar todos los índices
        console.log('📑 ÍNDICES TOTALES EN LA COLECCIÓN:');
        const indexes = await collection.listIndexes().toArray();
        indexes.forEach((idx, i) => {
            console.log(`   ${i + 1}. ${idx.name}: ${JSON.stringify(idx.key)}`);
        });

        // Mostrar estadísticas de la colección
        console.log('\n📊 ESTADÍSTICAS DE LA COLECCIÓN:');
        const stats = await collection.stats();
        console.log(`   - Documentos: ${stats.count}`);
        console.log(`   - Tamaño: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   - Tamaño total con índices: ${(stats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   - Número de índices: ${stats.nindexes}`);

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Conexión cerrada');
    }
}

createIndexes();
