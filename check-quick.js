const mongoose = require('mongoose');

async function checkAndFix() {
    await mongoose.connect('mongodb://127.0.0.1:27017/premium_portal');
    const db = mongoose.connection.db;
    const collection = db.collection('documentos');
    
    // Ver índices actuales
    const indexes = await collection.indexes();
    console.log('\n📑 ÍNDICES ACTUALES:', indexes.length);
    indexes.forEach(idx => {
        console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    const RUC = '20510910517';
    
    // Prueba rápida con explain
    console.log('\n🔍 Prueba SERIE regex:');
    const explain1 = await collection.find({ ruc_emisor: RUC, serie: { $regex: '^F001', $options: 'i' } }).sort({ fecha: -1 }).limit(50).explain('executionStats');
    console.log(`   Stage: ${explain1.queryPlanner.winningPlan.inputStage?.stage || explain1.queryPlanner.winningPlan.stage}`);
    console.log(`   Docs examinados: ${explain1.executionStats.totalDocsExamined}`);
    console.log(`   Tiempo: ${explain1.executionStats.executionTimeMillis}ms`);
    
    console.log('\n🔍 Prueba NÚMERO regex:');
    const explain2 = await collection.find({ ruc_emisor: RUC, numero: { $regex: '^0001', $options: 'i' } }).sort({ fecha: -1 }).limit(50).explain('executionStats');
    console.log(`   Stage: ${explain2.queryPlanner.winningPlan.inputStage?.stage || explain2.queryPlanner.winningPlan.stage}`);
    console.log(`   Docs examinados: ${explain2.executionStats.totalDocsExamined}`);
    console.log(`   Tiempo: ${explain2.executionStats.executionTimeMillis}ms`);
    
    await mongoose.connection.close();
}

checkAndFix().catch(console.error);
