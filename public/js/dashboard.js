document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        window.location.href = 'login.html';
        return;
    }

    const user = JSON.parse(userStr);
    
    // Update Header
    document.getElementById('userName').textContent = user.username;
    document.getElementById('companyName').textContent = user.empresa;
    document.getElementById('companyRuc').textContent = `RUC: ${user.ruc}`;
    
    // Show Admin UI if needed
    if (user.role === 'admin') {
        document.getElementById('adminBadge').style.display = 'inline-block';
        document.getElementById('userMgmtBtn').style.display = 'inline-flex';
    }

    if (user.logo) {
        document.getElementById('headerLogo').src = user.logo;
    }

    const filterForm = document.getElementById('filterForm');
    const tableBody = document.getElementById('documentTableBody');

    // --- Filtrado en tiempo real ---
    let debounceTimer = null;

    function getFilterParams() {
        return new URLSearchParams({
            tipo: document.getElementById('tipo').value,
            serie: document.getElementById('serie').value,
            numero: document.getElementById('numero').value,
            estado: document.getElementById('estado').value
        });
    }

    function applyFilters() {
        fetchDocuments(getFilterParams());
    }

    function debouncedApply() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(applyFilters, 400);
    }

    // Selects: reacción inmediata al cambiar
    document.getElementById('tipo').addEventListener('change', applyFilters);
    document.getElementById('estado').addEventListener('change', applyFilters);

    // Inputs de texto: debounce 400ms mientras escribe
    document.getElementById('serie').addEventListener('input', debouncedApply);
    document.getElementById('numero').addEventListener('input', debouncedApply);

    // Botón limpiar: resetear y recargar
    filterForm.querySelector('button[type="reset"]').addEventListener('click', () => {
        setTimeout(applyFilters, 0);
    });

    // Botón "Aplicar Filtros" sigue funcionando (por si acaso)
    filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        clearTimeout(debounceTimer);
        applyFilters();
    });

    // Carga inicial
    fetchDocuments();

    async function fetchDocuments(params = '') {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center">Cargando documentos...</td></tr>';
        
        try {
            const response = await fetch(`/api/documents?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) {
                logout();
                return;
            }

            const docs = await response.json();
            renderTable(docs);
        } catch (err) {
            console.error('Fetch error:', err);
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red">Error al cargar datos</td></tr>';
        }
    }

    function renderTable(docs) {
        tableBody.innerHTML = '';
        if (docs.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center">No se encontraron documentos</td></tr>';
            return;
        }

        docs.forEach(doc => {
            const row = document.createElement('tr');
            row.className = 'doc-row animate-up';
            row.innerHTML = `
                <td>
                    <div style="font-weight:600">${doc.serie}-${doc.numero}</div>
                    <small style="color:var(--secondary)">${getTipoDesc(doc.tipo)}</small>
                </td>
                <td>${new Date(doc.fecha).toLocaleDateString()}</td>
                <td>
                    <div style="font-size:0.875rem">Emisor: ${doc.ruc_emisor}</div>
                    <div style="font-size:0.875rem">Receptor: ${doc.ruc_receptor}</div>
                </td>
                <td><span class="badge badge-success">${doc.estado}</span></td>
                <td style="text-align:right"><strong>${doc.moneda} ${parseFloat(doc.monto).toFixed(2)}</strong></td>
                <td style="text-align:center">
                    <div class="action-btn-group">
                        <button class="icon-btn icon-pdf" ${doc.pdf_path ? '' : 'disabled'} onclick="downloadFile('${doc.pdf_path}')" title="Descargar PDF">
                            <i class="fas fa-file-pdf"></i>
                        </button>
                        <button class="icon-btn icon-xml" ${doc.xml_path ? '' : 'disabled'} onclick="downloadFile('${doc.xml_path}')" title="Descargar XML">
                            <i class="fas fa-file-code"></i>
                        </button>
                        <button class="icon-btn icon-cdr" ${doc.cdr_path ? '' : 'disabled'} onclick="downloadFile('${doc.cdr_path}')" title="Descargar CDR">
                            <i class="fas fa-archive"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    function getTipoDesc(tipo) {
        const types = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de Crédito' };
        return types[tipo] || 'Documento';
    }
});

function downloadFile(path) {
    if (!path || path === 'null') {
        alert('Este archivo no está disponible.');
        return;
    }
    alert(`Iniciando descarga de: ${path}\n(En un sistema real, esto abriría el archivo o descargaría el blob)`);
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}
