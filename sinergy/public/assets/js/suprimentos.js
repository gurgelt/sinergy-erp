/**
 * suprimentos.js - Gestão de Compras e Fornecedores
 */

document.addEventListener('DOMContentLoaded', () => {
    initializeAppSuprimentos();
});

const API_URL = 'https://virtualcriacoes.com/sinergy/api';
let allCompras = [];
let allFornecedores = [];
let itensTempCompra = [];
let currentEditCompraID = null;
let currentEditFornecedorID = null;

// === FUNÇÕES DE VALIDAÇÃO E MÁSCARA ===

function aplicarMascaraCNPJ(valor) {
    // Remove tudo que não é número
    valor = valor.replace(/\D/g, '');

    // Limita a 14 dígitos
    valor = valor.substring(0, 14);

    // Aplica a máscara: XX.XXX.XXX/XXXX-XX
    if (valor.length <= 2) {
        return valor;
    } else if (valor.length <= 5) {
        return valor.replace(/(\d{2})(\d+)/, '$1.$2');
    } else if (valor.length <= 8) {
        return valor.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
    } else if (valor.length <= 12) {
        return valor.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
    } else {
        return valor.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, '$1.$2.$3/$4-$5');
    }
}

function validarCNPJ(cnpj) {
    // Remove caracteres não numéricos
    cnpj = cnpj.replace(/\D/g, '');

    // Verifica se tem 14 dígitos
    if (cnpj.length !== 14) return false;

    // Verifica se todos os dígitos são iguais (ex: 11.111.111/1111-11)
    if (/^(\d)\1+$/.test(cnpj)) return false;

    // Validação dos dígitos verificadores
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }

    let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(0)) return false;

    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }

    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(1)) return false;

    return true;
}

function aplicarMascaraCEP(valor) {
    // Remove tudo que não é número
    valor = valor.replace(/\D/g, '');

    // Limita a 8 dígitos
    valor = valor.substring(0, 8);

    // Aplica a máscara: XXXXX-XXX
    if (valor.length <= 5) {
        return valor;
    } else {
        return valor.replace(/(\d{5})(\d+)/, '$1-$2');
    }
}

async function buscarEnderecoPorCEP(cep) {
    // Remove caracteres não numéricos
    const cepLimpo = cep.replace(/\D/g, '');

    // Verifica se tem 8 dígitos
    if (cepLimpo.length !== 8) {
        return null;
    }

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);

        if (!response.ok) {
            throw new Error('Erro ao buscar CEP');
        }

        const data = await response.json();

        // ViaCEP retorna erro: true quando CEP não existe
        if (data.erro) {
            return null;
        }

        return {
            logradouro: data.logradouro || '',
            bairro: data.bairro || '',
            cidade: `${data.localidade}/${data.uf}`,
            uf: data.uf || ''
        };
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        return null;
    }
}

async function initializeAppSuprimentos() {
    const userId = window.getLoggedInUserID ? window.getLoggedInUserID() : null;
    if (!userId) return;

    setupEventListenersSuprimentos();
    await Promise.all([loadCompras(), loadFornecedores()]);
    
    const loader = document.getElementById('loader-overlay');
    if (loader) loader.style.display = 'none';
}

async function loadCompras() {
    try {
        const response = await fetch(`${API_URL}/suprimentos/compras`);
        if (!response.ok) throw new Error('Erro ao carregar pedidos');
        allCompras = await response.json();
        allCompras.forEach(c => { if(!c.itens) c.itens = []; });
        renderTabelaCompras();
        atualizarKPIs();
    } catch (error) { console.error(error); }
}

async function loadFornecedores() {
    try {
        const res = await fetch(`${API_URL}/fornecedores`);
        if(res.ok) allFornecedores = await res.json();
    } catch (e) { console.error("Erro ao carregar fornecedores", e); }
}

