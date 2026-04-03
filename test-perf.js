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

async function testRendimiento() {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27014/premium_portal';

    try {
        console.log('📡 Conectando a MongoDB...\n');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado a MongoDB\n');

        const total = await Documento.countDocuments();
        console.log(`📊 Total de documentos: ${total}\n`);

        // Simular las consultas que hace la API
        console.log('🧪 PRUEBAS DE RENDIMIENTO:\n');

        // Test 1: Consulta sin filtros (solo por RUC)
        console.log('1️⃣  Consulta sin filtros (por RUC):');
        let start = Date.now();
        let result = await Documento.find({ ruc_emisor: '20510910517' }).sort({ fecha: -1 }).limit(100);
        let end = Date.now();
        console.log(`   ⏱️  Tiempo: ${end - start}ms`);
        console.log(`   📄 Resultados: ${result.length}\n`);

        // Test 2: Consulta con tipo de documento
        console.log('2️⃣  Consulta con filtro por TIPO:');
        start = Date.now();
        result = await Documento.find({ ruc_emisor: '20510910517', tipo: '01' }).sort({ fecha: -1 }).limit(100);
        end = Date.now();
        console.log(`   ⏱️  Tiempo: ${end - start}ms`);
        console.log(`   📄 Resultados: ${result.length}\n`);

        // Test 3: Consulta con estado
        console.log('3️⃣  Consulta con filtro por ESTADO:');
        start = Date.now();
        result = await Documento.find({ ruc_emisor: '20510910517', estado: 'Aceptado' }).sort({ fecha: -1 }).limit(100);
        end = Date.now();
        console.log(`   ⏱️  Tiempo: ${end - start}ms`);
        console.log(`   📄 Resultados: ${result.length}\n`);

        // Test 4: Consulta con búsqueda de serie
        console.log('4️⃣  Consulta con búsqueda por SERIE (regex):');
        start = Date.now();
        result = await Documento.find({ 
            ruc_emisor: '20510910517',
            serie: { $regex: 'F001', $options: 'i' }
        }).sort({ fecha: -1 }).limit(100);
        end = Date.now();
        console.log(`   ⏱️  Tiempo: ${end - start}ms`);
        console.log(`   📄 Resultados: ${result.length}\n`);

        // Test 5: Consulta con búsqueda de número
        console.log('5️⃣  Consulta con búsqueda por NÚMERO (regex):');
        start = Date.now();
        result = await Documento.find({ 
            ruc_emisor: '20510910517',
            numero: { $regex: '0001', $options: 'i' }
        }).sort({ fecha: -1 }).limit(100);
        end = Date.now();
        console.log(`   ⏱️  Tiempo: ${end - start}ms`);
        console.log(`   📄 Resultados: ${result.length}\n`);

        // Test 6: Consulta combinada (tipo + estado)
        console.log('6️⃣  Consulta combinada (TIPO + ESTADO):');
        start = Date.now();
        result = await Documento.find({ 
            ruc_emisor: '20510910517',
            tipo: '01',
            estado: 'Aceptado'
        }).sort({ fecha: -1 }).limit(100);
        end = Date.now();
        console.log(`   ⏱️  Tiempo: ${end - start}ms`);
        console.log(`   📄 Resultados: ${result.length}\n`);

        // Test 7: Búsqueda compleja (serie + número)
        console.log('7️⃣  Búsqueda compleja (SERIE + NÚMERO):');
        start = Date.now();
        result = await Documento.find({ 
            ruc_emisor: '20510910517',
            serie: { $regex: 'F', $options: 'i' },
            numero: { $regex: '000', $options: 'i' }
        }).sort({ fecha: -1 }).limit(100);
        end = Date.now();
        console.log(`   ⏱️  Tiempo: ${end - start}ms`);
        console.log(`   📄 Resultados: ${result.length}\n`);

        // Mostrar índices actuales
        console.log('📑 ÍNDICES ACTUALES EN LA COLECCIÓN:');
        const indexes = await Documento.listIndexes();
        const indexesArray = await indexes.toArray();
        indexesArray.forEach(idx => {
            console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Conexión cerrada');
    }
}

testRendimiento();
