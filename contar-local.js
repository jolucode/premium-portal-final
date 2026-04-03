const mongoose = require('mongoose');

async function contar() {
    await mongoose.connect('mongodb://127.0.0.1:27017/premium_portal');
    const count = await mongoose.connection.collection('documentos').countDocuments();
    console.log(`\n📊 Documentos en MongoDB Local: ${count.toLocaleString()}\n`);
    
    // Estadísticas adicionales
    const db = mongoose.connection.db;
    const stats = await db.stats();
    console.log(`💾 Tamaño de datos: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📁 Tamaño con índices: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`🔢 Número de índices: ${stats.indexes}`);
    
    // Conteo por empresa
    const porEmpresa = await mongoose.connection.collection('documentos').aggregate([
        { $group: { _id: '$ruc_emisor', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]).toArray();
    
    console.log('\n🏢 Documentos por empresa:');
    porEmpresa.forEach(e => {
        console.log(`   - ${e._id}: ${e.count.toLocaleString()}`);
    });
    
    await mongoose.connection.close();
}

contar().catch(console.error);