function setupEventListenersSuprimentos() {
    // Pedidos
    document.getElementById('btn-nova-compra').addEventListener('click', () => abrirModalCompra('create'));
    document.getElementById('close-modal-compra').addEventListener('click', fecharModalCompra);
    document.getElementById('btn-cancelar-compra').addEventListener('click', fecharModalCompra);
    document.getElementById('form-compra').addEventListener('submit', salvarCompra);
    document.getElementById('btn-add-item').addEventListener('click', adicionarItemCompra);
    
    // Filtros
    document.getElementById('filter-search').addEventListener('input', renderTabelaCompras);
    document.getElementById('filter-status').addEventListener('change', renderTabelaCompras);
    
    // Fornecedores
    document.getElementById('btn-gerenciar-fornecedores').addEventListener('click', abrirListaFornecedores);
    document.getElementById('close-lista-fornecedores').addEventListener('click', () => document.getElementById('modal-lista-fornecedores').classList.remove('active'));
    document.getElementById('btn-novo-fornecedor-modal').addEventListener('click', () => abrirModalFornecedor());
    
    document.getElementById('close-fornecedor-form').addEventListener('click', () => document.getElementById('modal-fornecedor-form').classList.remove('active'));
    document.getElementById('btn-cancelar-fornecedor').addEventListener('click', () => document.getElementById('modal-fornecedor-form').classList.remove('active'));
    document.getElementById('form-fornecedor').addEventListener('submit', salvarFornecedor);
    document.getElementById('search-fornecedor-lista').addEventListener('input', renderTabelaFornecedores);

    // Máscara e validação de CNPJ
    const campoCNPJ = document.getElementById('f-cnpj');
    campoCNPJ.addEventListener('input', (e) => {
        e.target.value = aplicarMascaraCNPJ(e.target.value);
    });
    campoCNPJ.addEventListener('blur', (e) => {
        const cnpj = e.target.value.replace(/\D/g, '');
        if (cnpj.length > 0 && !validarCNPJ(cnpj)) {
            e.target.style.borderColor = '#e74c3c';
            showNotification('CNPJ inválido', 'warning');
        } else {
            e.target.style.borderColor = '';
        }
    });

    // Máscara e busca automática de CEP
    const campoCEP = document.getElementById('f-cep');
    campoCEP.addEventListener('input', (e) => {
        e.target.value = aplicarMascaraCEP(e.target.value);
    });
    campoCEP.addEventListener('blur', async (e) => {
        const cep = e.target.value.replace(/\D/g, '');

        if (cep.length === 8) {
            // Mostrar feedback visual de loading
            e.target.style.borderColor = '#3498db';
            const enderecoField = document.getElementById('f-endereco');
            const cidadeField = document.getElementById('f-cidade');

            const originalEnderecoPlaceholder = enderecoField.placeholder;
            enderecoField.placeholder = 'Buscando endereço...';

            const endereco = await buscarEnderecoPorCEP(cep);

            if (endereco) {
                // Preencher campos automaticamente
                enderecoField.value = endereco.logradouro + (endereco.bairro ? ', ' + endereco.bairro : '');
                cidadeField.value = endereco.cidade;
                e.target.style.borderColor = '#27ae60';
                showNotification('Endereço encontrado!', 'success');
            } else {
                e.target.style.borderColor = '#e74c3c';
                showNotification('CEP não encontrado', 'warning');
            }

            enderecoField.placeholder = originalEnderecoPlaceholder;
        } else if (cep.length > 0 && cep.length < 8) {
            e.target.style.borderColor = '#e74c3c';
            showNotification('CEP incompleto', 'warning');
        } else {
            e.target.style.borderColor = '';
        }
    });

    // Autocomplete
    const inpForn = document.getElementById('input-fornecedor');
    inpForn.addEventListener('input', (e) => showSuggestions(e.target.value));
    inpForn.addEventListener('focus', (e) => showSuggestions(e.target.value));
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.input-group-search')) document.getElementById('sugestoes-fornecedor').style.display = 'none';
    });
}

// === LÓGICA DE FORNECEDORES ===

function abrirListaFornecedores() {
    renderTabelaFornecedores();
    document.getElementById('modal-lista-fornecedores').classList.add('active');
}

