const mongoose = require('mongoose');
require('dotenv').config();

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

async function testBusqueda() {
    const MONGO_URI = process.env.MONGO_URI;

    try {
        console.log('📡 Conectando a MongoDB...\n');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado a MongoDB\n');

        // Buscar documentos que comiencen con FC en serie
        console.log('🔍 Buscando documentos con serie que empieza con "FC":');
        const docsFC = await Documento.find({ serie: { $regex: '^FC', $options: 'i' } }).limit(5);
        docsFC.forEach((doc, i) => {
            console.log(`   ${i+1}. Serie: "${doc.serie}", Número: "${doc.numero}", Completo: ${doc.serie}-${doc.numero}`);
        });

        // Prueba de búsqueda exacta como la hace la API
        console.log('\n🔍 Prueba de búsqueda con filtro "FC211-45721489":');
        const search = 'FC211-45721489';
        const parts = search.split('-');
        console.log(`   Parte 1 (serie): "${parts[0]}"`);
        console.log(`   Parte 2 (número): "${parts[1]}"`);
        
        const resultado = await Documento.find({
            serie: { $regex: parts[0], $options: 'i' },
            numero: { $regex: parts[1], $options: 'i' }
        }).limit(5);
        
        if (resultado.length > 0) {
            console.log(`   ✅ Encontrados: ${resultado.length} documento(s)`);
            resultado.forEach((doc, i) => {
                console.log(`      ${i+1}. ${doc.serie}-${doc.numero}`);
            });
        } else {
            console.log(`   ❌ No se encontraron documentos`);
            console.log('\n   Buscando documentos similares con serie "FC211":');
            const similares = await Documento.find({ serie: 'FC211' }).limit(5);
            if (similares.length > 0) {
                console.log(`   ✅ Encontrados: ${similares.length} documento(s)`);
                similares.forEach((doc, i) => {
                    console.log(`      ${i+1}. Serie: "${doc.serie}", Número: "${doc.numero}"`);
                });
            } else {
                console.log(`   ❌ Tampoco hay documentos con serie exacta "FC211"`);
            }
        }

        // Verificar cuántos documentos hay por patrón de serie
        console.log('\n📊 Documentos por patrón de serie:');
        const patrones = await Documento.aggregate([
            { $group: { _id: { $substrCP: ['$serie', 0, 2] }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        patrones.forEach(p => {
            console.log(`   - ${p._id}xx: ${p.count.toLocaleString()} documentos`);
        });

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Conexión cerrada');
    }
}

testBusqueda();
