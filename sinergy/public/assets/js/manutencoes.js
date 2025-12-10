/**
 * manutencoes.js - Módulo de Gerenciamento de Manutenções
 */

document.addEventListener('DOMContentLoaded', () => {
    initializeAppManutencoes();
});

// === CONSTANTES E VARIÁVEIS GLOBAIS ===
const API_URL = 'https://virtualcriacoes.com/sinergy/api';
let allManutencoes = [];
let allClientes = [];
let allUsuarios = [];
let currentUserID = null;
let currentUserRole = null;
let currentEditID = null;
let manutencaoParaExcluir = null;

// === INICIALIZAÇÃO ===

async function initializeAppManutencoes() {
    currentUserID = window.getLoggedInUserID();
    currentUserRole = window.getLoggedInUserRole();

    if (!currentUserID || !currentUserRole) {
        showNotification('Erro de sessão. Você não está logado.', 'error');
        const btnNova = document.getElementById('btn-nova-solicitacao');
        if (btnNova) btnNova.disabled = true;
        return;
    }
    
    setupEventListeners();
    
    // Carrega dados em paralelo
    const manutencoesPromise = loadManutencoes();
    const clientesPromise = loadClientesParaDropdown();
    const usuariosPromise = loadUsuariosParaDropdown();
    
    await Promise.all([manutencoesPromise, clientesPromise, usuariosPromise]);
    
    renderTabela();
    atualizarEstatisticasManutencoes(); // Atualiza os cards

    const loader = document.getElementById('loader-overlay');
    if (loader) loader.style.display = 'none';
}

async function loadManutencoes() {
    try {
        const response = await fetch(`${API_URL}/manutencoes`);
        if (!response.ok) throw new Error('Falha ao carregar manutenções');
        allManutencoes = await response.json();
    } catch (error) {
        showNotification(error.message, 'error');
        allManutencoes = [];
    }
}

// === ATUALIZAÇÃO DOS KPIS (HUB) ===
function atualizarEstatisticasManutencoes() {
    const total = allManutencoes.length;
    const pendentes = allManutencoes.filter(m => m.Status === 'Pendente' || m.Status === 'Em Análise').length;
    const aprovacao = allManutencoes.filter(m => m.Status === 'Aguardando Aprovação').length;
    const emManutencao = allManutencoes.filter(m => m.Status === 'Em Manutenção').length;
    const concluidas = allManutencoes.filter(m => m.Status === 'Concluído').length;

    const updateText = (id, val) => { 
        const el = document.getElementById(id); 
        if (el) el.textContent = val; 
    };

    updateText('stat-total', total);
    updateText('stat-pendentes', pendentes);
    updateText('stat-aprovacao', aprovacao);
    updateText('stat-em-manutencao', emManutencao);
    updateText('stat-concluidas', concluidas);
}

