const mongoose = require('mongoose');

async function analyze() {
    await mongoose.connect('mongodb://127.0.0.1:27017/premium_portal');
    const col = mongoose.connection.db.collection('documentos');
    const RUC = '20510910517';
    
    console.log('\n=== ANÁLISIS DE QUERYS LENTOS ===\n');
    
    // 1. Explain count con tipo
    console.log('🔍 countDocuments({ ruc_emisor, tipo }):');
    const e1 = await col.find({ ruc_emisor: RUC, tipo: '01' }).project({ _id: 1 }).explain('executionStats');
    const s1 = e1.queryPlanner.winningPlan.inputStage || e1.queryPlanner.winningPlan;
    console.log(`   Index: ${s1.indexName || s1.stage}`);
    console.log(`   Docs examinados: ${e1.executionStats.totalDocsExamined}`);
    console.log(`   Docs retornados: ${e1.executionStats.nReturned}`);
    console.log(`   Tiempo: ${e1.executionStats.executionTimeMillis}ms`);
    
    // 2. Explain count con estado
    console.log('\n🔍 countDocuments({ ruc_emisor, estado }):');
    const e2 = await col.find({ ruc_emisor: RUC, estado: 'Aceptado' }).project({ _id: 1 }).explain('executionStats');
    const s2 = e2.queryPlanner.winningPlan.inputStage || e2.queryPlanner.winningPlan;
    console.log(`   Index: ${s2.indexName || s2.stage}`);
    console.log(`   Docs examinados: ${e2.executionStats.totalDocsExamined}`);
    console.log(`   Docs retornados: ${e2.executionStats.nReturned}`);
    console.log(`   Tiempo: ${e2.executionStats.executionTimeMillis}ms`);
    
    // 3. Explain count con tipo+estado+fecha
    console.log('\n🔍 countDocuments({ ruc_emisor, tipo, estado, fecha }):');
    const e3 = await col.find({
        ruc_emisor: RUC, tipo: '01', estado: 'Aceptado',
        fecha: { $gte: new Date('2025-06-01T00:00:00.000Z') }
    }).project({ _id: 1 }).explain('executionStats');
    const s3 = e3.queryPlanner.winningPlan.inputStage || e3.queryPlanner.winningPlan;
    console.log(`   Index: ${s3.indexName || s3.stage}`);
    console.log(`   Docs examinados: ${e3.executionStats.totalDocsExamined}`);
    console.log(`   Docs retornados: ${e3.executionStats.nReturned}`);
    console.log(`   Tiempo: ${e3.executionStats.executionTimeMillis}ms`);
    
    // 4. Explain con skip alto
    console.log('\n🔍 find con skip 49950:');
    const e4 = await col.find({ ruc_emisor: RUC }).sort({ fecha: -1 }).skip(49950).limit(50).project({ _id: 1 }).explain('executionStats');
    const s4 = e4.queryPlanner.winningPlan.inputStage || e4.queryPlanner.winningPlan;
    console.log(`   Index: ${s4.indexName || s4.stage}`);
    console.log(`   Docs examinados: ${e4.executionStats.totalDocsExamined}`);
    console.log(`   Docs retornados: ${e4.executionStats.nReturned}`);
    console.log(`   Tiempo: ${e4.executionStats.executionTimeMillis}ms`);
    
    // 5. Índices actuales
    console.log('\n📑 Índices actuales:');
    const indexes = await col.indexes();
    indexes.forEach(idx => {
        console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    await mongoose.connection.close();
}

analyze().catch(console.error);
