const mongoose = require('mongoose');

async function testCountFinal() {
    await mongoose.connect('mongodb://127.0.0.1:27017/premium_portal');
    const col = mongoose.connection.db.collection('documentos');
    const RUC = '20510910517';
    
    console.log('\n=== COUNTS OPTIMIZADOS ===\n');
    
    // 1. Sin filtros: usar stats de colección (instantáneo)
    const dbStats = await mongoose.connection.db.stats();
    const totalDocs = dbStats.objects || await col.estimatedDocumentCount();
    console.log(`db.stats objects: ${totalDocs.toLocaleString()} (instantáneo)`);
    
    // 2. estimatedDocumentCount (usa metadata, instantáneo)
    let t0 = Date.now();
    const est = await col.estimatedDocumentCount();
    console.log(`${Date.now()-t0}ms | estimatedDocumentCount: ${est.toLocaleString()}`);
    
    // 3. countDocuments separado por emisor (con índice)
    t0 = Date.now();
    const ce = await col.countDocuments({ ruc_emisor: RUC });
    console.log(`${Date.now()-t0}ms | count emisor: ${ce.toLocaleString()}`);
    
    // 4. countDocuments separado por receptor (con índice)
    t0 = Date.now();
    const cr = await col.countDocuments({ ruc_receptor: RUC });
    console.log(`${Date.now()-t0}ms | count receptor: ${cr.toLocaleString()}`);
    
    // 5. Con filtro tipo (emisor)
    t0 = Date.now();
    const ct = await col.countDocuments({ ruc_emisor: RUC, tipo: '01' });
    console.log(`${Date.now()-t0}ms | count emisor+tipo: ${ct.toLocaleString()}`);
    
    // 6. Con filtro estado (emisor)
    t0 = Date.now();
    const cs = await col.countDocuments({ ruc_emisor: RUC, estado: 'Aceptado' });
    console.log(`${Date.now()-t0}ms | count emisor+estado: ${cs.toLocaleString()}`);
    
    // 7. Con regex serie (emisor)
    t0 = Date.now();
    const crx = await col.countDocuments({ ruc_emisor: RUC, serie: { $regex: '^F001' } });
    console.log(`${Date.now()-t0}ms | count emisor+serie regex: ${crx.toLocaleString()}`);
    
    // 8. Con regex numero (emisor)
    t0 = Date.now();
    const crn = await col.countDocuments({ ruc_emisor: RUC, numero: { $regex: '^0001' } });
    console.log(`${Date.now()-t0}ms | count emisor+numero regex: ${crn.toLocaleString()}`);
    
    // 9. Explain del count lento
    console.log('\n🔍 Explain count emisor:');
    const exp = await col.find({ ruc_emisor: RUC }).project({ _id: 1 }).explain('executionStats');
    console.log(`   Index: ${exp.queryPlanner.winningPlan.inputStage?.indexName || exp.queryPlanner.winningPlan.stage}`);
    console.log(`   Docs examinados: ${exp.executionStats.totalDocsExamined}`);
    console.log(`   Tiempo: ${exp.executionStats.executionTimeMillis}ms`);
    
    await mongoose.connection.close();
}

testCountFinal().catch(console.error);
