const mongoose = require('mongoose');

async function test() {
    await mongoose.connect('mongodb://127.0.0.1:27017/premium_portal');
    const Documento = mongoose.model('Documento', new mongoose.Schema({
        tipo: String, serie: String, numero: String, fecha: Date, monto: Number,
        moneda: String, ruc_emisor: String, ruc_receptor: String, estado: String
    }));
    
    const RUC = '20510910517';
    
    async function getApproxCount(Model, filter, maxCount = 10000) {
        const docs = await Model.find(filter, { _id: 1 }).limit(maxCount + 1);
        return docs.length > maxCount ? maxCount : docs.length;
    }
    
    console.log('\n=== COUNT APROXIMADO vs REAL ===\n');
    
    // Test 1: count con tipo
    console.log('📋 Filtro: tipo=01');
    let t0 = Date.now();
    const approx1 = await getApproxCount(Documento, { ruc_emisor: RUC, tipo: '01' });
    console.log(`   Aproximado: ${approx1.toLocaleString()} en ${Date.now()-t0}ms`);
    
    t0 = Date.now();
    const real1 = await Documento.countDocuments({ ruc_emisor: RUC, tipo: '01' });
    console.log(`   Real:       ${real1.toLocaleString()} en ${Date.now()-t0}ms`);
    
    // Test 2: count con estado
    console.log('\n📋 Filtro: estado=Aceptado');
    t0 = Date.now();
    const approx2 = await getApproxCount(Documento, { ruc_emisor: RUC, estado: 'Aceptado' });
    console.log(`   Aproximado: ${approx2.toLocaleString()} en ${Date.now()-t0}ms`);
    
    t0 = Date.now();
    const real2 = await Documento.countDocuments({ ruc_emisor: RUC, estado: 'Aceptado' });
    console.log(`   Real:       ${real2.toLocaleString()} en ${Date.now()-t0}ms`);
    
    // Test 3: count con tipo+estado+fecha
    console.log('\n📋 Filtro: tipo+estado+fecha');
    t0 = Date.now();
    const approx3 = await getApproxCount(Documento, {
        ruc_emisor: RUC, tipo: '01', estado: 'Aceptado',
        fecha: { $gte: new Date('2025-06-01T00:00:00.000Z') }
    });
    console.log(`   Aproximado: ${approx3.toLocaleString()} en ${Date.now()-t0}ms`);
    
    t0 = Date.now();
    const real3 = await Documento.countDocuments({
        ruc_emisor: RUC, tipo: '01', estado: 'Aceptado',
        fecha: { $gte: new Date('2025-06-01T00:00:00.000Z') }
    });
    console.log(`   Real:       ${real3.toLocaleString()} en ${Date.now()-t0}ms`);
    
    // Test 4: count con search (pocos resultados)
    console.log('\n📋 Filtro: serie regex F001');
    t0 = Date.now();
    const approx4 = await getApproxCount(Documento, { ruc_emisor: RUC, serie: { $regex: '^F001' } });
    console.log(`   Aproximado: ${approx4.toLocaleString()} en ${Date.now()-t0}ms`);
    
    t0 = Date.now();
    const real4 = await Documento.countDocuments({ ruc_emisor: RUC, serie: { $regex: '^F001' } });
    console.log(`   Real:       ${real4.toLocaleString()} en ${Date.now()-t0}ms`);
    
    await mongoose.connection.close();
    console.log('\n✅ Listo\n');
}

test().catch(console.error);
