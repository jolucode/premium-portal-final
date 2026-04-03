const mongoose = require('mongoose');

async function test() {
    // Probar conexión local
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/premium_portal');
        const count = await mongoose.connection.collection('documentos').countDocuments();
        console.log('✅ MongoDB LOCAL conectado');
        console.log(`📊 Documentos en local: ${count.toLocaleString()}`);
    } catch (e) {
        console.log('❌ Error en local:', e.message);
    }
    
    process.exit();
}

test();
