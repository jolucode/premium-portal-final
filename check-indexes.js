const mongoose = require('mongoose');

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

async function checkIndexes() {
    await mongoose.connect('mongodb://127.0.0.1:27017/premium_portal');
    
    const db = mongoose.connection.db;
    const collection = db.collection('documentos');
    const indexes = await collection.indexes();
    
    console.log('\n📑 ÍNDICES ACTUALES:');
    indexes.forEach(idx => {
        console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    // Explicar la consulta lenta
    console.log('\n🔍 EXPLAIN consulta SERIE (regex):');
    const explainSerie = await collection.find({
        ruc_emisor: '20510910517',
        serie: { $regex: '^F001', $options: 'i' }
    }).sort({ fecha: -1 }).limit(100).explain('executionStats');
    
    console.log(`   Stage: ${explainSerie.queryPlanner.winningPlan.inputStage?.stage || 'N/A'}`);
    console.log(`   Index: ${explainSerie.queryPlanner.winningPlan.inputStage?.indexName || 'COLLSCAN (sin índice)'}`);
    console.log(`   Docs examinados: ${explainSerie.executionStats.totalDocsExamined}`);
    console.log(`   Docs retornados: ${explainSerie.executionStats.nReturned}`);
    console.log(`   Tiempo: ${explainSerie.executionStats.executionTimeMillis}ms`);
    
    console.log('\n🔍 EXPLAIN consulta NÚMERO (regex):');
    const explainNumero = await collection.find({
        ruc_emisor: '20510910517',
        numero: { $regex: '^0001', $options: 'i' }
    }).sort({ fecha: -1 }).limit(100).explain('executionStats');
    
    console.log(`   Stage: ${explainNumero.queryPlanner.winningPlan.inputStage?.stage || 'N/A'}`);
    console.log(`   Index: ${explainNumero.queryPlanner.winningPlan.inputStage?.indexName || 'COLLSCAN (sin índice)'}`);
    console.log(`   Docs examinados: ${explainNumero.executionStats.totalDocsExamined}`);
    console.log(`   Docs retornados: ${explainNumero.executionStats.nReturned}`);
    console.log(`   Tiempo: ${explainNumero.executionStats.executionTimeMillis}ms`);
    
    await mongoose.connection.close();
}

checkIndexes().catch(console.error);