function renderTabelaFornecedores() {
    const term = document.getElementById('search-fornecedor-lista').value.toLowerCase();
    const tbody = document.getElementById('tbody-fornecedores');
    tbody.innerHTML = '';
    
    const filtrados = allFornecedores.filter(f => f.NomeFantasia.toLowerCase().includes(term) || f.CNPJ.includes(term));
    
    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum fornecedor encontrado.</td></tr>';
        return;
    }

    filtrados.forEach(f => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${f.NomeFantasia}</td>
            <td>${f.CNPJ}</td>
            <td>${f.TipoFornecedor}</td>
            <td>${f.Cidade || '-'}</td>
            <td class="text-center">
                <button class="btn-icon" onclick="abrirModalFornecedor(${f.ID})"><i class="fas fa-edit"></i></button>
                <button class="btn-icon" onclick="excluirFornecedor(${f.ID})" style="color:#e74c3c;"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function abrirModalFornecedor(id = null) {
    const modal = document.getElementById('modal-fornecedor-form');
    document.getElementById('form-fornecedor').reset();
    currentEditFornecedorID = id;
    
    if (id) {
        const f = allFornecedores.find(x => x.ID === id);
        if(f) {
            document.getElementById('title-fornecedor-form').textContent = 'Editar Fornecedor';
            document.getElementById('f-nome').value = f.NomeFantasia;
            document.getElementById('f-cnpj').value = f.CNPJ;
            document.getElementById('f-razao').value = f.RazaoSocial;
            document.getElementById('f-endereco').value = f.Endereco;
            document.getElementById('f-cep').value = f.CEP;
            document.getElementById('f-cidade').value = f.Cidade;
            document.getElementById('f-tipo').value = f.TipoFornecedor;
        }
    } else {
        document.getElementById('title-fornecedor-form').textContent = 'Novo Fornecedor';
    }
    modal.classList.add('active');
}

async function salvarFornecedor(e) {
    e.preventDefault();
    const payload = {
        NomeFantasia: document.getElementById('f-nome').value,
        CNPJ: document.getElementById('f-cnpj').value,
        RazaoSocial: document.getElementById('f-razao').value,
        Endereco: document.getElementById('f-endereco').value,
        CEP: document.getElementById('f-cep').value,
        Cidade: document.getElementById('f-cidade').value,
        TipoFornecedor: document.getElementById('f-tipo').value
    };

    // Validar CNPJ antes de enviar
    const cnpjLimpo = payload.CNPJ.replace(/\D/g, '');
    if (!validarCNPJ(cnpjLimpo)) {
        showNotification('CNPJ inválido. Verifique o número digitado.', 'error');
        document.getElementById('f-cnpj').style.borderColor = '#e74c3c';
        document.getElementById('f-cnpj').focus();
        return;
    }

    let url = `${API_URL}/fornecedores`;
    let method = 'POST';
    if (currentEditFornecedorID) {
        url += `/${currentEditFornecedorID}`;
        method = 'PUT';
    }

    try {
        const res = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showNotification('Fornecedor salvo!', 'success');
            document.getElementById('modal-fornecedor-form').classList.remove('active');
            await loadFornecedores();
            renderTabelaFornecedores();
        } else {
            // Pegar mensagem específica do backend
            const errorData = await res.json();
            const errorMessage = errorData.error || 'Erro ao salvar fornecedor';
            showNotification(errorMessage, 'error');
        }
    } catch(e) {
        showNotification('Erro ao processar requisição', 'error');
    }
}

async function excluirFornecedor(id) {
    if(!confirm('Excluir fornecedor?')) return;
    try {
        const res = await fetch(`${API_URL}/fornecedores/${id}`, {method:'DELETE'});
        if(res.ok) {
            showNotification('Excluído!', 'success');
            await loadFornecedores();
            renderTabelaFornecedores();
        }
    } catch(e) { showNotification('Erro', 'error'); }
}

// === AUTOCOMPLETE ===
function showSuggestions(term) {
    const box = document.getElementById('sugestoes-fornecedor');
    box.innerHTML = '';
    const termL = term.toLowerCase();
    
    // Adicionar opção de cadastrar se não vazio
    if (term.length > 0) {
        const divNew = document.createElement('div');
        divNew.className = 'autocomplete-suggestion';
        divNew.innerHTML = `<i class="fas fa-plus-circle" style="color:#27ae60"></i> Cadastrar "${term}"`;
        divNew.onclick = () => {
            box.style.display = 'none';
            abrirModalFornecedor();
            document.getElementById('f-nome').value = term;
        };
        box.appendChild(divNew);
    }

    const matches = allFornecedores.filter(f => f.NomeFantasia.toLowerCase().includes(termL));
    matches.forEach(f => {
        const div = document.createElement('div');
        div.className = 'autocomplete-suggestion';
        div.textContent = f.NomeFantasia;
        div.onclick = () => {
            document.getElementById('input-fornecedor').value = f.NomeFantasia;
            box.style.display = 'none';
        };
        box.appendChild(div);
    });
    
    box.style.display = 'block';
}

// === PEDIDOS ===
function abrirModalCompra(mode, id = null) {
    const modal = document.getElementById('modal-compra');
    document.getElementById('form-compra').reset();
    itensTempCompra = [];
    currentEditCompraID = null;
    document.getElementById('input-data-pedido').valueAsDate = new Date();

    if (mode === 'create') {
        document.getElementById('modal-title-compra').textContent = 'Novo Pedido';
        document.getElementById('input-status').value = 'Solicitado';
        document.getElementById('input-numero').value = 'AUTO-' + Date.now().toString().slice(-6);
    } else {
        currentEditCompraID = id;
        const compra = allCompras.find(c => c.id == id);
        if (compra) preencherFormularioCompra(compra);
    }
    renderTabelaItensCompra();
    atualizarTotalCompra();
    modal.classList.add('active');
}

function fecharModalCompra() { document.getElementById('modal-compra').classList.remove('active'); }