async function loadClientesParaDropdown() {
    try {
        let url = `${API_URL}/clientes`;
        if (currentUserRole !== 'admin') {
            // Se quiser filtrar por usuário logado: url += `?usuarioID=${currentUserID}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha ao carregar clientes');
        allClientes = await response.json();
        
        const select = document.getElementById('select-cliente');
        if (!select) return;

        select.innerHTML = '<option value="">Selecione o Cliente...</option>';
        allClientes.sort((a, b) => a.Nome.localeCompare(b.Nome));
        
        allClientes.forEach(cliente => {
            const option = document.createElement('option');
            option.value = cliente.ID;
            option.textContent = `${cliente.Nome}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao carregar clientes:", error);
    }
}

async function loadUsuariosParaDropdown() {
    try {
        const response = await fetch(`${API_URL}/vendedores`);
        const select = document.getElementById('select-responsavel');
        if (!select) return;
        select.innerHTML = '<option value="">Selecione o Técnico...</option>';

        if (response.ok) {
            const resUsers = await fetch(`${API_URL}/usuarios-disponiveis`);
            if (resUsers.ok) {
                allUsuarios = await resUsers.json();
            } else {
                allUsuarios = []; 
            }

            allUsuarios.forEach(user => {
                const option = document.createElement('option');
                option.value = user.ID;
                option.textContent = user.NomeCompleto || user.NomeUsuario;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.warn("Não foi possível carregar a lista de responsáveis.");
    }
}

function setupEventListeners() {
    const btnNova = document.getElementById('btn-nova-solicitacao');
    if (btnNova) btnNova.addEventListener('click', () => abrirModal('create'));
    
    const btnFechar = document.getElementById('close-modal');
    const btnCancelar = document.getElementById('btn-cancelar');
    if (btnFechar) btnFechar.addEventListener('click', fecharModal);
    if (btnCancelar) btnCancelar.addEventListener('click', fecharModal);
    
    const form = document.getElementById('form-manutencao');
    if (form) form.addEventListener('submit', salvarManutencao);
    
    const searchInput = document.getElementById('search-input-main') || document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', renderTabela);
    
    const filterStatus = document.getElementById('filter-status');
    if (filterStatus) filterStatus.addEventListener('change', renderTabela);

    const inputGarantia = document.getElementById('input-data-garantia');
    if (inputGarantia) inputGarantia.addEventListener('change', checkGarantiaStatus);

    const btnFecharExclusao = document.getElementById('close-exclusao-modal');
    const btnCancelarExclusao = document.getElementById('btn-cancelar-exclusao');
    const btnConfirmarExclusao = document.getElementById('btn-confirmar-exclusao');
    
    if (btnFecharExclusao) btnFecharExclusao.addEventListener('click', fecharModalExclusao);
    if (btnCancelarExclusao) btnCancelarExclusao.addEventListener('click', fecharModalExclusao);
    if (btnConfirmarExclusao) btnConfirmarExclusao.addEventListener('click', executarExclusaoManutencao);
}

function abrirModal(mode, manutencaoID = null) {
    currentEditID = null;
    document.getElementById('form-manutencao').reset();
    
    const modalTitle = document.getElementById('modal-title');
    const btnSalvar = document.getElementById('btn-salvar');

    if (mode === 'create') {
        modalTitle.textContent = 'Nova Solicitação de Manutenção';
        btnSalvar.textContent = 'Salvar Solicitação';
        document.getElementById('select-status').value = 'Pendente';
    } else {
        modalTitle.textContent = 'Editar Manutenção';
        btnSalvar.textContent = 'Salvar Alterações';
        currentEditID = manutencaoID;
        
        const manutencao = allManutencoes.find(m => m.ID === manutencaoID);
        if (manutencao) {
            preencherFormulario(manutencao);
        }
    }
    
    checkGarantiaStatus(); 
    document.getElementById('modal-manutencao').classList.add('active');
}

function fecharModal() {
    document.getElementById('modal-manutencao').classList.remove('active');
}

function fecharModalExclusao() {
    const modal = document.getElementById('modal-confirmar-exclusao');
    if (modal) modal.classList.remove('active');
    manutencaoParaExcluir = null;
}

function preencherFormulario(data) {
    document.getElementById('manutencao-id').value = data.ID;
    document.getElementById('input-codigo').value = data.CodigoManutencao || '';
    document.getElementById('select-cliente').value = data.ClienteID;
    document.getElementById('input-problema').value = data.ProblemaDefeito;
    document.getElementById('input-data-compra').value = data.DataCompra || '';
    document.getElementById('input-data-garantia').value = data.DataGarantia || '';
    document.getElementById('input-data-manutencao').value = data.DataManutencao || '';
    document.getElementById('select-responsavel').value = data.ResponsavelID || '';
    document.getElementById('select-status').value = data.Status || 'Pendente';
    document.getElementById('input-servico-realizado').value = data.ServicoRealizado || '';
    document.getElementById('input-observacoes').value = data.Observacoes || '';
    
    const valor = parseFloat(data.Valor || 0);
    document.getElementById('input-valor').value = valor.toFixed(2);

    checkGarantiaStatus(); 
}

function checkGarantiaStatus() {
    const garantiaInput = document.getElementById('input-data-garantia');
    const avisoEl = document.getElementById('garantia-status-aviso');
    
    if (!garantiaInput || !avisoEl) return;
    
    if (!garantiaInput.value) {
        avisoEl.style.display = 'none';
        return;
    }

    const dataGarantia = new Date(garantiaInput.value + "T00:00:00");
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (dataGarantia < hoje) {
        avisoEl.textContent = 'Atenção: A garantia deste produto está EXPIRADA.';
        avisoEl.className = 'aviso-garantia expirada';
        avisoEl.style.color = 'red';
    } else {
        avisoEl.textContent = 'Produto DENTRO do prazo de garantia.';
        avisoEl.className = 'aviso-garantia vigente';
        avisoEl.style.color = 'green';
    }
    avisoEl.style.display = 'block';
}

function renderTabela() {
    const tbody = document.getElementById('manutencoes-tbody');
    if (!tbody) return;

    const filtroStatus = document.getElementById('filter-status') ? document.getElementById('filter-status').value : 'todos';
    const searchInput = document.getElementById('search-input-main') || document.getElementById('search-input');
    const filtroSearch = searchInput ? searchInput.value.toLowerCase() : '';

    const filtradas = allManutencoes.filter(m => {
        const matchStatus = (filtroStatus === 'todos') || (m.Status === filtroStatus);
        const cod = m.CodigoManutencao ? m.CodigoManutencao.toLowerCase() : '';
        const cli = m.NomeCliente ? m.NomeCliente.toLowerCase() : '';
        const resp = m.NomeResponsavel ? m.NomeResponsavel.toLowerCase() : '';
        const matchSearch = cod.includes(filtroSearch) || cli.includes(filtroSearch) || resp.includes(filtroSearch);
        return matchStatus && matchSearch;
    });

    tbody.innerHTML = '';
    if (filtradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhuma solicitação encontrada.</td></tr>';
        return;
    }

    filtradas.sort((a, b) => b.ID - a.ID);

    filtradas.forEach(m => {
        const tr = document.createElement('tr');
        const statusClass = m.Status ? m.Status.toLowerCase().replace(/ /g, '-').replace('ç', 'c').replace('ã', 'a').replace('õ', 'o').replace('í', 'i') : 'pendente';
        const valorFormatado = formatarMoeda(m.Valor);

        tr.innerHTML = `
            <td><strong>${m.CodigoManutencao || m.ID}</strong></td>
            <td>${m.NomeCliente || 'Cliente não encontrado'}</td>
            <td>${m.ProblemaDefeito ? m.ProblemaDefeito.substring(0, 30) + '...' : ''}</td>
            <td>${formatarData(m.DataSolicitacao)}</td>
            <td>${m.NomeResponsavel || 'Não atribuído'}</td>
            <td><strong>${valorFormatado}</strong></td> 
            <td><span class="status-badge ${statusClass}">${m.Status}</span></td>
            <td class="text-center">
                <div class="table-actions">
                    <button class="action-button edit" onclick="abrirModal('edit', ${m.ID})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-button delete" onclick="confirmarExclusaoManutencao(${m.ID}, '${m.CodigoManutencao || m.ID}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function salvarManutencao(event) {
    event.preventDefault();
    const btnSalvar = document.getElementById('btn-salvar');
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    const payload = {
        ID: currentEditID ? parseInt(currentEditID) : null,
        ClienteID: parseInt(document.getElementById('select-cliente').value),
        ProblemaDefeito: document.getElementById('input-problema').value,
        DataCompra: document.getElementById('input-data-compra').value || null,
        DataGarantia: document.getElementById('input-data-garantia').value || null,
        ResponsavelID: document.getElementById('select-responsavel').value || null,
        Status: document.getElementById('select-status').value,
        DataManutencao: document.getElementById('input-data-manutencao').value || null,
        ServicoRealizado: document.getElementById('input-servico-realizado').value,
        Observacoes: document.getElementById('input-observacoes').value,
        Valor: parseFloat(document.getElementById('input-valor').value) || 0.00
    };

    let url = `${API_URL}/manutencoes`;
    let method = 'POST';

    if (currentEditID) {
        url = `${API_URL}/manutencoes/${currentEditID}`;
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
        await loadManutencoes();
        renderTabela();
        atualizarEstatisticasManutencoes();

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = currentEditID ? 'Salvar Alterações' : 'Salvar Solicitação';
    }
}

function confirmarExclusaoManutencao(id, codigo) {
    manutencaoParaExcluir = { id, codigo };
    
    const msg = document.getElementById('exclusao-mensagem');
    const destaque = document.getElementById('exclusao-orcamento-numero');
    
    if (msg) msg.textContent = "Tem certeza que deseja excluir esta manutenção?";
    if (destaque) destaque.textContent = codigo;
    
    const modal = document.getElementById('modal-confirmar-exclusao');
    if (modal) modal.classList.add('active');
}

async function executarExclusaoManutencao() {
    if (!manutencaoParaExcluir) return;

    const btnConfirmar = document.getElementById('btn-confirmar-exclusao');
    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Excluindo...';
    }

    try {
        const response = await fetch(`${API_URL}/manutencoes/${manutencaoParaExcluir.id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Falha ao excluir');
        }

        showNotification('Manutenção excluída com sucesso!', 'success');
        fecharModalExclusao();
        await loadManutencoes();
        renderTabela();
        atualizarEstatisticasManutencoes();

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.textContent = 'Sim, Excluir';
        }
        manutencaoParaExcluir = null;
    }
}

function formatarData(dataString) {
    if (!dataString) return 'N/A';
    const data = new Date(dataString);
    if (isNaN(data)) return dataString;
    return data.toLocaleDateString('pt-BR');
}

function formatarMoeda(valor) {
    if (typeof valor !== 'number') {
        valor = parseFloat(valor) || 0;
    }
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

function showNotification(message, type = 'info') {
    if (window.NotificationManager) {
        const title = type.charAt(0).toUpperCase() + type.slice(1);
        window.NotificationManager.show({ title: title, message: message, type: type });
    } else {
        alert(message);
    }
}

function getLoggedInUserID() {
    return localStorage.getItem('sinergy_user_id') || sessionStorage.getItem('sinergy_user_id');
}

function getLoggedInUserRole() {
    return localStorage.getItem('sinergy_user_role') || sessionStorage.getItem('sinergy_user_role');
}

window.abrirModal = abrirModal;
window.confirmarExclusaoManutencao = confirmarExclusaoManutencao;