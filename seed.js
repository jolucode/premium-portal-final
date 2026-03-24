const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seed() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'multiempresaportal'
    });

    try {
        // Clean tables
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        await connection.query('TRUNCATE documentos');
        await connection.query('TRUNCATE usuarios');
        await connection.query('TRUNCATE empresas');
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');

        // Seed Empresas
        await connection.query('INSERT INTO empresas (ruc, razon_social, logo) VALUES (?, ?, ?)', 
            ['20510910517', 'VENTURA SOLUCIONES S.A.C.', 'assets/logo.png']);
        await connection.query('INSERT INTO empresas (ruc, razon_social, logo) VALUES (?, ?, ?)', 
            ['20601234567', 'CORPORACION LOGISTICA S.A.C.', 'assets/logo_logistica.png']);

        // Seed Users
        const passVentura = await bcrypt.hash('20510910517', 10); // RUC as password
        const passLogistica = await bcrypt.hash('20601234567', 10);
        
        // Add a standard employee
        const passEmployee = await bcrypt.hash('ventura', 10);

        await connection.query('INSERT INTO usuarios (username, password, ruc_empresa) VALUES (?, ?, ?)', 
            ['admin_ventura', passEmployee, '20510910517']);
        await connection.query('INSERT INTO usuarios (username, password, ruc_empresa) VALUES (?, ?, ?)', 
            ['admin_logistica', passLogistica, '20601234567']);

        // Seed Documents (Company 1) with File Paths
        await connection.query('INSERT INTO documentos (tipo, serie, numero, fecha, monto, moneda, ruc_emisor, ruc_receptor, estado, pdf_path, xml_path, cdr_path) VALUES ?', 
            [[
                ['01', 'F001', '00000001', '2026-03-20', 1500.00, 'PEN', '20510910517', '20445566778', 'Aceptado', '/downloads/F001-1.pdf', '/downloads/F001-1.xml', '/downloads/F001-1.cdr'],
                ['03', 'B001', '00000123', '2026-03-21', 120.50, 'PEN', '20510910517', '10223344556', 'Aceptado', '/downloads/B001-123.pdf', '/downloads/B001-123.xml', null]
            ]]);

        // Seed Documents (Company 2)
        await connection.query('INSERT INTO documentos (tipo, serie, numero, fecha, monto, moneda, ruc_emisor, ruc_receptor, estado, pdf_path, xml_path, cdr_path) VALUES ?', 
            [[
                ['01', 'F002', '00000999', '2026-03-22', 8500.00, 'PEN', '20601234567', '20101112131', 'Aceptado', '/downloads/F002-999.pdf', '/downloads/F002-999.xml', '/downloads/F002-999.cdr'],
                ['07', 'FC02', '00000005', '2026-03-23', 450.00, 'USD', '20601234567', '20556677889', 'Pendiente', null, '/downloads/FC02-5.xml', null]
            ]]);

        console.log('Database seeded successfully with file paths!');
    } catch (err) {
        console.error('Error seeding database:', err);
    } finally {
        await connection.end();
    }
}

seed();
