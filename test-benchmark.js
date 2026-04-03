const mongoose = require('mongoose');

async function benchmark() {
    await mongoose.connect('mongodb://127.0.0.1:27017/premium_portal');
    const db = mongoose.connection.db;
    const collection = db.collection('documentos');
    const RUC = '20510910517';
    
    // Función para medir
    async function test(nombre, query, options = {}) {
        const start = Date.now();
        const result = await collection.find(query, options.projection || {}).sort(options.sort || { fecha: -1 }).skip(options.skip || 0).limit(options.limit || 50).toArray();
        const time = Date.now() - start;
        console.log(`${time.toString().padStart(5)}ms | ${nombre} | ${result.length} docs`);
        return time;
    }
    
    console.log('\n=== CONSULTA ACTUAL (2 queries separadas) ===\n');
    
    // Simula lo que hace server.js ahora
    const filterE = { ruc_emisor: RUC, serie: { $regex: '^F001', $options: 'i' } };
    const filterR = { ruc_receptor: RUC, serie: { $regex: '^F001', $options: 'i' } };
    
    let t0 = Date.now();
    await Promise.all([
        collection.find(filterE).sort({ fecha: -1 }).limit(50).toArray(),
        collection.find(filterR).sort({ fecha: -1 }).limit(50).toArray(),
        collection.countDocuments(filterE),
        collection.countDocuments(filterR)
    ]);
    console.log(`${Date.now()-t0}ms | ACTUAL: 2 queries separadas con regex serie\n`);
    
    console.log('=== CONSULTA OPTIMIZADA (1 query con $or) ===\n');
    
    // Opción 1: $or directo
    t0 = Date.now();
    const opt1 = await collection.find({
        $or: [
            { ruc_emisor: RUC, serie: { $regex: '^F001' } },
            { ruc_receptor: RUC, serie: { $regex: '^F001' } }
        ]
    }).sort({ fecha: -1 }).limit(50).toArray();
    console.log(`${Date.now()-t0}ms | OPT1: $or con regex (sin $options:'i')\n`);
    
    // Opción 2: Sin regex, con $in para serie exacta
    t0 = Date.now();
    const opt2 = await collection.find({
        $or: [
            { ruc_emisor: RUC },
            { ruc_receptor: RUC }
        ],
        serie: { $regex: '^F001' }
    }).sort({ fecha: -1 }).limit(50).toArray();
    console.log(`${Date.now()-t0}ms | OPT2: $or RUC + serie regex fuera\n`);
    
    // Opción 3: Solo emisor (caso más común)
    t0 = Date.now();
    const opt3 = await collection.find({ ruc_emisor: RUC, serie: { $regex: '^F001' } }).sort({ fecha: -1 }).limit(50).toArray();
    console.log(`${Date.now()-t0}ms | OPT3: Solo emisor con regex serie\n`);
    
    // Opción 4: Sin búsqueda de texto, solo filtros normales
    t0 = Date.now();
    const opt4 = await collection.find({ ruc_emisor: RUC, tipo: '01', estado: 'Aceptado' }).sort({ fecha: -1 }).limit(50).toArray();
    console.log(`${Date.now()-t0}ms | OPT4: Solo filtros normales (tipo+estado)\n`);
    
    // Opción 5: Carga sin filtros (caso base)
    t0 = Date.now();
    const opt5 = await collection.find({ $or: [{ ruc_emisor: RUC }, { ruc_receptor: RUC }] }).sort({ fecha: -1 }).limit(50).toArray();
    console.log(`${Date.now()-t0}ms | OPT5: $or sin filtros de búsqueda\n`);
    
    // Opción 6: Con proyección para reducir datos
    t0 = Date.now();
    const opt6 = await collection.find({
        $or: [{ ruc_emisor: RUC }, { ruc_receptor: RUC }]
    }, { tipo: 1, serie: 1, numero: 1, fecha: 1, monto: 1, moneda: 1, estado: 1, ruc_emisor: 1, ruc_receptor: 1 })
    .sort({ fecha: -1 }).limit(50).toArray();
    console.log(`${Date.now()-t0}ms | OPT6: $or con proyección de campos\n`);
    
    await mongoose.connection.close();
}

benchmark().catch(console.error);
