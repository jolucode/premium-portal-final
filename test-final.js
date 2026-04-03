const mongoose = require('mongoose');

async function finalTest() {
    await mongoose.connect('mongodb://127.0.0.1:27017/premium_portal');
    const collection = mongoose.connection.db.collection('documentos');
    const RUC = '20510910517';
    
    console.log('\n📊 Documentos totales:', (await collection.countDocuments()).toLocaleString());
    
    async function test(nombre, fn) {
        const start = Date.now();
        await fn();
        const time = Date.now() - start;
        const status = time < 50 ? '✅' : time < 200 ? '🟢' : time < 1000 ? '🟡' : '🔴';
        console.log(`${status} ${time.toString().padStart(5)}ms | ${nombre}`);
    }
    
    console.log('\n=== PRUEBAS DE RENDIMIENTO ===\n');
    
    await test('1. Carga sin filtros (page 1, limit 50)', async () => {
        await collection.find({ $or: [{ ruc_emisor: RUC }, { ruc_receptor: RUC }] })
            .sort({ fecha: -1 }).skip(0).limit(50).toArray();
    });
    
    await test('2. Con filtro tipo (Factura)', async () => {
        await collection.find({ $or: [{ ruc_emisor: RUC }, { ruc_receptor: RUC }], tipo: '01' })
            .sort({ fecha: -1 }).skip(0).limit(50).toArray();
    });
    
    await test('3. Con filtro estado (Aceptado)', async () => {
        await collection.find({ $or: [{ ruc_emisor: RUC }, { ruc_receptor: RUC }], estado: 'Aceptado' })
            .sort({ fecha: -1 }).skip(0).limit(50).toArray();
    });
    
    await test('4. Búsqueda SERIE (F001)', async () => {
        await collection.find({
            $and: [
                { $or: [{ ruc_emisor: RUC }, { ruc_receptor: RUC }] },
                { serie: { $regex: '^F001' } }
            ]
        }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    await test('5. Búsqueda NÚMERO (0001)', async () => {
        await collection.find({
            $and: [
                { $or: [{ ruc_emisor: RUC }, { ruc_receptor: RUC }] },
                { numero: { $regex: '^0001' } }
            ]
        }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    await test('6. Serie-Número (F001-0001)', async () => {
        await collection.find({
            $or: [{ ruc_emisor: RUC }, { ruc_receptor: RUC }],
            serie: { $regex: '^F001' },
            numero: { $regex: '^0001' }
        }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    await test('7. Tipo + Estado + Fecha', async () => {
        await collection.find({
            $or: [{ ruc_emisor: RUC }, { ruc_receptor: RUC }],
            tipo: '01',
            estado: 'Aceptado',
            fecha: { $gte: new Date('2025-01-01T00:00:00.000Z') }
        }).sort({ fecha: -1 }).limit(50).toArray();
    });
    
    await test('8. countDocuments sin filtros', async () => {
        await collection.countDocuments({ $or: [{ ruc_emisor: RUC }, { ruc_receptor: RUC }] });
    });
    
    await test('9. countDocuments con serie regex', async () => {
        await collection.countDocuments({
            $and: [
                { $or: [{ ruc_emisor: RUC }, { ruc_receptor: RUC }] },
                { serie: { $regex: '^F001' } }
            ]
        });
    });
    
    // Explain de la consulta más lenta
    console.log('\n🔍 EXPLAIN búsqueda SERIE:');
    const explain = await collection.find({
        $and: [
            { $or: [{ ruc_emisor: RUC }, { ruc_receptor: RUC }] },
            { serie: { $regex: '^F001' } }
        ]
    }).sort({ fecha: -1 }).limit(50).explain('executionStats');
    
    const stage = explain.queryPlanner.winningPlan;
    console.log(`   Winning plan: ${JSON.stringify(stage.inputStage?.indexName || stage.stage)}`);
    console.log(`   Docs examinados: ${explain.executionStats.totalDocsExamined}`);
    console.log(`   Docs retornados: ${explain.executionStats.nReturned}`);
    console.log(`   Tiempo: ${explain.executionStats.executionTimeMillis}ms`);
    
    await mongoose.connection.close();
    console.log('\n✅ Pruebas completadas\n');
}

finalTest().catch(console.error);
