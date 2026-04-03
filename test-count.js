const mongoose = require('mongoose');

async function testCount() {
    await mongoose.connect('mongodb://127.0.0.1:27017/premium_portal');
    const collection = mongoose.connection.db.collection('documentos');
    const RUC = '20510910517';
    
    console.log('\n=== TEST countDocuments ===\n');
    
    // Opción 1: countDocuments con $or (lento)
    let t0 = Date.now();
    const c1 = await collection.countDocuments({ $or: [{ ruc_emisor: RUC }, { ruc_receptor: RUC }] });
    console.log(`${Date.now()-t0}ms | countDocuments con $or: ${c1.toLocaleString()}`);
    
    // Opción 2: 2 countDocuments separados + sumar (rápido con índices)
    t0 = Date.now();
    const [c2a, c2b] = await Promise.all([
        collection.countDocuments({ ruc_emisor: RUC }),
        collection.countDocuments({ ruc_receptor: RUC })
    ]);
    console.log(`${Date.now()-t0}ms | 2 countDocuments separados: ${(c2a+c2b).toLocaleString()}`);
    
    // Opción 3: estimatedDocumentCount (instantáneo pero sin filtros)
    t0 = Date.now();
    const c3 = await collection.estimatedDocumentCount();
    console.log(`${Date.now()-t0}ms | estimatedDocumentCount total: ${c3.toLocaleString()}`);
    
    // Opción 4: countDocuments con filtros + $or
    t0 = Date.now();
    const c4 = await collection.countDocuments({
        $and: [
            { $or: [{ ruc_emisor: RUC }, { ruc_receptor: RUC }] },
            { serie: { $regex: '^F001' } }
        ]
    });
    console.log(`${Date.now()-t0}ms | countDocuments con $or + regex: ${c4.toLocaleString()}`);
    
    // Opción 5: 2 countDocuments separados con regex + sumar
    t0 = Date.now();
    const [c5a, c5b] = await Promise.all([
        collection.countDocuments({ ruc_emisor: RUC, serie: { $regex: '^F001' } }),
        collection.countDocuments({ ruc_receptor: RUC, serie: { $regex: '^F001' } })
    ]);
    console.log(`${Date.now()-t0}ms | 2 countDocuments con regex: ${(c5a+c5b).toLocaleString()}`);
    
    await mongoose.connection.close();
}

testCount().catch(console.error);
