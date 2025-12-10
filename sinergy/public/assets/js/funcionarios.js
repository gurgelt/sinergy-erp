document.addEventListener('DOMContentLoaded', () => {
    initializeAppFuncionarios();
});

// === CONSTANTES E VARIÁVEIS GLOBAIS ===
const API_URL = 'https://virtualcriacoes.com/sinergy/api';
let allFuncionarios = []; 
let allUsuarios = [];
let currentUserID = null;
let currentEditID = null;
let fotoBase64 = null; 

async function initializeAppFuncionarios() {
    currentUserID = window.getLoggedInUserID(); 
    if (!currentUserID) {
        showNotification('Erro de sessão. Você não está logado.', 'error');
        document.getElementById('btn-novo-funcionario').disabled = true;
        // Esconde o loader mesmo com erro para não travar a tela
        const loader = document.getElementById('loader-overlay');
        if (loader) loader.style.display = 'none';
        return;
    }
    
    setupEventListenersFuncionarios();
    
    // === OTIMIZAÇÃO DE PERFORMANCE ===
    
    // 1. Carrega a lista principal (Prioridade Alta)
    // O await aqui garante que esperamos os funcionários antes de renderizar
    await loadFuncionarios();
    
    // 2. Renderiza a tela e esconde o Loader IMEDIATAMENTE
    renderEmployeeGrid();
    const loader = document.getElementById('loader-overlay');
    if (loader) loader.style.display = 'none';

    // 3. Carrega os dados secundários em segundo plano (Prioridade Baixa)
    // Isso não trava a tela do usuário enquanto ele já pode ver a lista
    loadUsuariosDisponiveis().catch(err => console.warn("Carregamento em background falhou:", err));
}

