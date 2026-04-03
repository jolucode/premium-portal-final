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

async function runTests() {
    await mongoose.connect('mongodb://127.0.0.1:27017/premium_portal');
    const db = mongoose.connection.db;
    const collection = db.collection('documentos');
    
    const RUC = '20510910517';
    
    console.log('📊 Total documentos:', (await collection.countDocuments()).toLocaleString());
    
    // Función para medir tiempo
    async function medir(nombre, fn) {
        const start = Date.now();
        const result = await fn();
        const time = Date.now() - start;
        console.log(`   ⏱️  ${nombre}: ${time}ms`);
        return { nombre, time, result };
    }
    
    // ========== ANTES ==========
    console.log('\n🔴 PRUEBAS SIN ÍNDICES OPTIMIZADOS:\n');
    
    const antes = {};
    
    await medir('1. Sin filtros (RUC)', async () => {
        antes.sinFiltros = await collection.find({ ruc_emisor: RUC }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    await medir('2. Con tipo', async () => {
        antes.conTipo = await collection.find({ ruc_emisor: RUC, tipo: '01' }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    await medir('3. Con estado', async () => {
        antes.conEstado = await collection.find({ ruc_emisor: RUC, estado: 'Aceptado' }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    await medir('4. Búsqueda SERIE (regex ^F001)', async () => {
        antes.serie = await collection.find({ ruc_emisor: RUC, serie: { $regex: '^F001', $options: 'i' } }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    await medir('5. Búsqueda NÚMERO (regex ^0001)', async () => {
        antes.numero = await collection.find({ ruc_emisor: RUC, numero: { $regex: '^0001', $options: 'i' } }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    await medir('6. Tipo + Estado', async () => {
        antes.tipoEstado = await collection.find({ ruc_emisor: RUC, tipo: '01', estado: 'Aceptado' }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    await medir('7. SERIE + NÚMERO', async () => {
        antes.serieNumero = await collection.find({
            ruc_emisor: RUC,
            serie: { $regex: '^F', $options: 'i' },
            numero: { $regex: '^000', $options: 'i' }
        }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    // ========== AGREGAR ÍNDICES ==========
    console.log('\n\n🔧 AGREGANDO ÍNDICES OPTIMIZADOS:\n');
    
    const nuevosIndices = [
        { name: 'ruc_emisor_1_serie_1_fecha_-1', key: { ruc_emisor: 1, serie: 1, fecha: -1 } },
        { name: 'ruc_emisor_1_numero_1_fecha_-1', key: { ruc_emisor: 1, numero: 1, fecha: -1 } },
        { name: 'ruc_receptor_1_serie_1_fecha_-1', key: { ruc_receptor: 1, serie: 1, fecha: -1 } },
        { name: 'ruc_receptor_1_numero_1_fecha_-1', key: { ruc_receptor: 1, numero: 1, fecha: -1 } },
        { name: 'ruc_emisor_1_serie_text_numero_text_fecha_-1', key: { ruc_emisor: 1, serie: 'text', numero: 'text', fecha: -1 } },
    ];
    
    for (const idx of nuevosIndices) {
        const start = Date.now();
        await collection.createIndex(idx.key, { name: idx.name });
        console.log(`   ✅ ${idx.name}: ${Date.now() - start}ms`);
    }
    
    // ========== DESPUÉS ==========
    console.log('\n\n🟢 PRUEBAS CON ÍNDICES OPTIMIZADOS:\n');
    
    const despues = {};
    
    await medir('1. Sin filtros (RUC)', async () => {
        despues.sinFiltros = await collection.find({ ruc_emisor: RUC }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    await medir('2. Con tipo', async () => {
        despues.conTipo = await collection.find({ ruc_emisor: RUC, tipo: '01' }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    await medir('3. Con estado', async () => {
        despues.conEstado = await collection.find({ ruc_emisor: RUC, estado: 'Aceptado' }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    await medir('4. Búsqueda SERIE (regex ^F001)', async () => {
        despues.serie = await collection.find({ ruc_emisor: RUC, serie: { $regex: '^F001', $options: 'i' } }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    await medir('5. Búsqueda NÚMERO (regex ^0001)', async () => {
        despues.numero = await collection.find({ ruc_emisor: RUC, numero: { $regex: '^0001', $options: 'i' } }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    await medir('6. Tipo + Estado', async () => {
        despues.tipoEstado = await collection.find({ ruc_emisor: RUC, tipo: '01', estado: 'Aceptado' }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    await medir('7. SERIE + NÚMERO', async () => {
        despues.serieNumero = await collection.find({
            ruc_emisor: RUC,
            serie: { $regex: '^F', $options: 'i' },
            numero: { $regex: '^000', $options: 'i' }
        }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    // ========== COMPARATIVA ==========
    console.log('\n\n📈 COMPARATIVA DE RENDIMIENTO:\n');
    console.log('┌──────────────────────────────┬──────────┬──────────┬──────────┐');
    console.log('│ Consulta                     │ Antes    │ Después  │ Mejora   │');
    console.log('├──────────────────────────────┼──────────┼──────────┼──────────┤');
    
    const tests = [
        ['Sin filtros (RUC)', antes.sinFiltros, despues.sinFiltros],
        ['Con tipo', antes.conTipo, despues.conTipo],
        ['Con estado', antes.conEstado, despues.conEstado],
        ['Búsqueda SERIE', antes.serie, despues.serie],
        ['Búsqueda NÚMERO', antes.numero, despues.numero],
        ['Tipo + Estado', antes.tipoEstado, despues.tipoEstado],
        ['SERIE + NÚMERO', antes.serieNumero, despues.serieNumero],
    ];
    
    // Recalcular tiempos desde los logs
    // (Los tiempos ya se imprimieron arriba, aquí mostramos resumen)
    
    console.log('│                              │          │          │          │');
    console.log('└──────────────────────────────┴──────────┴──────────┴──────────┘');
    
    // Mostrar índices finales
    const indexes = await collection.indexes();
    console.log('\n📑 ÍNDICES TOTALES:', indexes.length);
    indexes.forEach(idx => {
        console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    await mongoose.connection.close();
    console.log('\n✅ Pruebas completadas');
}

runTests().catch(console.error);
