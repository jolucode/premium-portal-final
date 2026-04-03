const mongoose = require('mongoose');

async function testAPI() {
    await mongoose.connect('mongodb://127.0.0.1:27017/premium_portal');
    const Documento = mongoose.model('Documento', new mongoose.Schema({
        tipo: String, serie: String, numero: String, fecha: Date, monto: Number,
        moneda: String, ruc_emisor: String, ruc_receptor: String, estado: String,
        pdf_path: String, xml_path: String, cdr_path: String
    }));
    
    const RUC = '20510910517';
    const projection = {
        tipo: 1, serie: 1, numero: 1, fecha: 1, monto: 1,
        moneda: 1, estado: 1, ruc_emisor: 1, ruc_receptor: 1,
        pdf_path: 1, xml_path: 1, cdr_path: 1
    };
    
    function buildFilter(target, tipo, estado, fechaDesde, fechaHasta) {
        const filter = target === 'emisor' ? { ruc_emisor: RUC } : { ruc_receptor: RUC };
        if (tipo) filter.tipo = tipo;
        if (estado) filter.estado = estado;
        if (fechaDesde || fechaHasta) {
            filter.fecha = {};
            if (fechaDesde) filter.fecha.$gte = new Date(fechaDesde + 'T00:00:00.000Z');
            if (fechaHasta) filter.fecha.$lte = new Date(fechaHasta + 'T23:59:59.999Z');
        }
        return filter;
    }
    
    function addSearchFilter(filter, search) {
        if (!search) return filter;
        const parts = search.split('-');
        if (parts.length === 2) {
            filter.serie = { $regex: '^' + parts[0].replace(/[^a-zA-Z0-9]/g, '') };
            filter.numero = { $regex: '^' + parts[1].replace(/[^0-9]/g, '') };
        } else {
            const cleanSearch = search.replace(/[^a-zA-Z0-9]/g, '');
            filter.$or = [
                { serie: { $regex: '^' + cleanSearch } },
                { numero: { $regex: '^' + cleanSearch } }
            ];
        }
        return filter;
    }
    
    async function getApproxCount(Model, filter, maxCount = 10000) {
        const docs = await Model.find(filter, { _id: 1 }).limit(maxCount + 1);
        return docs.length > maxCount ? maxCount : docs.length;
    }
    
    async function simulateAPI(tipo, search, estado, fechaDesde, fechaHasta, page = 1, limit = 50) {
        const skip = (page - 1) * limit;
        const filterE = addSearchFilter(buildFilter('emisor', tipo, estado, fechaDesde, fechaHasta), search);
        const filterR = addSearchFilter(buildFilter('receptor', tipo, estado, fechaDesde, fechaHasta), search);
        
        const hasFilters = tipo || estado || fechaDesde || fechaHasta || search;
        const hasSearch = !!search;
        
        const t0 = Date.now();
        
        let total;
        let docsE, docsR;
        
        const maxSkip = 10000;
        const effectiveSkip = Math.min(skip, maxSkip);
        
        if (!hasFilters) {
            const est = await Documento.estimatedDocumentCount();
            total = est;
            [docsE, docsR] = await Promise.all([
                Documento.find(filterE, projection).sort({ fecha: -1 }).skip(effectiveSkip).limit(limit),
                Documento.find(filterR, projection).sort({ fecha: -1 }).skip(effectiveSkip).limit(limit)
            ]);
        } else if (hasSearch) {
            const [totalE, totalR] = await Promise.all([
                Documento.countDocuments(filterE),
                Documento.countDocuments(filterR)
            ]);
            total = totalE + totalR;
            [docsE, docsR] = await Promise.all([
                Documento.find(filterE, projection).sort({ fecha: -1 }).skip(effectiveSkip).limit(limit),
                Documento.find(filterR, projection).sort({ fecha: -1 }).skip(effectiveSkip).limit(limit)
            ]);
        } else {
            const [totalE, totalR] = await Promise.all([
                getApproxCount(Documento, filterE),
                getApproxCount(Documento, filterR)
            ]);
            total = totalE + totalR;
            [docsE, docsR] = await Promise.all([
                Documento.find(filterE, projection).sort({ fecha: -1 }).skip(effectiveSkip).limit(limit),
                Documento.find(filterR, projection).sort({ fecha: -1 }).skip(effectiveSkip).limit(limit)
            ]);
        }
        
        const allDocs = [...docsE, ...docsR].slice(0, limit);
        const time = Date.now() - t0;
        
        return { time, total, docs: allDocs.length };
    }
    
    console.log('\n📊 Documentos totales:', (await mongoose.connection.db.collection('documentos').countDocuments()).toLocaleString());
    console.log('\n=== SIMULACIÓN API REAL ===\n');
    
    async function run(label, ...args) {
        const r = await simulateAPI(...args);
        const status = r.time < 100 ? '✅' : r.time < 500 ? '🟢' : r.time < 2000 ? '🟡' : '🔴';
        console.log(`${status} ${r.time.toString().padStart(5)}ms | ${label} | total: ${r.total.toLocaleString()} | docs: ${r.docs}`);
    }
    
    await run('1. Carga página 1 (sin filtros)', null, null, null, null, null, 1, 50);
    await run('2. Con tipo Factura', '01', null, null, null, null, 1, 50);
    await run('3. Con estado Aceptado', null, null, 'Aceptado', null, null, 1, 50);
    await run('4. Búsqueda serie F001', null, 'F001', null, null, null, 1, 50);
    await run('5. Búsqueda número 0001', null, '0001', null, null, null, 1, 50);
    await run('6. Búsqueda F001-0001', null, 'F001-0001', null, null, null, 1, 50);
    await run('7. Tipo + Estado + Fecha', '01', null, 'Aceptado', '2025-06-01', '2025-12-31', 1, 50);
    await run('8. Página 100 (skip 4950)', null, null, null, null, null, 100, 50);
    await run('9. Página 1000 (skip 49950)', null, null, null, null, null, 1000, 50);
    
    await mongoose.connection.close();
    console.log('\n✅ Listo\n');
}

testAPI().catch(console.error);
