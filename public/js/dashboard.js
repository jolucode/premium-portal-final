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
    const paginationControls = document.getElementById('paginationControls');

    // Estado de paginación
    let currentPage = 1;
    let totalPages = 1;
    const limit = 50;

    // Elementos de paginación
    const firstPageBtn = document.getElementById('firstPageBtn');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const lastPageBtn = document.getElementById('lastPageBtn');
    const currentPageNum = document.getElementById('currentPageNum');
    const totalPageNum = document.getElementById('totalPageNum');
    const totalDocsCount = document.getElementById('totalDocsCount');

    // --- Filtrado en tiempo real ---
    let debounceTimer = null;

    function getFilterParams() {
        return new URLSearchParams({
            tipo: document.getElementById('tipo').value,
            search: document.getElementById('busqueda').value,
            estado: document.getElementById('estado').value,
            fechaDesde: document.getElementById('fechaDesde').value,
            fechaHasta: document.getElementById('fechaHasta').value,
            page: currentPage.toString(),
            limit: limit.toString()
        });
    }

    function applyFilters() {
        currentPage = 1; // Resetear a primera página al filtrar
        fetchDocuments(getFilterParams());
    }

    function debouncedApply() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(applyFilters, 400);
    }

    // Selects: reacción inmediata al cambiar
    document.getElementById('tipo').addEventListener('change', applyFilters);
    document.getElementById('estado').addEventListener('change', applyFilters);

    // Input de búsqueda: debounce 400ms mientras escribe
    document.getElementById('busqueda').addEventListener('input', debouncedApply);

    // Filtros de fecha: aplicación inmediata
    document.getElementById('fechaDesde').addEventListener('change', applyFilters);
    document.getElementById('fechaHasta').addEventListener('change', applyFilters);

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

    // Botón Exportar Excel
    document.getElementById('exportBtn').addEventListener('click', exportarExcel);

    // Event listeners de paginación
    firstPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage = 1;
            fetchDocuments(getFilterParams());
        }
    });

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            fetchDocuments(getFilterParams());
        }
    });

    nextPageBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            fetchDocuments(getFilterParams());
        }
    });

    lastPageBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage = totalPages;
            fetchDocuments(getFilterParams());
        }
    });

    // Carga inicial
    fetchDocuments();

    async function fetchDocuments(params = '') {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center">Cargando documentos...</td></tr>';
        paginationControls.style.display = 'none';

        try {
            const response = await fetch(`/api/documents?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) {
                logout();
                return;
            }

            const data = await response.json();
            const docs = data.documentos;
            const paginacion = data.paginacion;

            // Actualizar estado de paginación
            currentPage = paginacion.pagina;
            totalPages = paginacion.totalPaginas;

            renderTable(docs);
            renderPagination(paginacion);
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
                <td data-label="Documento">
                    <div class="cell-info">
                        <div style="font-weight:700; color:var(--primary-dark)">${doc.serie}-${doc.numero}</div>
                        <small style="color:var(--secondary); font-weight:500">${getTipoDesc(doc.tipo)}</small>
                    </div>
                </td>
                <td data-label="Emisión"><span>${new Date(doc.fecha).toLocaleDateString()}</span></td>
                <td data-label="Entidades">
                    <div class="cell-info">
                        <div style="font-size:0.75rem"><strong>Emisor:</strong> ${doc.ruc_emisor}</div>
                        <div style="font-size:0.75rem"><strong>Recep:</strong> ${doc.ruc_receptor}</div>
                    </div>
                </td>
                <td data-label="Estado"><span class="badge badge-success">${doc.estado}</span></td>
                <td data-label="Total" style="text-align:right"><strong>${doc.moneda} ${parseFloat(doc.monto).toFixed(2)}</strong></td>
                <td data-label="Acciones">
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

    function renderPagination(paginacion) {
        // Mostrar controles solo si hay más de una página
        if (paginacion.totalPaginas > 1) {
            paginationControls.style.display = 'flex';
        } else {
            paginationControls.style.display = 'none';
        }

        currentPageNum.textContent = paginacion.pagina;
        totalPageNum.textContent = paginacion.totalPaginas;
        totalDocsCount.textContent = paginacion.total;

        // Habilitar/deshabilitar botones
        firstPageBtn.disabled = !paginacion.tieneAnterior;
        prevPageBtn.disabled = !paginacion.tieneAnterior;
        nextPageBtn.disabled = !paginacion.tieneSiguiente;
        lastPageBtn.disabled = !paginacion.tieneSiguiente;

        // Opacidad visual para botones deshabilitados
        firstPageBtn.style.opacity = paginacion.tieneAnterior ? '1' : '0.5';
        prevPageBtn.style.opacity = paginacion.tieneAnterior ? '1' : '0.5';
        nextPageBtn.style.opacity = paginacion.tieneSiguiente ? '1' : '0.5';
        lastPageBtn.style.opacity = paginacion.tieneSiguiente ? '1' : '0.5';
    }

    function getTipoDesc(tipo) {
        const types = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de Crédito' };
        return types[tipo] || 'Documento';
    }

    // Función para exportar a Excel
    async function exportarExcel() {
        const token = localStorage.getItem('token');

        // Obtener filtros actuales
        const params = new URLSearchParams({
            tipo: document.getElementById('tipo').value,
            search: document.getElementById('busqueda').value,
            estado: document.getElementById('estado').value,
            fechaDesde: document.getElementById('fechaDesde').value,
            fechaHasta: document.getElementById('fechaHasta').value
        });

        try {
            // Cambiar texto del botón
            const exportBtn = document.getElementById('exportBtn');
            const originalText = exportBtn.innerHTML;
            exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Exportando...</span>';
            exportBtn.disabled = true;

            const response = await fetch(`/api/documents/export?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) {
                logout();
                return;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Error al exportar');
            }

            // Crear blob y descargar
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // Obtener nombre del archivo del header Content-Disposition
            const disposition = response.headers.get('Content-Disposition');
            let filename = 'documentos.xlsx';
            if (disposition) {
                const match = disposition.match(/filename="(.+)"/);
                if (match) filename = match[1];
            }
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            // Restaurar botón
            exportBtn.innerHTML = originalText;
            exportBtn.disabled = false;

        } catch (err) {
            console.error('Error exportando:', err);
            alert(`Error al exportar: ${err.message}`);

            // Restaurar botón en caso de error
            const exportBtn = document.getElementById('exportBtn');
            exportBtn.innerHTML = '<i class="fas fa-file-excel"></i> <span>Exportar Excel</span>';
            exportBtn.disabled = false;
        }
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
