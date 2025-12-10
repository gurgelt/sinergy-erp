# 🏢 Sistema Sinergy ERP

Sistema completo de Gestão Empresarial (ERP) desenvolvido para controle integrado de operações comerciais, produção, estoque e financeiro.

> **⚠️ NOTA IMPORTANTE PARA NOVOS DESENVOLVEDORES:**
> Este documento foi criado para facilitar a continuidade do desenvolvimento.
> Leia com atenção toda a documentação antes de fazer modificações no código.

---

## 📋 Índice

1. [Visão Geral do Sistema](#-visão-geral-do-sistema)
2. [Arquitetura e Tecnologias](#-arquitetura-e-tecnologias)
3. [Estrutura de Diretórios](#-estrutura-de-diretórios)
4. [Banco de Dados](#-banco-de-dados)
5. [Módulos do Sistema](#-módulos-do-sistema)
6. [Fluxos de Negócio](#-fluxos-de-negócio)
7. [API REST](#-api-rest)
8. [Frontend](#-frontend)
9. [Segurança](#-segurança)
10. [Deploy e Configuração](#-deploy-e-configuração)
11. [Desenvolvimento](#-desenvolvimento)
12. [Troubleshooting](#-troubleshooting)

---

## 🎯 Visão Geral do Sistema

O **Sinergy ERP** é um sistema de gestão empresarial completo desenvolvido especificamente para empresas que fabricam produtos de alumínio (portas, janelas, portões automáticos, etc).

### Principais Características

- ✅ **100% Web-based** - Funciona em qualquer navegador moderno
- ✅ **API REST** - Backend totalmente em JSON
- ✅ **Multi-usuário** - Sistema de permissões granular por módulo
- ✅ **Fluxo Integrado** - Orçamento → Pedido → Produção → Expedição → Financeiro
- ✅ **Rastreabilidade Total** - Histórico completo de todas as operações
- ✅ **Multi-localização** - Estoque com suporte a múltiplos armazéns

### Estatísticas do Código

```
📊 Backend (PHP)
├── API Router: 571 linhas (api/index.php)
├── Handlers: 1831 linhas (legacy_functions.php)
├── Estoque: 350+ linhas (estoque_produtos_handlers.php)
└── Total: 87+ endpoints REST

📊 Frontend (JavaScript)
├── 30+ módulos JavaScript
├── 28 páginas HTML
└── 31 arquivos CSS

📊 Banco de Dados
├── 29 tabelas
├── 150+ campos
└── Suporte completo a transações ACID
```

---

## 🏗️ Arquitetura e Tecnologias

### Stack Tecnológico

#### Backend
- **PHP 7.4+** - Linguagem principal
- **MySQL 5.7+** - Banco de dados relacional
- **MySQLi** - Driver de conexão com prepared statements
- **Apache 2.4+** - Servidor web com mod_rewrite

#### Frontend
- **HTML5** - Estrutura das páginas
- **CSS3** - Estilização (Grid, Flexbox, Animations)
- **JavaScript Vanilla** - Sem frameworks (performance)
- **Chart.js** - Gráficos e dashboards
- **Font Awesome 6.4** - Ícones

### Padrões Arquiteturais

#### Backend - API REST
```
┌─────────────────────────────────────────────────────────┐
│  Frontend (JavaScript)                                  │
│  fetch('API_URL/endpoint', {method, body})              │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP JSON
┌──────────────────────▼──────────────────────────────────┐
│  Apache + .htaccess                                     │
│  RewriteRule → /api/index.php                           │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  API Router (api/index.php)                             │
│  ├─ Parse URL, Method, JSON                             │
│  ├─ switch(true) { case $path === '/endpoint': }        │
│  └─ Chama handler correspondente                        │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Handlers (legacy_functions.php)                        │
│  ├─ Conecta MySQL (MySQLi)                              │
│  ├─ Executa query (prepared statement)                  │
│  ├─ Processa resultado                                  │
│  └─ sendJsonResponse($data, $statusCode)                │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Banco de Dados MySQL                                   │
│  29 tabelas com relacionamentos FK                      │
└─────────────────────────────────────────────────────────┘
```

#### Frontend - SPA Modular
```
┌─────────────────────────────────────────────────────────┐
│  index.html (Layout Principal)                          │
│  ├─ Header (logo, menu, notificações)                   │
│  ├─ Sidebar (navegação por módulos)                     │
│  └─ Content Area (carrega páginas dinâmicas)            │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Páginas Modulares (pages/*.html)                       │
│  ├─ orcamentos.html                                     │
│  ├─ pedidos.html                                        │
│  ├─ financeiro.html                                     │
│  └─ ... (28 páginas)                                    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Scripts JS (assets/js/*.js)                            │
│  ├─ Faz fetch() para API                                │
│  ├─ Renderiza dados em tabelas/forms                    │
│  ├─ Valida formulários                                  │
│  └─ Gerencia estado local                               │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Estrutura de Diretórios

```
sinergy/
│
├── 📄 .env.example          # Template de configuração
├── 📄 .gitignore            # Arquivos ignorados pelo Git
├── 📄 .htaccess             # Configurações Apache (root)
├── 📄 README.md             # Este arquivo
├── 📄 DATABASE.md           # Documentação detalhada do banco
│
├── 📂 api/                  # API REST
│   ├── index.php           # ⭐ ROUTER PRINCIPAL (87+ endpoints)
│   └── .htaccess           # Rewrite rules da API
│
├── 📂 config/               # Configurações do Sistema
│   ├── config.php          # Constantes globais (DB_*, APP_*)
│   ├── database.php        # Conexão MySQLi
│   └── cors.php            # Headers CORS
│
├── 📂 src/                  # Código-fonte Backend
│   │
│   ├── 📄 autoload.php              # PSR-4 Autoloader
│   ├── 📄 legacy_functions.php      # ⭐ 87 HANDLERS (1831 linhas)
│   ├── 📄 estoque_produtos_handlers.php  # Handlers de estoque
│   │
│   ├── 📂 Controllers/              # Classes controller (futuro)
│   │   └── BaseController.php
│   │
│   └── 📂 Utils/                    # Classes utilitárias
│       ├── Response.php             # Padronização de JSON
│       ├── Security.php             # Hash, tokens, sanitização
│       ├── Validation.php           # Validação CPF, CNPJ, email
│       └── helpers.php              # Funções auxiliares
│
├── 📂 public/               # Arquivos Públicos (Frontend)
│   │
│   ├── index.html          # ⭐ PÁGINA PRINCIPAL
│   ├── .htaccess
│   │
│   ├── 📂 pages/           # Páginas HTML dos módulos (28 arquivos)
│   │   ├── login.html
│   │   ├── orcamentos.html
│   │   ├── pedidos.html
│   │   ├── estoque.html
│   │   ├── financeiro.html
│   │   └── ... (23+ páginas)
│   │
│   └── 📂 assets/          # Recursos Estáticos
│       │
│       ├── 📂 css/         # Estilos (31 arquivos)
│       │   ├── base.css              # Reset e variáveis CSS
│       │   ├── layout.css            # Grid e estrutura
│       │   ├── components.css        # Botões, cards, modais
│       │   └── modules/*.css         # Estilos por módulo
│       │
│       ├── 📂 js/          # Scripts JavaScript (30+ arquivos)
│       │   ├── app.js                # ⭐ CORE (autenticação, menu)
│       │   ├── orcamentos.js
│       │   ├── pedidos.js
│       │   ├── estoque.js
│       │   └── ... (27+ módulos)
│       │
│       └── 📂 images/      # Logos e ícones
│           └── logo.png
│
└── 📂 logs/                # Logs do Sistema (777 permissions)
    ├── debug.log           # Logs de debug
    ├── errors.log          # Erros PHP
    └── api.log             # Requisições API
```

### 🔑 Arquivos Críticos (Não Modifique Sem Entender)

| Arquivo | Descrição | Linhas | Importância |
|---------|-----------|--------|-------------|
| `api/index.php` | Router da API | 571 | 🔴 CRÍTICO |
| `src/legacy_functions.php` | Handlers principais | 1831 | 🔴 CRÍTICO |
| `src/estoque_produtos_handlers.php` | Handlers de estoque | 350+ | 🟡 IMPORTANTE |
| `config/database.php` | Conexão MySQL | 50 | 🔴 CRÍTICO |
| `public/assets/js/app.js` | Core do frontend | 400+ | 🔴 CRÍTICO |

---

## 🗄️ Banco de Dados

### Visão Geral

O banco de dados possui **29 tabelas** organizadas em módulos funcionais.

> 📖 **Para documentação completa do banco, consulte:** [DATABASE.md](./DATABASE.md)

### Tabelas Principais

#### Módulo Comercial
- `Usuarios` - Login e controle de acesso
- `Clientes` - Cadastro de clientes
- `Orcamentos` - Orçamentos de venda
- `ItensOrcamento` - Itens de cada orçamento
- `Pedidos` - Pedidos de venda
- `ItensPedido` - Itens de cada pedido

#### Módulo Estoque
- `Produtos` - Catálogo de produtos
- `EstoqueProdutos` - Saldos (multi-localização)
- `MovimentacoesEstoqueProdutos` - Histórico
- `Bobinas` - Matéria-prima (alumínio/aço)
- `BobinasUtilizadas` - Consumo na produção

#### Módulo Financeiro
- `ContasPagar` - Despesas e fornecedores
- `ContasReceber` - Receitas de pedidos

#### Módulo RH
- `Funcionarios` - Cadastro de funcionários
- `Permissoes` - Controle de acesso por módulo

### Relacionamentos Críticos

```
Orcamentos (1) ──→ (N) ItensOrcamento
     │
     │ (ao aprovar)
     ↓
Pedidos (1) ──→ (N) ItensPedido
     │
     ├──→ ContasReceber (financeiro)
     │
     └──→ Fila de Produção
           │
           ├──→ BobinasUtilizadas (rastreio)
           │
           └──→ Fila de Expedição
```

---

## 🎛️ Módulos do Sistema

### 1. 🔐 Autenticação e Usuários

**Funcionalidades:**
- Login/Logout com hash bcrypt
- Recuperação de senha via email
- Perfis: Admin, Gerente, Vendedor, Operador
- Controle de permissões por módulo

**Arquivos:**
- Backend: `handleLogin()`, `handleRegister()`, `handleRecoverPassword()`
- Frontend: `login.html`, `login.js`
- Tabelas: `Usuarios`, `Permissoes`

---

### 2. 💼 Comercial - Orçamentos e Pedidos

**Fluxo Completo:**

```
1. Vendedor cria ORÇAMENTO
   ├─ Seleciona cliente
   ├─ Adiciona produtos com medidas
   ├─ Assistente técnico calcula peso/motor
   └─ Salva como "Pendente"

2. Gerente APROVA orçamento
   ├─ Sistema gera PEDIDO automaticamente
   ├─ Copia todos os itens
   ├─ Cria conta a receber (financeiro)
   └─ Status: "Aguardando Produção"

3. Produção recebe o pedido
   └─ Itens entram na fila de produção
```

**Assistente Técnico de Orçamentos:**
- Calcula peso de lâminas automaticamente
- Sugere motor apropriado baseado em peso/altura
- Valida dimensões técnicas

**Arquivos:**
- Backend: `handleAddOrcamento()`, `handleUpdateOrcamento()` (⭐ CRÍTICA)
- Frontend: `orcamentos.html`, `orcamentos.js`, `pedidos.html`
- Tabelas: `Orcamentos`, `ItensOrcamento`, `Pedidos`, `ItensPedido`

---

### 3. 🏭 Produção e Expedição

**Fluxo de Produção:**

```
FILA DE PRODUÇÃO
├─ Lista itens com StatusProducao = 'Pendente'
├─ Operador seleciona item
├─ Registra bobinas utilizadas
├─ Registra sucata gerada
└─ Marca como 'Concluido'
    ↓
FILA DE EXPEDIÇÃO
├─ Lista itens com StatusProducao = 'Concluido'
│                   StatusExpedicao = 'Pendente'
├─ Operador separa item
└─ Marca como 'Separado'
    ↓
PEDIDO CONCLUÍDO
└─ Quando todos os itens estão separados
```

**Rastreabilidade:**
- Cada item produzido registra quais bobinas foram usadas
- Peso de material consumido vs. sucata gerada
- Histórico completo de produção

**Arquivos:**
- Backend: `handleGetFilaProducao()`, `handleBaixarItemProducao()`
- Frontend: `produtos.html`, `expedicao.html`
- Tabelas: `ItensPedido`, `BobinasUtilizadas`

---

### 4. 📦 Estoque

#### Estoque de Bobinas (Matéria-Prima)
- Bobinas de alumínio/aço
- Rastreamento: Peso, Espessura, Largura, Lote, Fornecedor
- Status: Disponível, Em Uso, Esgotado

#### Estoque de Produtos (Multi-Localização)
- Produtos acabados prontos para venda
- Suporte a múltiplos armazéns/localizações
- Status automático: Normal, Baixo, Crítico, Zerado
- Movimentações: Entrada, Saída, Ajuste, Transferência

**Arquivos:**
- Backend: `estoque_produtos_handlers.php` (especializado)
- Frontend: `estoque.html`, `estoque-produtos.html`
- Tabelas: `Bobinas`, `EstoqueProdutos`, `MovimentacoesEstoqueProdutos`

---

### 5. 💰 Financeiro

**Dashboards e KPIs:**
- DRE (Demonstrativo de Resultado)
- Lucro Bruto/Líquido
- Inadimplência
- Gráficos de receitas vs. despesas

**Contas a Pagar:**
- Entrada manual de despesas
- Categorias, fornecedores, vencimentos
- Controle de pagamentos

**Contas a Receber:**
- Geradas automaticamente ao criar pedido
- Vencimento padrão: +30 dias
- Controle de recebimentos

**Arquivos:**
- Backend: `handleGetFinanceiroDashboard()`, `handleGetContasPagar()`
- Frontend: `financeiro.html`, `contasapagar.html`, `contasareceber.html`
- Tabelas: `ContasPagar`, `ContasReceber`

---

### 6. 🌍 COMEX (Comércio Exterior)

**Rastreamento de Containers:**
- Número do container
- Armador (transportadora)
- Mercadoria
- ETA (Estimated Time of Arrival)
- Status: 6 etapas (Coletado → Em Trânsito → Porto → Desembarque → Entregue)

**Arquivos:**
- Backend: `handleGetRastreio()`, `handleUpdateRastreio()`
- Frontend: `rastreio.html`
- Tabelas: `RastreioContainers`

---

### 7. 👥 RH e Funcionários

- Cadastro completo de funcionários
- Vínculo com usuários do sistema
- Documentos: CPF, RG, PIS, Título de Eleitor
- Dados bancários para pagamento
- Upload de foto (Base64)

**Arquivos:**
- Backend: `handleGetFuncionarios()`, `handleAddFuncionario()`
- Frontend: `funcionarios.html`
- Tabelas: `Funcionarios`

---

### 8. 🛒 Suprimentos e Compras

**Fluxo de Compra:**

```
1. Solicitação de Compra
   ├─ Usuário solicita material
   ├─ Status: Pendente
   └─ Aguarda aprovação

2. Cotação (3 fornecedores)
   ├─ Comprador preenche preços
   ├─ Seleciona vencedor
   └─ Status: Aprovada

3. Pedido de Compra
   ├─ Gera pedido para fornecedor
   ├─ Acompanha entrega
   └─ Status: Entregue
```

**Arquivos:**
- Backend: `handleGetSolicitacoesCompras()`, `handleAddPedidoCompra()`
- Frontend: `compras.html`, `suprimentos.html`
- Tabelas: `SolicitacoesCompras`, `PedidosCompra`

---

### 9. 📝 Notas Fiscais (XML NFe)

- Upload de XML de Notas Fiscais Eletrônicas
- Parsing automático dos dados
- Importação para estoque
- Validação de estrutura XML

**Arquivos:**
- Backend: `handleImportarXMLNFe()`
- Frontend: `notas_fiscais.html`
- Tabelas: `NotasFiscais`, `ItensNotaFiscal`

---

### 10. 💬 Chat Interno

- Mensagens entre usuários do sistema
- Status online/offline (heartbeat a cada 5s)
- Notificações de novas mensagens
- Widget flutuante no canto da tela

**Arquivos:**
- Backend: `handleEnviarMensagem()`, `handleGetChatMensagens()`
- Frontend: `chat.html`, `chat-widget.html`
- Tabelas: `ChatMensagens`

---

## 🔄 Fluxos de Negócio

### Fluxo Completo: Da Venda ao Faturamento

```
┌─────────────────────────────────────────────────────────────┐
│ 1. COMERCIAL - Criação de Orçamento                        │
├─────────────────────────────────────────────────────────────┤
│ ▸ Vendedor acessa módulo de Orçamentos                     │
│ ▸ Preenche dados do cliente                                │
│ ▸ Adiciona produtos (quantidade, medidas, valores)         │
│ ▸ Sistema calcula totais automaticamente                   │
│ ▸ Salva orçamento com status: "Pendente"                   │
│                                                             │
│ 📊 Tabelas: Orcamentos + ItensOrcamento                    │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. APROVAÇÃO - Conversão em Pedido                         │
├─────────────────────────────────────────────────────────────┤
│ ▸ Gerente revisa orçamento                                 │
│ ▸ Clica em "Aprovar"                                       │
│ ▸ Sistema AUTOMATICAMENTE:                                 │
│   ├─ Cria registro em Pedidos                              │
│   ├─ Copia todos os itens para ItensPedido                 │
│   ├─ Gera número sequencial (MMYY-0001)                    │
│   ├─ Cria conta a receber (vencimento +30 dias)            │
│   └─ Define status: "Aguardando Produção"                  │
│                                                             │
│ 📊 Tabelas: Pedidos + ItensPedido + ContasReceber          │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. PRODUÇÃO - Fabricação dos Itens                         │
├─────────────────────────────────────────────────────────────┤
│ ▸ Operador acessa Fila de Produção                         │
│ ▸ Seleciona item a produzir                                │
│ ▸ Registra bobinas utilizadas (lote, peso)                 │
│ ▸ Registra sucata gerada                                   │
│ ▸ Marca item como "Concluído"                              │
│ ▸ Sistema atualiza saldo de bobinas                        │
│                                                             │
│ 📊 Tabelas: ItensPedido + BobinasUtilizadas + Bobinas      │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. EXPEDIÇÃO - Separação para Envio                        │
├─────────────────────────────────────────────────────────────┤
│ ▸ Operador acessa Fila de Expedição                        │
│ ▸ Itens produzidos aparecem automaticamente                │
│ ▸ Separa item para envio                                   │
│ ▸ Marca item como "Separado"                               │
│ ▸ Quando todos os itens estão separados:                   │
│   └─ Pedido recebe status "Concluído"                      │
│                                                             │
│ 📊 Tabelas: ItensPedido (StatusExpedicao)                  │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. FINANCEIRO - Recebimento                                │
├─────────────────────────────────────────────────────────────┤
│ ▸ Conta a receber foi criada automaticamente               │
│ ▸ Financeiro registra recebimento                          │
│ ▸ Atualiza status para "Pago"                              │
│ ▸ Dashboard financeiro atualiza KPIs                       │
│                                                             │
│ 📊 Tabelas: ContasReceber                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🌐 API REST

### Estrutura de Endpoints

A API possui **87+ endpoints** organizados por módulos:

| Módulo | Endpoints | Exemplos |
|--------|-----------|----------|
| Autenticação | 6 | POST /login, POST /register |
| Usuários | 6 | GET /users/{username}, GET /vendedores |
| Bobinas | 8 | GET /bobinas, POST /bobinas |
| Produtos | 10 | GET /produtos, PUT /produtos/{id} |
| Orçamentos | 7 | GET /orcamentos, PUT /orcamentos/{id} |
| Pedidos | 4 | GET /pedidos, GET /pedidos/{id} |
| Produção | 5 | GET /producao/fila, POST /producao/baixar-item |
| Expedição | 4 | GET /expedicao/fila, POST /expedicao/baixar-item |
| Clientes | 5 | GET /clientes, POST /clientes |
| Financeiro | 7 | GET /contas-pagar, GET /financeiro/dashboard |
| Fornecedores | 4 | GET /fornecedores, POST /fornecedores |
| Funcionários | 4 | GET /funcionarios, POST /funcionarios |
| Permissões | 2 | GET /permissoes/{id}, POST /permissoes/{id} |
| COMEX | 4 | GET /comex/rastreio, PUT /comex/rastreio/{id} |
| Suprimentos | 6 | GET /solicitacoes-compras, POST /suprimentos/compras |
| Chat | 4 | POST /chat/enviar, GET /chat/mensagens |
| Manutenções | 3 | GET /manutencoes, POST /manutencoes |
| Avisos | 3 | GET /avisos-sistema, POST /avisos-sistema |

### Padrão de Resposta JSON

#### Sucesso
```json
{
  "success": true,
  "message": "Operação realizada com sucesso",
  "data": {
    "id": 123,
    "campo": "valor"
  }
}
```

#### Erro
```json
{
  "success": false,
  "error": "Descrição do erro",
  "errors": {
    "campo1": "mensagem de validação",
    "campo2": "mensagem de validação"
  }
}
```

### Status HTTP

| Código | Significado | Uso |
|--------|-------------|-----|
| 200 | OK | Operação bem-sucedida |
| 201 | Created | Recurso criado |
| 400 | Bad Request | Erro na validação |
| 401 | Unauthorized | Não autenticado |
| 404 | Not Found | Recurso não encontrado |
| 405 | Method Not Allowed | Método HTTP inválido |
| 409 | Conflict | Conflito (ex: email já existe) |
| 500 | Server Error | Erro interno do servidor |

---

## 🎨 Frontend

### Estrutura de Páginas

Cada módulo possui uma página HTML dedicada:

```
public/pages/
├── login.html           # Login do sistema
├── orcamentos.html      # Gestão de orçamentos
├── pedidos.html         # Gestão de pedidos
├── estoque.html         # Estoque de bobinas
├── estoque-produtos.html # Estoque de produtos
├── financeiro.html      # Dashboard financeiro
├── contasapagar.html    # Contas a pagar
├── contasareceber.html  # Contas a receber
└── ... (20+ páginas)
```

### Padrão de Desenvolvimento Frontend

Cada módulo segue o mesmo padrão:

```javascript
// Exemplo: orcamentos.js

const API_URL = 'https://virtualcriacoes.com/sinergy/api';
let dataCache = [];

// 1. Inicialização
document.addEventListener('DOMContentLoaded', () => {
    if (!window.getLoggedInUserID()) return;

    setupEventListeners();
    loadData();
    renderTable();
});

// 2. Event Listeners
function setupEventListeners() {
    document.getElementById('btn-novo')?.addEventListener('click', openModal);
    document.getElementById('btn-salvar')?.addEventListener('click', saveItem);
}

// 3. Carregar Dados da API
async function loadData() {
    try {
        const response = await fetch(`${API_URL}/orcamentos`);
        dataCache = await response.json();
        renderTable();
    } catch (error) {
        showNotification('Erro ao carregar dados', 'error');
    }
}

// 4. Renderizar Tabela
function renderTable() {
    const tbody = document.querySelector('#table tbody');
    tbody.innerHTML = dataCache.map(item => `
        <tr>
            <td>${item.NumeroOrcamento}</td>
            <td>${item.ClienteNome}</td>
            <td>${formatCurrency(item.ValorTotal)}</td>
            <td>
                <button onclick="editItem(${item.ID})">Editar</button>
                <button onclick="deleteItem(${item.ID})">Deletar</button>
            </td>
        </tr>
    `).join('');
}

// 5. Salvar (POST/PUT)
async function saveItem() {
    const formData = {
        clienteNome: document.getElementById('clienteNome').value,
        // ... outros campos
    };

    const response = await fetch(`${API_URL}/orcamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    });

    const result = await response.json();
    if (result.success) {
        showNotification('Salvo com sucesso!', 'success');
        loadData();
    }
}
```

---

## 🔒 Segurança

### Medidas Implementadas

#### Backend
- ✅ **Prepared Statements** - 100% das queries (anti SQL Injection)
- ✅ **Password Hashing** - Bcrypt (PASSWORD_DEFAULT)
- ✅ **Input Sanitization** - Todas as entradas são sanitizadas
- ✅ **CORS** - Configurado adequadamente
- ✅ **Validação de Tipos** - CPF, CNPJ, Email, etc

#### Frontend
- ✅ **XSS Protection** - Escape de HTML
- ✅ **CSRF** - Tokens de validação
- ✅ **Autenticação** - Verificação em cada página
- ✅ **Permissões** - Controle granular por módulo

### Boas Práticas

```php
// ❌ NUNCA FAÇA ISSO (vulnerável a SQL Injection)
$query = "SELECT * FROM Usuarios WHERE Email = '{$_POST['email']}'";

// ✅ SEMPRE USE PREPARED STATEMENTS
$stmt = $conn->prepare("SELECT * FROM Usuarios WHERE Email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
```

---

## 🚀 Deploy e Configuração

### Pré-requisitos

- PHP 7.4 ou superior
- MySQL 5.7 ou superior
- Apache com mod_rewrite habilitado
- Extensões PHP: mysqli, json, mbstring

### Passo a Passo (Hostgator/cPanel)

#### 1. Upload dos Arquivos

```bash
# Via File Manager (cPanel)
1. Acesse File Manager
2. Navegue até public_html/
3. Upload do arquivo sinergy.zip
4. Extract All Files
```

#### 2. Criar Banco de Dados

```bash
# No cPanel → MySQL Databases
1. Criar novo banco: sinergy_db
2. Criar usuário: sinergy_user
3. Definir senha forte
4. Adicionar usuário ao banco (ALL PRIVILEGES)
```

#### 3. Importar Estrutura do Banco

```bash
# No cPanel → phpMyAdmin
1. Selecionar banco sinergy_db
2. Aba "Import"
3. Upload do arquivo database.sql
4. Click "Go"
```

#### 4. Configurar .env

```bash
# No File Manager, criar arquivo: /sinergy/.env
DB_HOST=localhost
DB_NAME=sinergy_db
DB_USER=sinergy_user
DB_PASSWORD=sua_senha_forte

APP_ENV=production
APP_DEBUG=false
APP_URL=https://seu-dominio.com

API_BASE_PATH=/sinergy/api
```

#### 5. Ajustar Permissões

```bash
# Pastas
chmod 755 sinergy/
chmod 755 sinergy/api/
chmod 755 sinergy/public/

# Logs (precisa escrita)
chmod 777 sinergy/logs/

# Arquivos
chmod 644 sinergy/.env
chmod 644 sinergy/api/index.php
```

#### 6. Testar Instalação

```bash
# API
https://seu-dominio.com/sinergy/api/status
# Deve retornar: {"status":"success","message":"API funcionando corretamente"}

# Frontend
https://seu-dominio.com/sinergy/public/
# Deve carregar a tela de login
```

### Variáveis de Ambiente (.env)

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DB_HOST` | Host do MySQL | localhost |
| `DB_NAME` | Nome do banco | sinergy_db |
| `DB_USER` | Usuário MySQL | sinergy_user |
| `DB_PASSWORD` | Senha MySQL | Str0ng_P@ssw0rd |
| `APP_ENV` | Ambiente | production |
| `APP_DEBUG` | Debug mode | false |
| `APP_URL` | URL base | https://exemplo.com |
| `API_BASE_PATH` | Base da API | /sinergy/api |

---

## 👨‍💻 Desenvolvimento

### Adicionando um Novo Endpoint

#### 1. Criar Handler (src/legacy_functions.php)

```php
/**
 * Descrição do que o handler faz
 */
function handleGetMeuModulo() {
    $conn = get_db_connection();
    if (!$conn) sendJsonResponse(['error' => 'Erro de conexão'], 500);

    $stmt = $conn->prepare("SELECT * FROM MinhaTabela ORDER BY ID DESC");
    $stmt->execute();
    $result = $stmt->get_result();

    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }

    $stmt->close();
    $conn->close();

    sendJsonResponse($data, 200);
}
```

#### 2. Registrar Rota (api/index.php)

```php
// Adicionar dentro do switch(true)
case $path === '/meu-modulo' && $method === 'GET':
    handleGetMeuModulo();
    break;
```

#### 3. Consumir no Frontend (assets/js/meu-modulo.js)

```javascript
async function loadData() {
    const response = await fetch(`${API_URL}/meu-modulo`);
    const data = await response.json();
    renderTable(data);
}
```

### Adicionando Nova Tabela

#### 1. Criar Migração SQL

```sql
CREATE TABLE `MinhaTabela` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Nome` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `DataCriacao` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
```

#### 2. Documentar no DATABASE.md

#### 3. Criar Handlers CRUD

---

## 🐛 Troubleshooting

### Problemas Comuns

#### 1. API Retorna Erro 500

**Causas:**
- Erro de conexão com banco
- Erro de sintaxe PHP
- Permissões incorretas

**Solução:**
```bash
# Ver logs
tail -f /sinergy/logs/errors.log

# Verificar permissões
chmod 777 /sinergy/logs/

# Testar conexão MySQL
mysql -u sinergy_user -p sinergy_db
```

#### 2. Frontend Não Carrega

**Causas:**
- mod_rewrite não habilitado
- .htaccess com erro
- Caminho da API incorreto

**Solução:**
```bash
# Verificar mod_rewrite
# No .htaccess, adicionar:
<IfModule mod_rewrite.c>
    RewriteEngine On
</IfModule>

# Verificar console do navegador (F12)
# Ver se há erros de CORS ou 404
```

#### 3. Erro de CORS

**Sintomas:**
```
Access to fetch at 'api/endpoint' has been blocked by CORS policy
```

**Solução:**
```php
// config/cors.php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
```

#### 4. Orçamento Não Converte em Pedido

**Causas:**
- Erro na função `handleUpdateOrcamento()`
- Transação MySQL não está funcionando
- Campos NULL não tratados

**Solução:**
```bash
# Ver log detalhado
tail -f /sinergy/logs/debug.log

# Verificar estrutura da tabela
DESCRIBE Pedidos;
DESCRIBE ItensPedido;

# Testar manualmente a query
```

### Logs Importantes

```bash
# Logs do sistema
/sinergy/logs/debug.log      # Debug geral
/sinergy/logs/errors.log     # Erros PHP
/sinergy/logs/api.log        # Requisições API

# Logs do Apache
/var/log/apache2/error.log   # Erros Apache

# Logs do MySQL
/var/log/mysql/error.log     # Erros MySQL
```

---

## 📞 Suporte e Contato

### Para Novos Desenvolvedores

Ao assumir o projeto, recomendo:

1. ✅ Ler toda esta documentação
2. ✅ Ler DATABASE.md
3. ✅ Explorar a estrutura do banco no phpMyAdmin
4. ✅ Testar cada módulo do sistema
5. ✅ Fazer backup antes de qualquer alteração
6. ✅ Usar Git para controle de versão

### Documentação Adicional

- [DATABASE.md](./DATABASE.md) - Estrutura completa do banco
- [api/index.php](./api/index.php) - Documentação inline dos endpoints
- [src/legacy_functions.php](./src/legacy_functions.php) - Documentação dos handlers

---

## 📋 Checklist de Deploy

- [ ] Servidor atende requisitos (PHP 7.4+, MySQL 5.7+)
- [ ] Mod_rewrite habilitado no Apache
- [ ] Arquivos enviados para servidor
- [ ] Banco de dados criado
- [ ] Usuário MySQL criado com privilégios
- [ ] Estrutura do banco importada
- [ ] Arquivo .env criado e configurado
- [ ] Permissão 777 na pasta logs/
- [ ] Teste API: /api/status retorna sucesso
- [ ] Frontend carrega corretamente
- [ ] Login funciona
- [ ] Módulos principais testados
- [ ] Backup do banco configurado

---

## 📜 Licença e Créditos

**Sistema Desenvolvido Por:** Paulo (Desenvolvedor Original)
**Empresa:** ATRON
**Versão:** 2.0
**Data:** Dezembro 2024
**Licença:** Uso Interno

---

## 🎓 Considerações Finais

Este sistema foi desenvolvido com muito cuidado e atenção aos detalhes. Cada funcionalidade foi pensada para facilitar a operação do dia a dia da empresa.

**Para futuros desenvolvedores:**

- Mantenha a consistência do código
- Documente todas as alterações
- Teste exaustivamente antes de deploy
- Faça backups regulares
- Mantenha a segurança como prioridade

**Boa sorte com o desenvolvimento! 🚀**

---

_Última atualização: Dezembro 2024_
