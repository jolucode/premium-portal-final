const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Definir esquemas para el seed
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

async function seed() {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27014/premium_portal';
    
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB for seeding...');

        // Clean collections
        await Empresa.deleteMany({});
        await Usuario.deleteMany({});
        await Documento.deleteMany({});
        console.log('Collections cleared.');

        // Seed Empresas
        const empresas = await Empresa.insertMany([
            { ruc: '20510910517', razon_social: 'VENTURA SOLUCIONES S.A.C.', logo: 'assets/logo.png' },
            { ruc: '20601234567', razon_social: 'CORPORACION LOGISTICA S.A.C.', logo: 'assets/logo_logistica.png' }
        ]);
        console.log('Empresas seeded.');

        // Seed Users
        const passVentura = await bcrypt.hash('20510910517', 10);
        const passLogistica = await bcrypt.hash('20601234567', 10);
        const passEmployee = await bcrypt.hash('ventura', 10);

        await Usuario.insertMany([
            { username: 'admin_ventura', password: passEmployee, ruc_empresa: '20510910517', role: 'admin' },
            { username: 'admin_logistica', password: passLogistica, ruc_empresa: '20601234567', role: 'admin' }
        ]);
        console.log('Users seeded.');

        // Seed Documents
        await Documento.insertMany([
            {
                tipo: '01', serie: 'F001', numero: '00000001', fecha: new Date('2026-03-20'),
                monto: 1500.00, moneda: 'PEN', ruc_emisor: '20510910517', ruc_receptor: '20445566778',
                estado: 'Aceptado', pdf_path: '/downloads/F001-1.pdf', xml_path: '/downloads/F001-1.xml', cdr_path: '/downloads/F001-1.cdr'
            },
            {
                tipo: '03', serie: 'B001', numero: '00000123', fecha: new Date('2026-03-21'),
                monto: 120.50, moneda: 'PEN', ruc_emisor: '20510910517', ruc_receptor: '10223344556',
                estado: 'Aceptado', pdf_path: '/downloads/B001-123.pdf', xml_path: '/downloads/B001-123.xml'
            },
            {
                tipo: '01', serie: 'F002', numero: '00000999', fecha: new Date('2026-03-22'),
                monto: 8500.00, moneda: 'PEN', ruc_emisor: '20601234567', ruc_receptor: '20101112131',
                estado: 'Aceptado', pdf_path: '/downloads/F002-999.pdf', xml_path: '/downloads/F002-999.xml', cdr_path: '/downloads/F002-999.cdr'
            },
            {
                tipo: '07', serie: 'FC02', numero: '00000005', fecha: new Date('2026-03-23'),
                monto: 450.00, moneda: 'USD', ruc_emisor: '20601234567', ruc_receptor: '20556677889',
                estado: 'Pendiente', xml_path: '/downloads/FC02-5.xml'
            }
        ]);
        console.log('Documents seeded.');

        console.log('Database seeded successfully with MongoDB!');
    } catch (err) {
        console.error('Error seeding database:', err);
    } finally {
        await mongoose.connection.close();
    }
}

seed();
