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
    estado: String
});

const Documento = mongoose.model('Documento', DocumentoSchema);

async function testPerformance() {
    // Forzar MongoDB local
    const MONGO_URI = 'mongodb://127.0.0.1:27017/premium_portal';

    try {
        console.log('📡 Conectando a MongoDB...\n');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado a MongoDB\n');

        const ruc = '20510910517';

        console.log('🚀 PRUEBAS DE RENDIMIENTO - BÚSQUEDA POR SERIE Y NÚMERO\n');

        // Test 1: Búsqueda con guión (serie-número)
        console.log('1️⃣  Búsqueda: "FC211-39032310" (con guión)');
        let start = Date.now();
        let result = await Documento.find({
            $or: [{ ruc_emisor: ruc }, { ruc_receptor: ruc }],
            serie: { $regex: '^FC211', $options: 'i' },
            numero: { $regex: '^39032310', $options: 'i' }
        }).limit(50);
        let end = Date.now();
        console.log(`   ⏱️  Tiempo: ${end - start}ms`);
        console.log(`   📄 Resultados: ${result.length}\n`);

        // Test 2: Búsqueda solo por serie
        console.log('2️⃣  Búsqueda: "FC211" (solo serie)');
        start = Date.now();
        result = await Documento.find({
            $or: [{ ruc_emisor: ruc }, { ruc_receptor: ruc }],
            serie: { $regex: '^FC211', $options: 'i' }
        }).limit(50);
        end = Date.now();
        console.log(`   ⏱️  Tiempo: ${end - start}ms`);
        console.log(`   📄 Resultados: ${result.length}\n`);

        // Test 3: Búsqueda por número
        console.log('3️⃣  Búsqueda: "39032310" (solo número)');
        start = Date.now();
        result = await Documento.find({
            $or: [{ ruc_emisor: ruc }, { ruc_receptor: ruc }],
            numero: { $regex: '^39032310', $options: 'i' }
        }).limit(50);
        end = Date.now();
        console.log(`   ⏱️  Tiempo: ${end - start}ms`);
        console.log(`   📄 Resultados: ${result.length}\n`);

        // Test 4: Búsqueda parcial (sin anclar)
        console.log('4️⃣  Búsqueda: "FC21" (parcial - sin anclar)');
        start = Date.now();
        result = await Documento.find({
            $or: [{ ruc_emisor: ruc }, { ruc_receptor: ruc }],
            serie: { $regex: 'FC21', $options: 'i' }
        }).limit(50);
        end = Date.now();
        console.log(`   ⏱️  Tiempo: ${end - start}ms`);
        console.log(`   📄 Resultados: ${result.length}\n`);

        // Test 5: Búsqueda con filtros combinados
        console.log('5️⃣  Búsqueda: Serie "FC" + Tipo "07" + Estado "Aceptado"');
        start = Date.now();
        result = await Documento.find({
            $or: [{ ruc_emisor: ruc }, { ruc_receptor: ruc }],
            serie: { $regex: '^FC', $options: 'i' },
            tipo: '07',
            estado: 'Aceptado'
        }).limit(50);
        end = Date.now();
        console.log(`   ⏱️  Tiempo: ${end - start}ms`);
        console.log(`   📄 Resultados: ${result.length}\n`);

        // Explicación de explain
        console.log('📊 EXPLAIN - Análisis de consulta (serie + número):');
        const explainResult = await Documento.find({
            $or: [{ ruc_emisor: ruc }, { ruc_receptor: ruc }],
            serie: { $regex: '^FC211', $options: 'i' },
            numero: { $regex: '^39032310', $options: 'i' }
        }).explain('executionStats');
        
        console.log(`   - Etapa de victoria: ${explainResult.queryPlanner.winningPlan.inputStage?.indexName || 'COLLSCAN (sin índice)'}`);
        console.log(`   - Documentos examinados: ${explainResult.executionStats.totalDocsExamined}`);
        console.log(`   - Documentos retornados: ${explainResult.executionStats.nReturned}`);
        console.log(`   - Tiempo ejecución: ${explainResult.executionStats.executionTimeMillis}ms`);

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Conexión cerrada');
    }
}

testPerformance();
