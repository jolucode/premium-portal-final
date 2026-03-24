document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
        window.location.href = 'login.html';
        return;
    }

    const user = JSON.parse(userStr);
    if (user.role !== 'admin') {
        window.location.href = 'dashboard.html';
        return;
    }

    // Update Header
    document.getElementById('companyName').textContent = user.empresa;
    document.getElementById('companyRuc').textContent = user.ruc;
    if (user.logo) {
        document.getElementById('headerLogo').src = user.logo;
    }

    const createUserForm = document.getElementById('createUserForm');
    const userTableBody = document.getElementById('userTableBody');
    const formMessage = document.getElementById('formMessage');

    // Initial Fetch
    fetchUsers();

    createUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('newUsername').value;
        const password = document.getElementById('newPassword').value;

        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (response.ok) {
                formMessage.textContent = '¡Usuario creado con éxito!';
                formMessage.style.color = 'var(--success)';
                formMessage.style.display = 'block';
                createUserForm.reset();
                fetchUsers();
            } else {
                formMessage.textContent = data.error || 'Error al crear usuario';
                formMessage.style.color = 'var(--danger)';
                formMessage.style.display = 'block';
            }
        } catch (err) {
            console.error(err);
        }
    });

    async function fetchUsers() {
        userTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center">Cargando...</td></tr>';
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await response.json();
        renderUsers(users);
    }

    function renderUsers(users) {
        userTableBody.innerHTML = '';
        users.forEach(u => {
            const row = document.createElement('tr');
            row.className = 'doc-row animate-up';
            row.innerHTML = `
                <td><strong>${u.username}</strong></td>
                <td>${u.ruc_empresa}</td>
                <td style="text-align:center">
                    <button class="btn btn-secondary" style="width:auto; color:var(--danger)" onclick="deleteUser(${u.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            userTableBody.appendChild(row);
        });
    }

    window.deleteUser = async (id) => {
        if (!confirm('¿Está seguro de eliminar este usuario?')) return;
        
        const response = await fetch(`/api/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            fetchUsers();
        } else {
            alert('Error al eliminar');
        }
    };
});
