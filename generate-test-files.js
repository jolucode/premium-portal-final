const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
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

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

// Asegurar que existe la carpeta
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    console.log('📁 Carpeta downloads/ creada');
}

const TIPO_DESC = {
    '01': 'Factura Electrónica',
    '03': 'Boleta de Venta',
    '07': 'Nota de Crédito',
    '08': 'Nota de Débito'
};

function generarPDF(ruc, tipo, serie, numero, monto, fecha, estado) {
    const tipoDesc = TIPO_DESC[tipo] || 'Comprobante';
    const fechaStr = fecha ? fecha.toLocaleDateString('es-PE') : '2026-03-20';
    
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${tipoDesc} ${serie}-${numero}</title></head>
<body style="font-family:Arial;padding:40px;">
    <h1 style="color:#0EA5E9;">${tipoDesc}</h1>
    <hr>
    <p><strong>RUC Emisor:</strong> ${ruc}</p>
    <p><strong>Serie-Número:</strong> ${serie}-${numero}</p>
    <p><strong>Fecha:</strong> ${fechaStr}</p>
    <p><strong>Monto:</strong> S/ ${parseFloat(monto).toFixed(2)}</p>
    <p><strong>Estado:</strong> ${estado}</p>
    <hr>
    <p style="color:#999;font-size:12px;">Documento generado automáticamente para pruebas</p>
</body>
</html>`;
}

function generarXML(ruc, tipo, serie, numero, monto, moneda) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:ID>${serie}-${numero}</cbc:ID>
    <cbc:IssueDate>2026-03-20</cbc:IssueDate>
    <cbc:InvoiceTypeCode>${tipo}</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>${moneda}</cbc:DocumentCurrencyCode>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="6">${ruc}</cbc:ID>
            </cac:PartyIdentification>
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:LegalMonetaryTotal>
        <cbc:PayableAmount currencyID="${moneda}">${parseFloat(monto).toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
</Invoice>`;
}

function generarCDR(ruc, tipo, serie, numero, estado) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<ApplicationResponse xmlns="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2">
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:ID>${serie}-${numero}</cbc:ID>
    <cbc:ResponseDate>2026-03-20T10:30:00</cbc:ResponseDate>
    <cac:DocumentResponse>
        <cbc:DocumentTypeCode>${tipo}</cbc:DocumentTypeCode>
        <cac:IssuerParty>
            <cac:PartyIdentification>
                <cbc:ID schemeID="6">${ruc}</cbc:ID>
            </cac:PartyIdentification>
        </cac:IssuerParty>
    </cac:DocumentResponse>
    <cac:DocumentResponse>
        <cbc:StatusCode>${estado === 'Aceptado' ? '0' : '1'}</cbc:StatusCode>
        <cbc:Description>${estado}</cbc:Description>
    </cac:DocumentResponse>
</ApplicationResponse>`;
}

async function generateFiles() {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/premium_portal';
    
    try {
        console.log('📡 Conectando a MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado');

        const docs = await Documento.find({});
        console.log(`📊 Total documentos: ${docs.length}`);

        let creados = 0;
        let saltados = 0;

        for (const doc of docs) {
            const filename_base = `${doc.ruc_emisor}-${doc.tipo}-${doc.serie}-${doc.numero}`;

            // Generar PDF si tiene path
            if (doc.pdf_path) {
                const filename = `${filename_base}.pdf`;
                const filepath = path.join(DOWNLOADS_DIR, filename);
                if (!fs.existsSync(filepath)) {
                    const content = generarPDF(doc.ruc_emisor, doc.tipo, doc.serie, doc.numero, doc.monto, doc.fecha, doc.estado);
                    fs.writeFileSync(filepath, content, 'utf8');
                    creados++;
                } else {
                    saltados++;
                }
            }

            // Generar XML si tiene path
            if (doc.xml_path) {
                const filename = `${filename_base}.xml`;
                const filepath = path.join(DOWNLOADS_DIR, filename);
                if (!fs.existsSync(filepath)) {
                    const content = generarXML(doc.ruc_emisor, doc.tipo, doc.serie, doc.numero, doc.monto, doc.moneda);
                    fs.writeFileSync(filepath, content, 'utf8');
                    creados++;
                } else {
                    saltados++;
                }
            }

            // Generar CDR (ZIP) si tiene path
            if (doc.cdr_path) {
                const filename = `${filename_base}.zip`;
                const filepath = path.join(DOWNLOADS_DIR, filename);
                if (!fs.existsSync(filepath)) {
                    const content = generarCDR(doc.ruc_emisor, doc.tipo, doc.serie, doc.numero, doc.estado);
                    fs.writeFileSync(filepath, content, 'utf8');
                    creados++;
                } else {
                    saltados++;
                }
            }

            if (creados % 1000 === 0 && creados > 0) {
                console.log(`   📦 ${creados.toLocaleString()} archivos creados...`);
            }
        }

        console.log(`\n✅ Proceso completado!`);
        console.log(`   📝 Archivos creados: ${creados.toLocaleString()}`);
        console.log(`   ⏭️  Archivos existentes (saltados): ${saltados.toLocaleString()}`);
        console.log(`   📁 Ubicación: ${DOWNLOADS_DIR}`);

        // Listar algunos archivos de ejemplo
        const files = fs.readdirSync(DOWNLOADS_DIR);
        console.log(`\n📂 Archivos en downloads/ (${files.length} total):`);
        files.slice(0, 10).forEach(f => console.log(`   - ${f}`));
        if (files.length > 10) {
            console.log(`   ... y ${files.length - 10} más`);
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.connection.close();
    }
}

generateFiles();
