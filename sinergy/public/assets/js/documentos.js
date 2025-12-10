document.addEventListener('DOMContentLoaded', () => {
    // Inicializa a lógica da página de documentos
    initializeAppDocumentos();
});

// ================= GLOBALS =================
let produtosGlobaisSinergy = []; // Armazena produtos da Sinergy
let clientesGlobaisSinergy = []; // Armazena clientes da Sinergy

// ##############################################################
// ### INICIALIZAÇÃO E EVENTOS
// ##############################################################

/**
 * Inicializa a página, carrega dados e configura listeners.
 */
async function initializeAppDocumentos() {
    // Listeners da página principal
    document.getElementById('btn-gerar-invoice').addEventListener('click', abrirModalInvoice);
    document.getElementById('close-invoice-modal').addEventListener('click', fecharModalInvoice);

    // Listeners do modal da Invoice
    document.getElementById('btn-imprimir-invoice').addEventListener('click', () => window.print());
    document.getElementById('addNewItemBtn').addEventListener('click', () => {
        const tbody = document.getElementById("invoiceItems");
        const newRow = createItemRow(tbody.querySelectorAll("tr").length + 1);
        tbody.appendChild(newRow);
    });

    // Listener para os botões de rádio (tipo de preço)
    document.querySelectorAll('input[name="precoTipo"]').forEach((radio) => {
        radio.addEventListener("change", atualizarPrecosNaTabela);
    });

    // Carrega dados da API da Sinergy
    try {
        // Carrega clientes (empresas)
        await carregarClientesSinergy();
        
        // Carrega produtos
        await carregarProdutosSinergy();
        
        // Adiciona a primeira linha na tabela (agora que os produtos estão carregados)
        const tbody = document.getElementById("invoiceItems");
        tbody.innerHTML = "";
        const firstRow = createItemRow(1);
        tbody.appendChild(firstRow);
        
    } catch (error) {
        if(window.NotificationManager) {
            window.NotificationManager.show({ title: 'Erro ao Carregar', message: `Não foi possível carregar dados: ${error.message}`, type: 'error' });
        }
    }
    
    // Configura datas editáveis
    setupDatasEditaveis();
}

/**
 * Abre o modal da invoice e reseta a primeira linha.
 */
function abrirModalInvoice() {
    const tbody = document.getElementById("invoiceItems");
    tbody.innerHTML = "";
    const firstRow = createItemRow(1);
    tbody.appendChild(firstRow);
    
    // Reseta o select de cliente
    document.getElementById("empresaSelect").value = "";
    limparCamposCliente();

    document.getElementById('modal-invoice').classList.add('active');
}

/**
 * Fecha o modal da invoice.
 */
function fecharModalInvoice() {
    document.getElementById('modal-invoice').classList.remove('active');
}

/**
 * Define as datas de hoje nos campos editáveis.
 */
function setupDatasEditaveis() {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', {
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
    }).replace(/, /g, ' ').replace(/ /g, '/'); // Formato: 15/Aug/2025

    document.getElementById('issueDate').textContent = formattedDate;
    document.getElementById('invoiceDate').textContent = formattedDate;
}

// ##############################################################
// ### CARREGAMENTO DE DADOS (API SINERGY)
// ##############################################################

/**
 * Carrega Clientes da API /api/clientes
 */
async function carregarClientesSinergy() {
    const userID = window.getLoggedInUserID();
    const userRole = window.getLoggedInUserRole();

    const res = await fetch(`/api/clientes?role=${userRole}&usuarioID=${userID}`);
    if (!res.ok) throw new Error('Falha ao carregar clientes');
    
    clientesGlobaisSinergy = await res.json();
    
    const select = document.getElementById("empresaSelect");
    select.innerHTML = "<option value=''>Selecione o Cliente (Buyer)...</option>";
    
    clientesGlobaisSinergy.forEach((cliente) => {
        const opt = document.createElement("option");
        opt.value = cliente.ID;
        opt.textContent = cliente.Nome;
        select.appendChild(opt);
    });

    // Adiciona o listener de mudança AQUI, após carregar
    select.addEventListener("change", () => {
        preencherDadosCliente(select.value);
    });
}

/**
 * Carrega Produtos da API /api/produtos
 */
async function carregarProdutosSinergy() {
    const res = await fetch("/api/produtos");
    if (!res.ok) throw new Error('Falha ao carregar produtos');
    
    const produtos = await res.json();

    // Mapeia os nomes de colunas da Sinergy para os nomes do script da Invoice
    produtosGlobaisSinergy = produtos.map((p) => ({
        id_item: p.ID,
        descricao: p.NomeItem,
        preco_unitario: parseFloat(p.PrecoSerralheria), // Mapeamento: Preço 1
        preco_cambio: parseFloat(p.PrecoConsumidor)    // Mapeamento: Preço 2
    }));
}

// ##############################################################
// ### LÓGICA DA INVOICE (Adaptada do seu script.js)
// ##############################################################

/**
 * Preenche os dados do cliente na invoice ao selecionar.
 */