async function loadFuncionarios() {
    try {
        const response = await fetch(`${API_URL}/funcionarios`);
        if (!response.ok) throw new Error('Falha ao carregar funcionários');
        allFuncionarios = await response.json();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function loadUsuariosDisponiveis() {
    try {
        const response = await fetch(`${API_URL}/usuarios-disponiveis`);
        if (!response.ok) throw new Error('Falha ao carregar usuários');
        allUsuarios = await response.json();
        popularDropdownUsuarios(allUsuarios);
    } catch (error) {
        console.warn('Não foi possível carregar usuários disponíveis:', error.message);
    }
}

function popularDropdownUsuarios(usuarios, usuarioVinculadoID = null) {
    const select = document.getElementById('select-usuario-login');
    select.innerHTML = '<option value="">Nenhum (Não usa o sistema)</option>';
    
    usuarios.forEach(user => {
        const option = document.createElement('option');
        option.value = user.ID;
        option.textContent = `${user.NomeCompleto} (@${user.NomeUsuario})`;
        select.appendChild(option);
    });

    if (usuarioVinculadoID && !usuarios.some(u => u.ID === usuarioVinculadoID)) {
         const option = document.createElement('option');
         option.value = usuarioVinculadoID;
         option.textContent = `Usuário Vinculado (ID: ${usuarioVinculadoID})`;
         option.selected = true;
         select.appendChild(option);
    }
}

function setupEventListenersFuncionarios() {
    document.getElementById('btn-novo-funcionario').addEventListener('click', () => abrirModalFuncionario('create'));
    document.getElementById('close-modal').addEventListener('click', fecharModal);
    document.getElementById('btn-cancelar').addEventListener('click', fecharModal);
    document.getElementById('form-funcionario').addEventListener('submit', salvarFuncionario);

    document.getElementById('search-input-main').addEventListener('input', renderEmployeeGrid);
    document.getElementById('filter-status').addEventListener('change', renderEmployeeGrid);
    document.getElementById('filter-departamento').addEventListener('change', renderEmployeeGrid);

    document.getElementById('search-input').addEventListener('input', (e) => {
        document.getElementById('search-input-main').value = e.target.value;
        renderEmployeeGrid();
    });

    document.getElementById('input-foto').addEventListener('change', handleFotoUpload);

    // Listeners do Modal de Permissões
    document.getElementById('close-permissoes-modal').addEventListener('click', fecharModalPermissoes);
    document.getElementById('btn-cancelar-permissoes').addEventListener('click', fecharModalPermissoes);
    document.getElementById('form-permissoes').addEventListener('submit', salvarPermissoes);

    // Busca de módulos no modal de permissões
    const buscaModulos = document.getElementById('busca-modulos');
    if (buscaModulos) {
        buscaModulos.addEventListener('input', filtrarModulosPermissoes);
    }
}

function abrirModalFuncionario(mode, funcionarioID = null) {
    currentEditID = null;
    fotoBase64 = null; 
    document.getElementById('form-funcionario').reset();
    
    const preview = document.getElementById('funcionario-avatar-preview');
    const placeholder = document.getElementById('funcionario-placeholder');
    preview.src = "";
    preview.style.display = 'none';
    placeholder.style.display = 'block';
    
    const modalTitle = document.getElementById('modal-title');
    const btnSalvar = document.getElementById('btn-salvar');

    popularDropdownUsuarios(allUsuarios);

    if (mode === 'create') {
        modalTitle.textContent = 'Novo Funcionário';
        btnSalvar.textContent = 'Salvar Funcionário';
    } else {
        modalTitle.textContent = 'Editar Funcionário';
        btnSalvar.textContent = 'Salvar Alterações';
        currentEditID = funcionarioID;
        
        const funcionario = allFuncionarios.find(f => f.ID === funcionarioID);
        if (funcionario) {
            preencherFormularioFuncionario(funcionario);
        }
    }
    
    document.getElementById('modal-funcionario').classList.add('active');
}

function fecharModal() {
    document.getElementById('modal-funcionario').classList.remove('active');
}

function preencherFormularioFuncionario(data) {
    document.getElementById('funcionario-id').value = data.ID;

    fotoBase64 = data.FotoPerfilBase64 || null;
    const preview = document.getElementById('funcionario-avatar-preview');
    const placeholder = document.getElementById('funcionario-placeholder');
    if(fotoBase64) {
        preview.src = fotoBase64;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
    }

    // Tratamento de valores NULL - usar || '' para evitar mostrar "null" nos campos
    document.getElementById('input-nome').value = data.NomeCompleto || '';
    document.getElementById('input-nascimento').value = data.DataNascimento || '';
    document.getElementById('input-cpf').value = data.CPF || '';
    document.getElementById('input-rg').value = data.RG || '';
    document.getElementById('input-mae').value = data.NomeMae || '';
    document.getElementById('input-pai').value = data.NomePai || '';
    document.getElementById('input-telefone').value = data.Telefone || '';
    document.getElementById('input-email').value = data.Email || '';
    document.getElementById('input-endereco').value = data.Endereco || '';
    document.getElementById('input-cep').value = data.CEP || '';
    document.getElementById('input-cidadeuf').value = data.CidadeUF || '';
    document.getElementById('input-pis').value = data.PIS_PASEP || '';
    document.getElementById('input-titulo').value = data.TituloEleitor || '';

    document.getElementById('input-admissao').value = data.DataAdmissao || '';
    document.getElementById('input-cargo').value = data.Cargo || '';
    document.getElementById('input-departamento').value = data.Departamento || '';
    document.getElementById('input-salario').value = data.Salario ? parseFloat(data.Salario).toFixed(2) : '0.00';
    document.getElementById('input-contrato').value = data.TipoContrato || '';
    document.getElementById('input-status').value = data.Status || 'Ativo';

    document.getElementById('input-banco').value = data.Banco || '';
    document.getElementById('input-agencia').value = data.Agencia || '';
    document.getElementById('input-conta').value = data.ContaCorrente || '';

    popularDropdownUsuarios(allUsuarios, data.UsuarioID);
    document.getElementById('select-usuario-login').value = data.UsuarioID || "";
}

function handleFotoUpload(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('funcionario-avatar-preview');
    const placeholder = document.getElementById('funcionario-placeholder');

    if (!file) {
        fotoBase64 = null;
        preview.src = "";
        preview.style.display = 'none';
        placeholder.style.display = 'block';
        return;
    }

    if (file.size > 1 * 1024 * 1024) {
        showNotification('A imagem é muito grande. Limite de 1MB.', 'error');
        event.target.value = null; 
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
        fotoBase64 = reader.result; 
        preview.src = fotoBase64;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function renderEmployeeGrid() {
    const grid = document.getElementById('employee-grid');
    const filtroStatus = document.getElementById('filter-status').value;
    const filtroDept = document.getElementById('filter-departamento').value;
    const filtroSearch = document.getElementById('search-input-main').value.toLowerCase();
    
    const filtrados = allFuncionarios.filter(f => {
        const matchStatus = (filtroStatus === 'todos') || (f.Status === filtroStatus);
        const matchDept = (filtroDept === 'todos') || (f.Departamento === filtroDept);
        
        const matchSearch = (f.NomeCompleto.toLowerCase().includes(filtroSearch) ||
                             (f.CPF && f.CPF.includes(filtroSearch)) ||
                             (f.Cargo && f.Cargo.toLowerCase().includes(filtroSearch)));
                             
        return matchStatus && matchDept && matchSearch;
    });

    grid.innerHTML = '';
    if (filtrados.length === 0) {
        grid.innerHTML = '<p style="color: #64748b; padding: 20px;">Nenhum funcionário encontrado.</p>';
        return;
    }

    filtrados.forEach(f => {
        const card = document.createElement('div');
        card.className = 'employee-card';
        card.dataset.id = f.ID;

        const statusClass = f.Status.toLowerCase().replace(/ /g, '-');
        
        let fotoHTML = '';
        if (f.FotoPerfilBase64) {
            fotoHTML = `<img src="${f.FotoPerfilBase64}" alt="Foto de ${f.NomeCompleto}">`;
        } else {
            const iniciais = f.NomeCompleto.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            fotoHTML = `<div class="placeholder">${iniciais}</div>`;
        }

        // --- ATUALIZADO: Botão de Permissões ---
        const btnPermissoes = f.UsuarioID 
            ? `<button class="action-button view" onclick="abrirModalPermissoes(${f.UsuarioID}, '${f.NomeCompleto}')" title="Permissões de Acesso"><i class="fas fa-lock"></i></button>` 
            : `<button class="action-button view" disabled style="opacity:0.3; cursor:not-allowed;" title="Sem usuário vinculado"><i class="fas fa-lock"></i></button>`;

        card.innerHTML = `
            <div class="employee-card-photo">
                ${fotoHTML}
            </div>
            <div class="employee-card-info">
                <h3>${f.NomeCompleto}</h3>
                <p class="cargo">${f.Cargo || 'Cargo não definido'}</p>
                <div class="employee-card-details">
                    <p><i class="fas fa-briefcase"></i> ${f.Departamento || 'Setor não definido'}</p>
                    <p><i class="fas fa-calendar-alt"></i> Adm.: ${formatarData(f.DataAdmissao)}</p>
                    <p><i class="fas fa-phone"></i> ${f.Telefone || 'Não informado'}</p>
                </div>
                <div class="employee-card-footer">
                    <span class="status-badge ${statusClass}">${f.Status}</span>
                    <div style="display: flex; gap: 5px;">
                        ${btnPermissoes}
                        <button class="action-button edit" onclick="abrirModalFuncionario('edit', ${f.ID})" title="Editar">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

async function salvarFuncionario(event) {
    event.preventDefault();
    const btnSalvar = document.getElementById('btn-salvar');
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    const payload = {
        ID: currentEditID ? parseInt(currentEditID) : null,
        NomeCompleto: document.getElementById('input-nome').value,
        FotoPerfilBase64: fotoBase64, 
        DataNascimento: document.getElementById('input-nascimento').value || null,
        RG: document.getElementById('input-rg').value,
        CPF: document.getElementById('input-cpf').value,
        NomeMae: document.getElementById('input-mae').value,
        NomePai: document.getElementById('input-pai').value,
        Telefone: document.getElementById('input-telefone').value,
        Email: document.getElementById('input-email').value,
        Endereco: document.getElementById('input-endereco').value,
        CEP: document.getElementById('input-cep').value,
        CidadeUF: document.getElementById('input-cidadeuf').value,
        PIS_PASEP: document.getElementById('input-pis').value,
        TituloEleitor: document.getElementById('input-titulo').value,
        DataAdmissao: document.getElementById('input-admissao').value,
        Cargo: document.getElementById('input-cargo').value,
        Departamento: document.getElementById('input-departamento').value,
        Salario: parseFloat(document.getElementById('input-salario').value) || 0,
        TipoContrato: document.getElementById('input-contrato').value,
        Status: document.getElementById('input-status').value,
        Banco: document.getElementById('input-banco').value,
        Agencia: document.getElementById('input-agencia').value,
        ContaCorrente: document.getElementById('input-conta').value,
        UsuarioID: document.getElementById('select-usuario-login').value || null
    };

    let url = `${API_URL}/funcionarios`;
    let method = 'POST';

    if (currentEditID) {
        url = `${API_URL}/funcionarios/${currentEditID}`;
        method = 'PUT';
    }

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Falha ao salvar');
        }

        const result = await response.json();
        showNotification(result.message, 'success');
        fecharModal();
        await loadFuncionarios(); 
        renderEmployeeGrid(); 

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = currentEditID ? 'Salvar Alterações' : 'Salvar Funcionário';
    }
}

// === FUNÇÕES PARA PERMISSÕES ===

async function abrirModalPermissoes(usuarioID, nome) {
    document.getElementById('permissoes-usuario-id').value = usuarioID;
    document.getElementById('permissoes-titulo').textContent = `Acessos de: ${nome.split(' ')[0]}`;

    // Limpa checkboxes
    document.querySelectorAll('input[name="modulo"]').forEach(cb => cb.checked = false);

    try {
        const res = await fetch(`${API_URL}/permissoes/${usuarioID}`);
        if (res.ok) {
            const permissoes = await res.json();
            permissoes.forEach(mod => {
                const cb = document.querySelector(`input[name="modulo"][value="${mod}"]`);
                if (cb) cb.checked = true;
            });
        }
        document.getElementById('modal-permissoes').classList.add('active');

        // Inicializa contador e listeners após abrir modal
        atualizarContadorPermissoes();

        // Adiciona listener para atualizar contador quando checkboxes mudarem
        document.querySelectorAll('input[name="modulo"]').forEach(cb => {
            cb.addEventListener('change', atualizarContadorPermissoes);
        });

        // Limpa campo de busca
        const buscaModulos = document.getElementById('busca-modulos');
        if (buscaModulos) {
            buscaModulos.value = '';
        }

    } catch (e) {
        showNotification('Erro ao carregar permissões.', 'error');
    }
}

function fecharModalPermissoes() {
    document.getElementById('modal-permissoes').classList.remove('active');
}

async function salvarPermissoes(e) {
    e.preventDefault();
    const usuarioID = document.getElementById('permissoes-usuario-id').value;

    const selecionados = [];
    document.querySelectorAll('input[name="modulo"]:checked').forEach(cb => {
        selecionados.push(cb.value);
    });

    try {
        const res = await fetch(`${API_URL}/permissoes/${usuarioID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modulos: selecionados })
        });

        if (res.ok) {
            showNotification('Permissões atualizadas com sucesso!', 'success');
            fecharModalPermissoes();
        } else {
            showNotification('Erro ao salvar permissões.', 'error');
        }
    } catch (e) {
        showNotification('Erro de conexão.', 'error');
    }
}

function filtrarModulosPermissoes() {
    const busca = document.getElementById('busca-modulos').value.toLowerCase();
    const cards = document.querySelectorAll('.permission-card');

    cards.forEach(card => {
        const modulo = card.getAttribute('data-modulo');
        const label = card.querySelector('.perm-label').textContent.toLowerCase();

        if (modulo.includes(busca) || label.includes(busca)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

function atualizarContadorPermissoes() {
    const totalCheckboxes = document.querySelectorAll('input[name="modulo"]');
    const checkboxesMarcados = document.querySelectorAll('input[name="modulo"]:checked');

    const total = totalCheckboxes.length;
    const ativos = checkboxesMarcados.length;

    const contadorElement = document.getElementById('contador-permissoes');
    const totalElement = document.getElementById('total-permissoes');

    if (contadorElement) {
        contadorElement.textContent = ativos;
    }

    if (totalElement) {
        totalElement.textContent = total;
    }
}

// Utils
window.abrirModalPermissoes = abrirModalPermissoes; // Exporta
window.abrirModalFuncionario = abrirModalFuncionario;

function formatarData(dataString) {
    if (!dataString) return 'N/A';
    const data = new Date(dataString + 'T00:00:00'); 
    return data.toLocaleDateString('pt-BR');
}

function showNotification(message, type = 'info') {
    if (window.NotificationManager) {
        const title = type.charAt(0).toUpperCase() + type.slice(1);
        window.NotificationManager.show({ title: title, message: message, type: type });
    } else {
        alert(message);
    }
}