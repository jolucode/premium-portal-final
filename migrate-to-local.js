const mongoose = require('mongoose');
require('dotenv').config();

// Esquemas
const EmpresaSchema = new mongoose.Schema({
    ruc: String,
    razon_social: String,
    logo: String
});

const UsuarioSchema = new mongoose.Schema({
    username: String,
    password: { type: String, required: true },
    ruc_empresa: String,
    role: { type: String, default: 'user' }
});

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

const Empresa = mongoose.model('Empresa', EmpresaSchema);
const Usuario = mongoose.model('Usuario', UsuarioSchema);
const Documento = mongoose.model('Documento', DocumentoSchema);

async function migrateData() {
    // URI de Atlas (origen)
    const ATLAS_URI = 'mongodb://root:ww12Fijo@ac-05g2uac-shard-00-00.tla3seo.mongodb.net:27017,ac-05g2uac-shard-00-01.tla3seo.mongodb.net:27017,ac-05g2uac-shard-00-02.tla3seo.mongodb.net:27017/portalventura?ssl=true&replicaSet=atlas-nofi1s-shard-0&authSource=admin&retryWrites=true&w=majority';
    
    // URI Local (destino)
    const LOCAL_URI = 'mongodb://127.0.0.1:27017/premium_portal';

    try {
        console.log('📡 Conectando a MongoDB Atlas (origen)...');
        await mongoose.connect(ATLAS_URI);
        console.log('✅ Conectado a Atlas\n');

        // Obtener datos de Atlas
        console.log('📥 Obteniendo datos de Atlas...');
        const empresas = await Empresa.find({});
        const usuarios = await Usuario.find({});
        const documentos = await Documento.find({});
        
        console.log(`   - Empresas: ${empresas.length}`);
        console.log(`   - Usuarios: ${usuarios.length}`);
        console.log(`   - Documentos: ${documentos.length.toLocaleString()}\n`);

        await mongoose.connection.close();

        // Conectar a MongoDB local
        console.log('📡 Conectando a MongoDB Local (destino)...');
        await mongoose.connect(LOCAL_URI);
        console.log('✅ Conectado a Local\n');

        // Limpiar colecciones locales
        console.log('🗑️  Limpiando colecciones locales...');
        await Empresa.deleteMany({});
        await Usuario.deleteMany({});
        await Documento.deleteMany({});
        console.log('   ✅ Colecciones limpiadas\n');

        // Insertar datos en local
        console.log('💾 Insertando datos en MongoDB Local...');
        
        if (empresas.length > 0) {
            await Empresa.insertMany(empresas);
            console.log(`   ✅ Empresas insertadas: ${empresas.length}`);
        }
        
        if (usuarios.length > 0) {
            await Usuario.insertMany(usuarios);
            console.log(`   ✅ Usuarios insertados: ${usuarios.length}`);
        }
        
        if (documentos.length > 0) {
            // Insertar en lotes de 10000
            const BATCH_SIZE = 10000;
            for (let i = 0; i < documentos.length; i += BATCH_SIZE) {
                const batch = documentos.slice(i, i + BATCH_SIZE);
                await Documento.insertMany(batch);
                const progress = Math.min(i + BATCH_SIZE, documentos.length);
                console.log(`   📦 Documentos: ${progress.toLocaleString()}/${documentos.length.toLocaleString()} (${((progress/documentos.length)*100).toFixed(1)}%)`);
            }
        }

        console.log('\n✅ ¡Migración completada exitosamente!');
        
        // Estadísticas finales
        const totalEmpresas = await Empresa.countDocuments();
        const totalUsuarios = await Usuario.countDocuments();
        const totalDocumentos = await Documento.countDocuments();
        
        console.log('\n📊 RESUMEN:');
        console.log(`   - Empresas: ${totalEmpresas}`);
        console.log(`   - Usuarios: ${totalUsuarios}`);
        console.log(`   - Documentos: ${totalDocumentos.toLocaleString()}`);

    } catch (err) {
        console.error('❌ Error en migración:', err);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Conexiones cerradas');
    }
}

migrateData();