function preencherDadosCliente(clienteID) {
    const cliente = clientesGlobaisSinergy.find((c) => c.ID == clienteID);
    if (!cliente) {
        limparCamposCliente();
        return;
    }

    document.getElementById("buyerName").textContent = cliente.Nome;
    document.getElementById("buyerAddress1").textContent = cliente.Endereco || '';
    document.getElementById("buyerAddress2").textContent = cliente.CidadeUF || '';
    document.getElementById("buyerCNPJ").textContent = cliente.Documento || '';
    document.getElementById("buyerTel").textContent = cliente.Contato || '';
    
    // Preenche também o campo "MARKS: TO:"
    document.getElementById("marksTo").textContent = cliente.Nome;
}

/**
 * Limpa os campos do cliente.
 */
function limparCamposCliente() {
    document.getElementById("buyerName").textContent = '';
    document.getElementById("buyerAddress1").textContent = '';
    document.getElementById("buyerAddress2").textContent = '';
    document.getElementById("buyerCNPJ").textContent = '';
    document.getElementById("buyerTel").textContent = '';
    document.getElementById("marksTo").textContent = '';
}

/**
 * Cria uma nova linha na tabela de itens.
 */
function createItemRow(index) {
    const row = document.createElement("tr");
    row.innerHTML = `
        <td class="item-no">${formatItemNumber(index)}</td>
        <td class="desc">
            <select class="produto-select form-control">
                <option value="">Selecione o produto...</option>
            </select>
            <span class="produto-nome"></span>
        </td>
        <td contenteditable="true" class="text-right qty">1</td>
        <td contenteditable="true" class="text-right price">$ 0.00</td>
        <td class="text-right amount">$ 0.00</td>
        <td class="no-print action-cell"><button class="delete-btn">X</button></td>
    `;

    const select = row.querySelector(".produto-select");
    const nomeSpan = row.querySelector(".produto-nome");

    // Preenche o select com produtos da Sinergy
    produtosGlobaisSinergy.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id_item;
        opt.textContent = p.descricao;
        select.appendChild(opt);
    });

    select.addEventListener("change", () => {
        const id = select.value;
        if (!id) {
            nomeSpan.textContent = "";
            nomeSpan.style.display = "none";
            row.querySelector(".price").textContent = "$ 0.00";
            updateTotals();
            return;
        }

        const produto = produtosGlobaisSinergy.find((p) => p.id_item == id);
        const tipoPreco = document.querySelector('input[name="precoTipo"]:checked').value;
        
        // Adaptação para os nomes de preço da Sinergy
        const preco = tipoPreco === "serralheria"
            ? produto.preco_unitario  // PrecoSerralheria
            : produto.preco_cambio;   // PrecoConsumidor
            
        const precoNum = parseFloat(preco) || 0;
        row.querySelector(".price").textContent = `$ ${precoNum.toFixed(2)}`;

        // Mostra nome do produto selecionado
        nomeSpan.textContent = produto.descricao;
        nomeSpan.style.display = "inline-block";

        updateTotals();
    });

    row.querySelector(".delete-btn").addEventListener("click", () => {
        row.remove();
        renumberItems();
        updateTotals();
    });

    row.querySelectorAll(".qty, .price").forEach((el) =>
        el.addEventListener("blur", updateTotals)
    );

    return row;
}

/**
 * Atualiza todos os preços na tabela ao mudar o tipo (Rádio button).
 */
function atualizarPrecosNaTabela() {
    const tipoPreco = document.querySelector('input[name="precoTipo"]:checked').value;
    
    document.querySelectorAll("#invoiceItems tr").forEach((row) => {
        const select = row.querySelector(".produto-select");
        const id = select.value;
        if (!id) return;
        
        const produto = produtosGlobaisSinergy.find((p) => p.id_item == id);
        if (!produto) return;
        
        const preco = tipoPreco === "serralheria"
            ? produto.preco_unitario  // PrecoSerralheria
            : produto.preco_cambio;   // PrecoConsumidor
            
        const precoNumerico = parseFloat(preco) || 0;
        row.querySelector(".price").textContent = `$ ${precoNumerico.toFixed(2)}`;
    });
    updateTotals();
}

/**
 * Formata um número (usado pelo seu script.js).
 */
function formatItemNumber(n) {
    const padded = String(n).padStart(3, "0");
    return `${padded}`; // Simplificado (ex: 001)
}

/**
 * Renumera os itens da tabela (usado pelo seu script.js).
 */
function renumberItems() {
    document.querySelectorAll("#invoiceItems tr").forEach((row, i) => {
        const cell = row.querySelector(".item-no");
        if (cell) cell.textContent = formatItemNumber(i + 1);
    });
}

/**
 * Atualiza os totais da invoice (adaptado do seu script.js).
 */
function updateTotals() {
    let total = 0;
    document.querySelectorAll("#invoiceItems tr").forEach((row) => {
        const qty = parseFloat(row.querySelector(".qty")?.textContent || "0");
        const price = parseFloat(
            row.querySelector(".price")?.textContent.replace(/[^0-9.,-]/g, "").replace(",", ".") || "0"
        );
        const amount = qty * price;
        total += amount;
        row.querySelector(".amount").textContent = `$ ${amount.toFixed(2)}`;
    });
    document.getElementById("totalFOB").textContent = `$ ${total.toFixed(2)}`;
    
    // (Opcional) Atualizar o valor por extenso (requer uma biblioteca extra)
    // document.getElementById("totalInWords").textContent = numberToWords(total);
}