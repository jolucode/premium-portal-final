const mongoose = require('mongoose');
require('dotenv').config();

async function optimizeIndexes() {
    const MONGO_URI = process.env.MONGO_URI;

    try {
        console.log('📡 Conectando a MongoDB...\n');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado a MongoDB\n');

        const collection = mongoose.connection.collection('documentos');

        console.log('🔧 Optimizando índices para búsqueda por serie y número...\n');

        // Índice 1: ruc_emisor + serie (para búsqueda por serie)
        console.log('1️⃣  Índice: ruc_emisor + serie');
        try {
            await collection.createIndex({ ruc_emisor: 1, serie: 1 });
            console.log('   ✅ Creado\n');
        } catch (e) {
            console.log('   ⚠️  Ya existe\n');
        }

        // Índice 2: ruc_emisor + numero (para búsqueda por número)
        console.log('2️⃣  Índice: ruc_emisor + numero');
        try {
            await collection.createIndex({ ruc_emisor: 1, numero: 1 });
            console.log('   ✅ Creado\n');
        } catch (e) {
            console.log('   ⚠️  Ya existe\n');
        }

        // Índice 3: ruc_receptor + serie (para documentos recibidos)
        console.log('3️⃣  Índice: ruc_receptor + serie');
        try {
            await collection.createIndex({ ruc_receptor: 1, serie: 1 });
            console.log('   ✅ Creado\n');
        } catch (e) {
            console.log('   ⚠️  Ya existe\n');
        }

        // Índice 4: ruc_receptor + numero (para documentos recibidos)
        console.log('4️⃣  Índice: ruc_receptor + numero');
        try {
            await collection.createIndex({ ruc_receptor: 1, numero: 1 });
            console.log('   ✅ Creado\n');
        } catch (e) {
            console.log('   ⚠️  Ya existe\n');
        }

        // Índice 5: ruc_emisor + serie + numero (ya existe, pero verificamos)
        console.log('5️⃣  Índice: ruc_emisor + serie + numero');
        try {
            await collection.createIndex({ ruc_emisor: 1, serie: 1, numero: 1 });
            console.log('   ✅ Creado\n');
        } catch (e) {
            console.log('   ⚠️  Ya existe\n');
        }

        // Índice 6: ruc_receptor + serie + numero
        console.log('6️⃣  Índice: ruc_receptor + serie + numero');
        try {
            await collection.createIndex({ ruc_receptor: 1, serie: 1, numero: 1 });
            console.log('   ✅ Creado\n');
        } catch (e) {
            console.log('   ⚠️  Ya existe\n');
        }

        console.log('✅ ¡Índices optimizados creados!\n');

        // Listar todos los índices
        console.log('📑 ÍNDICES TOTALES:');
        const indexes = await collection.listIndexes().toArray();
        indexes.forEach((idx, i) => {
            console.log(`   ${i + 1}. ${idx.name}: ${JSON.stringify(idx.key)}`);
        });

        // Estadísticas
        console.log('\n📊 ESTADÍSTICAS:');
        const stats = await collection.stats();
        console.log(`   - Documentos: ${stats.count.toLocaleString()}`);
        console.log(`   - Tamaño colección: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   - Tamaño índices: ${(stats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   - Número de índices: ${stats.nindexes}`);

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Conexión cerrada');
    }
}

optimizeIndexes();