function preencherFormularioCompra(data) {
    document.getElementById('input-fornecedor').value = data.fornecedor;
    document.getElementById('input-numero').value = data.numero;
    document.getElementById('input-data-pedido').value = data.dataPedido;
    document.getElementById('input-data-entrega').value = data.dataEntrega || '';
    document.getElementById('input-status').value = data.status;
    document.getElementById('input-obs').value = data.obs;
    itensTempCompra = data.itens.map(i => ({
        nome: i.NomeItem, qtd: parseFloat(i.Quantidade), unidade: i.Unidade, valor: parseFloat(i.ValorUnitario), total: parseFloat(i.ValorTotal)
    }));
}

function adicionarItemCompra() {
    const nome = document.getElementById('item-nome').value;
    const qtd = parseFloat(document.getElementById('item-qtd').value);
    const valor = parseFloat(document.getElementById('item-valor').value);
    if (!nome || !qtd || !valor) return showNotification('Preencha os dados do item', 'warning');
    
    itensTempCompra.push({ nome, qtd, unidade: document.getElementById('item-unidade').value, valor, total: qtd * valor });
    document.getElementById('item-nome').value = '';
    renderTabelaItensCompra();
    atualizarTotalCompra();
}

function renderTabelaItensCompra() {
    const tbody = document.getElementById('tbody-itens-compra');
    tbody.innerHTML = '';
    itensTempCompra.forEach((item, index) => {
        tbody.innerHTML += `<tr><td>${item.nome}</td><td class="text-right">${item.qtd}</td><td class="text-right">${formatarMoeda(item.valor)}</td><td class="text-right">${formatarMoeda(item.total)}</td><td class="text-center"><button type="button" class="action-button delete" onclick="removerItemCompra(${index})"><i class="fas fa-trash"></i></button></td></tr>`;
    });
}
window.removerItemCompra = function(i) { itensTempCompra.splice(i, 1); renderTabelaItensCompra(); atualizarTotalCompra(); };

function atualizarTotalCompra() {
    const total = itensTempCompra.reduce((acc, item) => acc + item.total, 0);
    document.getElementById('total-pedido').textContent = formatarMoeda(total);
}

async function salvarCompra(e) {
    e.preventDefault();
    const payload = {
        numero: document.getElementById('input-numero').value,
        fornecedor: document.getElementById('input-fornecedor').value,
        dataPedido: document.getElementById('input-data-pedido').value,
        dataEntrega: document.getElementById('input-data-entrega').value || null,
        status: document.getElementById('input-status').value,
        obs: document.getElementById('input-obs').value,
        itens: itensTempCompra,
        valorTotal: itensTempCompra.reduce((acc, i) => acc + i.total, 0)
    };
    let url = `${API_URL}/suprimentos/compras`;
    let method = 'POST';
    if (currentEditCompraID) { url += `/${currentEditCompraID}`; method = 'PUT'; }
    
    try {
        const res = await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error('Erro ao salvar');
        showNotification('Pedido salvo!', 'success');
        fecharModalCompra();
        loadCompras();
    } catch(e) { showNotification(e.message, 'error'); }
}

function renderTabelaCompras() {
    const tbody = document.getElementById('compras-tbody');
    const search = document.getElementById('filter-search').value.toLowerCase();
    const statusFilter = document.getElementById('filter-status').value;
    
    const filtrados = allCompras.filter(c => {
        const matchS = (c.fornecedor||'').toLowerCase().includes(search) || (c.numero||'').toLowerCase().includes(search);
        const matchSt = statusFilter === 'todos' || c.status === statusFilter;
        return matchS && matchSt;
    });

    tbody.innerHTML = '';
    if (filtrados.length === 0) return tbody.innerHTML = '<tr><td colspan="7" class="text-center">Vazio.</td></tr>';

    filtrados.forEach(c => {
        tbody.innerHTML += `<tr><td><strong>${c.numero}</strong></td><td>${c.fornecedor}</td><td>${formatarData(c.dataPedido)}</td><td>${formatarData(c.dataEntrega)}</td><td><strong>${formatarMoeda(c.valorTotal)}</strong></td><td><span class="status-badge ${c.status.toLowerCase()}">${c.status}</span></td><td class="text-center"><button class="action-button edit" onclick="abrirModalCompra('edit', ${c.id})"><i class="fas fa-edit"></i></button></td></tr>`;
    });
}

function atualizarKPIs() { /* Mesma lógica anterior */ }
function formatarMoeda(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); }
function formatarData(d) { if(!d) return '-'; return new Date(d).toLocaleDateString('pt-BR'); }
function showNotification(msg, type) { if (window.NotificationManager) window.NotificationManager.show({ title: type, message: msg, type: type }); else alert(msg); }
window.abrirModalCompra = abrirModalCompra;