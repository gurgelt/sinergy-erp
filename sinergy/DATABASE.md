# 🗄️ Documentação do Banco de Dados - Sinergy ERP

> **Banco:** `atriu019_sinergy`
> **Charset:** UTF-8 Unicode
> **Engine:** InnoDB (suporte a transações ACID)
> **Total de Tabelas:** 29

---

## 📋 Índice

1. [Visão Geral](#-visão-geral)
2. [Diagrama de Relacionamentos](#-diagrama-de-relacionamentos)
3. [Tabelas por Módulo](#-tabelas-por-módulo)
4. [Detalhamento das Tabelas](#-detalhamento-das-tabelas)
5. [Relacionamentos e Foreign Keys](#-relacionamentos-e-foreign-keys)
6. [Índices e Performance](#-índices-e-performance)
7. [Triggers e Procedimentos](#-triggers-e-procedimentos)
8. [Queries Úteis](#-queries-úteis)

---

## 🎯 Visão Geral

O banco de dados do Sinergy ERP foi projetado para suportar operações de:
- ✅ Gestão comercial (orçamentos, pedidos, clientes)
- ✅ Controle de estoque (produtos, bobinas, movimentações)
- ✅ Produção e expedição
- ✅ Financeiro (contas a pagar/receber)
- ✅ RH (funcionários, permissões)
- ✅ COMEX (rastreamento de containers)
- ✅ Chat interno e notificações

### Características Técnicas

- **Transações ACID**: Garantia de integridade nas operações críticas
- **Foreign Keys**: Relacionamentos com CASCADE e SET NULL
- **Índices Otimizados**: Queries rápidas mesmo com grande volume
- **Campos AUTO_INCREMENT**: IDs gerados automaticamente
- **Timestamps Automáticos**: DataCriacao com CURRENT_TIMESTAMP
- **Charset UTF-8**: Suporte a acentuação e caracteres especiais

---

## 📊 Diagrama de Relacionamentos

### Fluxo Principal: Vendas → Produção → Expedição → Financeiro

```
┌─────────────┐          ┌──────────────┐
│  Usuarios   │◄─────────┤  Permissoes  │
└──────┬──────┘          └──────────────┘
       │
       ▼
┌─────────────┐
│  Clientes   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐       ┌────────────────────┐
│   Orcamentos    │◄──────┤ ItensOrcamento     │
└────────┬────────┘       └────────────────────┘
         │
         │ (ao aprovar)
         ▼
┌─────────────────┐       ┌────────────────────┐
│    Pedidos      │◄──────┤   ItensPedido      │
└────────┬────────┘       └──────────┬─────────┘
         │                           │
         │                           │ (produção)
         │                           ▼
         │                  ┌────────────────────┐
         │                  │ BobinasUtilizadas  │
         │                  └─────────┬──────────┘
         │                            │
         │                            ▼
         │                  ┌────────────────────┐
         │                  │     Bobinas        │
         │                  └────────────────────┘
         │
         │ (financeiro)
         ▼
┌─────────────────┐
│ ContasReceber   │
└─────────────────┘
```

---

## 📁 Tabelas por Módulo

### 🔐 Autenticação e Controle de Acesso
- `Usuarios` - Login e dados do usuário
- `Permissoes` - Controle de acesso por módulo

### 💼 Comercial
- `Clientes` - Cadastro de clientes
- `Orcamentos` - Orçamentos de venda
- `ItensOrcamento` - Itens de cada orçamento
- `Pedidos` - Pedidos de venda
- `ItensPedido` - Itens de cada pedido

### 📦 Estoque
- `Produtos` - Catálogo de produtos
- `EstoqueProdutos` - Saldos por localização
- `MovimentacoesEstoqueProdutos` - Histórico de movimentações
- `Bobinas` - Matéria-prima (alumínio/aço)
- `BobinasUtilizadas` - Consumo na produção
- `Movimentacoes` - Movimentações gerais

### 💰 Financeiro
- `ContasPagar` - Despesas e fornecedores
- `ContasReceber` - Receitas de pedidos

### 👥 RH
- `Funcionarios` - Cadastro de funcionários

### 🏭 Produção
(Usa campos em `ItensPedido`: StatusProducao, StatusExpedicao)

### 🛒 Suprimentos
- `Fornecedores` - Cadastro de fornecedores
- `SolicitacoesCompras` - Solicitações de compra
- `PedidosCompra` - Pedidos de compra
- `ItensPedidoCompra` - Itens dos pedidos de compra

### 📝 Notas Fiscais
- `NotasFiscais` - Cabeçalho de NFe
- `ItensNotaFiscal` - Itens das notas

### 🌍 COMEX
- `RastreioContainers` - Rastreamento de importações

### 🔧 Manutenções
- `Manutencoes` - Chamados técnicos

### 💬 Comunicação
- `ChatMensagens` - Mensagens entre usuários
- `AvisosSistema` - Notificações globais

---

## 📝 Detalhamento das Tabelas

---

### 1. `Usuarios`
**Descrição:** Armazena dados de login e controle de acesso dos usuários do sistema.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `NomeCompleto` | VARCHAR(150) NOT NULL | Nome completo do usuário |
| `Email` | VARCHAR(100) NOT NULL UNIQUE | Email único |
| `NomeUsuario` | VARCHAR(50) NOT NULL UNIQUE | Username para login |
| `SenhaHash` | VARCHAR(255) NOT NULL | Hash bcrypt da senha |
| `DataCriacao` | DATETIME DEFAULT CURRENT_TIMESTAMP | Data de cadastro |
| `FotoPerfilBase64` | LONGTEXT | Foto em Base64 (opcional) |
| `password_reset_token` | VARCHAR(255) | Token de recuperação de senha |
| `token_expiry` | DATETIME | Validade do token |
| `Role` | VARCHAR(20) DEFAULT 'vendedor' | Perfil (admin, gerente, vendedor, operador) |
| `UltimaAtividade` | DATETIME | Último acesso (para chat/status online) |

**Índices:**
- PRIMARY KEY (`ID`)
- UNIQUE (`NomeUsuario`, `Email`)
- INDEX (`password_reset_token`)

**Backend:** `handleLogin()`, `handleRegister()`, `handleRecoverPassword()`

---

### 2. `Permissoes`
**Descrição:** Controle granular de acesso aos módulos do sistema por usuário.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `UsuarioID` | INT(11) FK NOT NULL | Referência ao usuário |
| `Modulo` | VARCHAR(50) NOT NULL | Nome do módulo (ex: "orcamentos", "financeiro") |

**Relacionamentos:**
- `UsuarioID` → `Usuarios.ID` (ON DELETE CASCADE)

**Backend:** `handleGetPermissoes()`, `handleSavePermissoes()`

---

### 3. `Clientes`
**Descrição:** Cadastro de clientes do sistema.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `UsuarioID` | INT(11) FK NOT NULL | Usuário que cadastrou |
| `Nome` | VARCHAR(255) NOT NULL | Nome/Razão Social |
| `Documento` | VARCHAR(50) | CPF ou CNPJ |
| `Endereco` | VARCHAR(255) | Endereço completo |
| `CidadeUF` | VARCHAR(100) | Cidade e estado |
| `Contato` | VARCHAR(50) | Telefone/WhatsApp |
| `Email` | VARCHAR(100) | Email do cliente |
| `DataCadastro` | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | Data de cadastro |
| `TipoCliente` | VARCHAR(50) DEFAULT 'Consumidor Final' | Tipo de cliente |
| `VendedorResponsavel` | VARCHAR(100) | Nome do vendedor |
| `EnderecosAdicionais` | LONGTEXT | JSON com endereços múltiplos |

**Relacionamentos:**
- `UsuarioID` → `Usuarios.ID`

**Backend:** `handleGetClientes()`, `handleAddCliente()`

---

### 4. `Produtos`
**Descrição:** Catálogo de produtos comercializados pela empresa.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `NomeItem` | VARCHAR(255) NOT NULL UNIQUE | Nome do produto |
| `UnidadeMedida` | VARCHAR(20) NOT NULL | m², UN, KG, etc |
| `PrecoSerralheria` | DECIMAL(10,2) NOT NULL | Preço para serralheiros |
| `PrecoConsumidor` | DECIMAL(10,2) NOT NULL | Preço para consumidor final |
| `Classe` | VARCHAR(50) DEFAULT 'Outros' | Categoria do produto |
| `RequerProducao` | TINYINT(1) DEFAULT 0 | Se precisa produzir (1) ou é revenda (0) |
| `CodigoReferencia` | VARCHAR(50) | Código interno de referência |

**Índices:**
- PRIMARY KEY (`ID`)
- UNIQUE (`NomeItem`)

**Backend:** `handleGetProdutos()`, `handleAddProduto()`

---

### 5. `EstoqueProdutos`
**Descrição:** Controle de estoque com suporte a múltiplas localizações (armazéns, depósitos).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `ProdutoID` | INT(11) FK NOT NULL | Referência ao produto |
| `Quantidade` | DECIMAL(10,2) DEFAULT 0.00 | Saldo atual |
| `QuantidadeMinima` | DECIMAL(10,2) DEFAULT 0.00 | Estoque mínimo (alerta) |
| `Localizacao` | VARCHAR(100) | Ex: "Armazém A", "Depósito B" |
| `Observacao` | TEXT | Observações sobre o estoque |
| `UltimaMovimentacao` | DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE | Última movimentação |
| `Usuario` | VARCHAR(100) | Usuário que fez a última alteração |

**Índices:**
- PRIMARY KEY (`ID`)
- UNIQUE (`ProdutoID`, `Localizacao`)
- INDEX (`ProdutoID`, `Quantidade`)

**Relacionamentos:**
- `ProdutoID` → `Produtos.ID` (ON DELETE CASCADE)

**Backend:** `handleGetEstoqueProdutos()`, `handleMovimentarEstoqueProduto()`

---

### 6. `MovimentacoesEstoqueProdutos`
**Descrição:** Histórico completo de todas as movimentações de estoque.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `ProdutoID` | INT(11) FK NOT NULL | Referência ao produto |
| `TipoMovimentacao` | ENUM('Entrada','Saída','Ajuste','Transferência') | Tipo da operação |
| `Quantidade` | DECIMAL(10,2) NOT NULL | Quantidade movimentada |
| `QuantidadeAnterior` | DECIMAL(10,2) | Saldo antes da movimentação |
| `QuantidadeAtual` | DECIMAL(10,2) | Saldo após a movimentação |
| `Motivo` | VARCHAR(255) | Motivo da movimentação |
| `Observacao` | TEXT | Detalhes adicionais |
| `DataMovimentacao` | DATETIME DEFAULT CURRENT_TIMESTAMP | Data/hora da operação |
| `Usuario` | VARCHAR(100) | Usuário responsável |

**Índices:**
- PRIMARY KEY (`ID`)
- INDEX (`ProdutoID`, `DataMovimentacao`)
- INDEX (`TipoMovimentacao`)

**Relacionamentos:**
- `ProdutoID` → `Produtos.ID` (ON DELETE CASCADE)

**Backend:** `handleGetHistoricoMovimentacoesProduto()`

---

### 7. `Bobinas`
**Descrição:** Controle de bobinas de alumínio/aço (matéria-prima para produção).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `Tipo` | VARCHAR(100) NOT NULL | Tipo da bobina (ex: "Alumínio 1050") |
| `Espessura` | DECIMAL(4,2) | Espessura em mm |
| `Largura` | DECIMAL(10,2) | Largura em mm |
| `Fornecedor` | VARCHAR(200) | Nome do fornecedor |
| `NotaFiscal` | VARCHAR(50) | Número da nota fiscal |
| `DataRecebimento` | DATE | Data de recebimento |
| `Lote` | VARCHAR(100) NOT NULL UNIQUE | Número do lote |
| `Peso` | DECIMAL(10,2) NOT NULL | Peso em KG |
| `Status` | VARCHAR(50) | Disponível, Em Uso, Esgotado |
| `Observacao` | TEXT | Observações |
| `NaturezaOperacao` | VARCHAR(50) | Natureza da operação |
| `TipoMovimentacao` | VARCHAR(100) | Tipo de movimentação |
| `Usuario` | VARCHAR(50) | Usuário que cadastrou |

**Índices:**
- PRIMARY KEY (`ID`)
- UNIQUE (`Lote`)

**Backend:** `handleGetBobinas()`, `handleAddBobina()`

---

### 8. `BobinasUtilizadas`
**Descrição:** Rastreamento de quais bobinas foram usadas em cada item de produção.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `ItemProducaoID` | INT(11) FK | Referência ao item produzido (ItensPedido) |
| `BobinaID` | INT(11) FK NOT NULL | Referência à bobina usada |
| `PesoUsado` | DECIMAL(10,2) | Peso consumido da bobina (KG) |
| `SucataGerada` | DECIMAL(10,2) | Peso de sucata gerada (KG) |
| `ItemPedidoID` | INT(11) | Referência ao item do pedido |
| `DataUso` | DATETIME DEFAULT CURRENT_TIMESTAMP | Data/hora do uso |

**Índices:**
- PRIMARY KEY (`ID`)
- INDEX (`BobinaID`, `ItemProducaoID`)

**Relacionamentos:**
- `BobinaID` → `Bobinas.ID`
- `ItemProducaoID` → `ItensProducao.ID` (tabela não detalhada aqui)

**Backend:** `handleBaixarItemProducao()` (registra o uso)

---

### 9. `Orcamentos`
**Descrição:** Cabeçalho dos orçamentos de venda.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `UsuarioID` | INT(11) FK NOT NULL | Vendedor que criou |
| `TipoOrcamento` | VARCHAR(20) NOT NULL | Venda ou Revenda |
| `Status` | VARCHAR(20) DEFAULT 'pendente' | pendente, aprovado, rejeitado |
| `NumeroOrcamento` | VARCHAR(50) NOT NULL UNIQUE | Ex: "1225-0001" (MMYY-sequencial) |
| `DataOrcamento` | DATE NOT NULL | Data de emissão |
| `DataValidade` | DATE NOT NULL | Validade do orçamento |
| `ClienteNome` | VARCHAR(255) NOT NULL | Nome do cliente |
| `ClienteDocumento` | VARCHAR(20) | CPF/CNPJ |
| `ClienteEndereco` | VARCHAR(255) | Endereço |
| `ClienteCidadeUF` | VARCHAR(100) | Cidade/UF |
| `ClienteContato` | VARCHAR(50) | Telefone |
| `ClienteEmail` | VARCHAR(100) | Email |
| `TemFrete` | TINYINT(1) DEFAULT 0 | Se inclui frete |
| `ValorFrete` | DECIMAL(10,2) DEFAULT 0.00 | Valor do frete |
| `DescontoGeralPercent` | DECIMAL(5,2) DEFAULT 0.00 | Desconto em % |
| `Subtotal` | DECIMAL(10,2) NOT NULL | Subtotal dos itens |
| `ValorTotal` | DECIMAL(10,2) NOT NULL | Total final |
| `Observacoes` | TEXT | Observações |
| `TipoPagamento` | VARCHAR(50) DEFAULT 'À Vista' | À Vista ou Parcelado |
| `FormaPagamento` | VARCHAR(50) DEFAULT 'Pix' | Pix, Boleto, Cartão, etc |
| `Parcelas` | INT(11) DEFAULT 1 | Número de parcelas |

**Índices:**
- PRIMARY KEY (`ID`)
- UNIQUE (`NumeroOrcamento`)
- INDEX (`UsuarioID`)

**Relacionamentos:**
- `UsuarioID` → `Usuarios.ID` (ON DELETE CASCADE)

**Backend:** `handleAddOrcamento()`, `handleUpdateOrcamento()` (⭐ CRÍTICA: converte em pedido)

---

### 10. `ItensOrcamento`
**Descrição:** Itens/produtos de cada orçamento.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `OrcamentoID` | INT(11) FK NOT NULL | Referência ao orçamento |
| `ProdutoID` | INT(11) FK | Referência ao produto |
| `Item` | VARCHAR(255) NOT NULL | Nome do item |
| `Comprimento` | DECIMAL(10,2) | Comprimento (para produtos em m²) |
| `Altura` | DECIMAL(10,2) | Altura (para produtos em m²) |
| `Quantidade` | INT(11) NOT NULL | Quantidade |
| `UnidadeMedida` | VARCHAR(20) NOT NULL | m², UN, etc |
| `ValorUnitario` | DECIMAL(10,2) NOT NULL | Preço unitário |
| `DescontoPercent` | DECIMAL(5,2) DEFAULT 0.00 | Desconto individual |
| `ValorTotalItem` | DECIMAL(10,2) NOT NULL | Total do item |

**Índices:**
- PRIMARY KEY (`ID`)
- INDEX (`OrcamentoID`, `ProdutoID`)

**Relacionamentos:**
- `OrcamentoID` → `Orcamentos.ID` (ON DELETE CASCADE)
- `ProdutoID` → `Produtos.ID` (ON DELETE SET NULL)

---

### 11. `Pedidos`
**Descrição:** Pedidos de venda (gerados automaticamente ao aprovar orçamento).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `OrcamentoID` | INT(11) FK NOT NULL | Orçamento de origem |
| `ProducaoID` | INT(11) | Referência à produção (se houver) |
| `NumeroPedido` | VARCHAR(50) NOT NULL | Ex: "1225-0001" |
| `ClienteNome` | VARCHAR(255) NOT NULL | Nome do cliente |
| `ClienteContato` | VARCHAR(100) | Telefone |
| `ClienteEmail` | VARCHAR(100) | Email |
| `DataPedido` | DATE NOT NULL | Data do pedido |
| `ValorTotal` | DECIMAL(10,2) NOT NULL | Valor total |
| `StatusPedido` | VARCHAR(50) DEFAULT 'Aguardando Produção' | Status geral do pedido |
| `VendedorNome` | VARCHAR(255) NOT NULL | Nome do vendedor |
| `ClienteDocumento` | VARCHAR(50) | CPF/CNPJ |
| `ClienteEndereco` | VARCHAR(255) | Endereço |
| `ClienteCidadeUF` | VARCHAR(100) | Cidade/UF |
| `Observacoes` | TEXT | Observações |
| `TemFrete` | TINYINT(1) DEFAULT 0 | Se inclui frete |
| `ValorFrete` | DECIMAL(10,2) DEFAULT 0.00 | Valor do frete |
| `DescontoGeralPercent` | DECIMAL(5,2) DEFAULT 0.00 | Desconto |
| `Subtotal` | DECIMAL(10,2) DEFAULT 0.00 | Subtotal |
| `MotivoCancelamento` | TEXT | Se cancelado, o motivo |
| `TipoPagamento` | VARCHAR(50) DEFAULT 'À Vista' | À Vista ou Parcelado |
| `FormaPagamento` | VARCHAR(50) DEFAULT 'Pix' | Forma de pagamento |
| `ResponsavelProducaoID` | INT(11) | Responsável pela produção |

**Índices:**
- PRIMARY KEY (`ID`)
- INDEX (`OrcamentoID`)

**Relacionamentos:**
- `OrcamentoID` → `Orcamentos.ID` (ON DELETE CASCADE)

**Backend:** Criado automaticamente em `handleUpdateOrcamento()` ao aprovar

---

### 12. `ItensPedido`
**Descrição:** Itens do pedido (copiados dos itens do orçamento).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `PedidoID` | INT(11) FK NOT NULL | Referência ao pedido |
| `ProdutoID` | INT(11) FK | Referência ao produto |
| `ItemNome` | VARCHAR(255) NOT NULL | Nome do item |
| `Comprimento` | DECIMAL(10,2) | Comprimento |
| `Altura` | DECIMAL(10,2) | Altura |
| `Quantidade` | DECIMAL(10,2) NOT NULL | Quantidade |
| `UnidadeMedida` | VARCHAR(20) NOT NULL | Unidade |
| `ValorUnitario` | DECIMAL(10,2) NOT NULL | Preço unitário |
| `ValorTotalItem` | DECIMAL(10,2) NOT NULL | Total do item |
| `StatusProducao` | ENUM('Pendente','Concluido') DEFAULT 'Pendente' | Status de produção |
| `StatusExpedicao` | ENUM('Pendente','Separado') DEFAULT 'Pendente' | Status de expedição |

**Índices:**
- PRIMARY KEY (`ID`)
- INDEX (`PedidoID`)

**Relacionamentos:**
- `PedidoID` → `Pedidos.ID` (ON DELETE CASCADE)

**Backend:**
- `handleGetFilaProducao()` (StatusProducao = 'Pendente')
- `handleGetFilaExpedicao()` (StatusProducao = 'Concluido' AND StatusExpedicao = 'Pendente')

---

### 13. `ContasReceber`
**Descrição:** Contas a receber (geradas automaticamente ao criar pedido).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `PedidoID` | INT(11) FK NOT NULL | Referência ao pedido |
| `ClienteNome` | VARCHAR(255) | Nome do cliente |
| `NumeroPedido` | VARCHAR(50) | Número do pedido |
| `Valor` | DECIMAL(10,2) NOT NULL | Valor a receber |
| `DataEmissao` | DATE NOT NULL | Data de emissão |
| `DataVencimento` | DATE NOT NULL | Vencimento (+30 dias padrão) |
| `DataRecebimento` | DATE | Data efetiva do recebimento |
| `Status` | VARCHAR(50) DEFAULT 'Aguardando' | Aguardando, Pago, Atrasado |
| `TipoPagamento` | VARCHAR(50) DEFAULT 'À Vista' | À Vista ou Parcelado |
| `FormaPagamento` | VARCHAR(50) DEFAULT 'Boleto' | Forma de pagamento |

**Índices:**
- PRIMARY KEY (`ID`)
- INDEX (`PedidoID`)

**Relacionamentos:**
- `PedidoID` → `Pedidos.ID` (ON DELETE CASCADE)

**Backend:** Criada automaticamente em `handleUpdateOrcamento()` ao aprovar orçamento

---

### 14. `ContasPagar`
**Descrição:** Controle de despesas e contas a pagar.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `UsuarioID` | INT(11) FK NOT NULL | Usuário que lançou |
| `Descricao` | VARCHAR(255) NOT NULL | Descrição da despesa |
| `Fornecedor` | VARCHAR(255) | Nome do fornecedor |
| `Categoria` | VARCHAR(100) NOT NULL | Categoria da despesa |
| `Valor` | DECIMAL(10,2) NOT NULL | Valor |
| `DataVencimento` | DATE NOT NULL | Vencimento |
| `DataPagamento` | DATE | Data efetiva do pagamento |
| `Status` | VARCHAR(50) DEFAULT 'Pendente' | Pendente, Pago, Atrasado |
| `Observacoes` | TEXT | Observações |
| `DataLancamento` | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | Data de lançamento |
| `TipoPagamento` | VARCHAR(50) DEFAULT 'À Vista' | À Vista ou Parcelado |
| `FormaPagamento` | VARCHAR(50) DEFAULT 'Pix' | Forma de pagamento |

**Índices:**
- PRIMARY KEY (`ID`)
- INDEX (`UsuarioID`)

**Relacionamentos:**
- `UsuarioID` → `Usuarios.ID`

**Backend:** `handleGetContasPagar()`, `handleAddContaPagar()`

---

### 15. `Funcionarios`
**Descrição:** Cadastro completo de funcionários da empresa.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `NomeCompleto` | VARCHAR(255) NOT NULL | Nome completo |
| `FotoPerfilBase64` | LONGTEXT | Foto em Base64 |
| `DataNascimento` | DATE | Data de nascimento |
| `RG` | VARCHAR(20) | RG |
| `CPF` | VARCHAR(20) NOT NULL UNIQUE | CPF |
| `NomeMae` | VARCHAR(255) | Nome da mãe |
| `NomePai` | VARCHAR(255) | Nome do pai |
| `Telefone` | VARCHAR(20) | Telefone |
| `Email` | VARCHAR(100) | Email |
| `Endereco` | VARCHAR(255) | Endereço |
| `CEP` | VARCHAR(10) | CEP |
| `CidadeUF` | VARCHAR(100) | Cidade/UF |
| `PIS_PASEP` | VARCHAR(30) | PIS/PASEP |
| `TituloEleitor` | VARCHAR(30) | Título de eleitor |
| `DataAdmissao` | DATE NOT NULL | Data de admissão |
| `Cargo` | VARCHAR(100) | Cargo |
| `Departamento` | VARCHAR(100) | Departamento |
| `Salario` | DECIMAL(10,2) | Salário |
| `TipoContrato` | VARCHAR(50) | CLT, PJ, etc |
| `Status` | VARCHAR(50) DEFAULT 'Ativo' | Ativo, Inativo |
| `Banco` | VARCHAR(100) | Banco para pagamento |
| `Agencia` | VARCHAR(20) | Agência |
| `ContaCorrente` | VARCHAR(30) | Conta corrente |
| `UsuarioID` | INT(11) FK | Vínculo com login do sistema |

**Índices:**
- PRIMARY KEY (`ID`)
- UNIQUE (`CPF`)
- INDEX (`UsuarioID`)

**Relacionamentos:**
- `UsuarioID` → `Usuarios.ID` (ON DELETE SET NULL)

**Backend:** `handleGetFuncionarios()`, `handleAddFuncionario()`

---

### 16. `Fornecedores`
**Descrição:** Cadastro de fornecedores.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `NomeFantasia` | VARCHAR(255) NOT NULL | Nome fantasia |
| `CNPJ` | VARCHAR(20) NOT NULL UNIQUE | CNPJ |
| `RazaoSocial` | VARCHAR(255) | Razão social |
| `Endereco` | VARCHAR(255) | Endereço |
| `Cidade` | VARCHAR(100) | Cidade |
| `CEP` | VARCHAR(10) | CEP |
| `TipoFornecedor` | VARCHAR(100) | Tipo (Matéria-prima, Serviços, etc) |
| `DataCadastro` | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | Data de cadastro |

**Índices:**
- PRIMARY KEY (`ID`)
- UNIQUE (`CNPJ`)
- INDEX (`NomeFantasia`, `CNPJ`)

**Backend:** `handleGetFornecedores()`, `handleAddFornecedor()`

---

### 17. `SolicitacoesCompras`
**Descrição:** Solicitações de compra de materiais.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `UsuarioID` | INT(11) FK NOT NULL | Usuário solicitante |
| `Setor` | VARCHAR(50) | Setor solicitante |
| `Material` | VARCHAR(100) NOT NULL | Material solicitado |
| `Quantidade` | DECIMAL(10,2) NOT NULL | Quantidade |
| `Unidade` | VARCHAR(20) DEFAULT 'un' | Unidade de medida |
| `Descricao` | TEXT | Descrição detalhada |
| `Prioridade` | VARCHAR(20) DEFAULT 'Normal' | Normal, Alta, Urgente |
| `Status` | VARCHAR(50) DEFAULT 'Pendente' | Pendente, Aprovada, Recusada |
| `DataSolicitacao` | DATETIME DEFAULT CURRENT_TIMESTAMP | Data da solicitação |
| `DataNecessidade` | DATE | Data necessária |
| `MotivoRecusa` | TEXT | Se recusada, o motivo |
| `ValorEstimado` | DECIMAL(10,2) | Valor estimado |
| `CotacaoJSON` | TEXT | JSON com 3 cotações |
| `FornecedorEscolhido` | INT(11) | 1, 2 ou 3 (qual venceu) |
| `ObservacaoCotacao` | TEXT | Observações sobre cotação |

**Índices:**
- PRIMARY KEY (`ID`)
- INDEX (`UsuarioID`)

**Relacionamentos:**
- `UsuarioID` → `Usuarios.ID`

**Backend:** `handleGetSolicitacoesCompras()`, `handleAddSolicitacaoCompra()`

---

### 18. `PedidosCompra`
**Descrição:** Pedidos de compra para fornecedores.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `SolicitacaoID` | INT(11) | Referência à solicitação de origem |
| `NumeroPedido` | VARCHAR(50) | Número do pedido |
| `Fornecedor` | VARCHAR(150) | Nome do fornecedor |
| `DataPedido` | DATE | Data do pedido |
| `DataEntrega` | DATE | Data prevista de entrega |
| `Status` | VARCHAR(50) DEFAULT 'Solicitado' | Solicitado, Entregue, Cancelado |
| `ValorTotal` | DECIMAL(15,2) | Valor total |
| `Observacoes` | TEXT | Observações |
| `UsuarioID` | INT(11) | Usuário que criou |
| `AtualizadoEm` | TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE | Última atualização |

**Índices:**
- PRIMARY KEY (`ID`)

**Backend:** `handleGetPedidosCompra()`, `handleAddPedidoCompra()`

---

### 19. `ItensPedidoCompra`
**Descrição:** Itens dos pedidos de compra.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `PedidoCompraID` | INT(11) FK | Referência ao pedido de compra |
| `NomeItem` | VARCHAR(255) | Nome do item |
| `Quantidade` | DECIMAL(10,2) | Quantidade |
| `Unidade` | VARCHAR(20) | Unidade de medida |
| `ValorUnitario` | DECIMAL(10,2) | Preço unitário |
| `ValorTotal` | DECIMAL(10,2) | Total do item |

**Índices:**
- PRIMARY KEY (`ID`)
- INDEX (`PedidoCompraID`)

**Relacionamentos:**
- `PedidoCompraID` → `PedidosCompra.ID` (ON DELETE CASCADE)

---

### 20. `NotasFiscais`
**Descrição:** Cabeçalho de notas fiscais eletrônicas (NFe).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `ChaveAcesso` | VARCHAR(50) UNIQUE | Chave de 44 dígitos da NFe |
| `NumeroNota` | VARCHAR(20) | Número da nota |
| `Serie` | VARCHAR(10) | Série |
| `FornecedorID` | INT(11) | Referência ao fornecedor |
| `DataEmissao` | DATE | Data de emissão |
| `ValorTotal` | DECIMAL(10,2) | Valor total |
| `XmlArquivo` | VARCHAR(255) | Caminho do arquivo XML |
| `DataImportacao` | DATETIME DEFAULT CURRENT_TIMESTAMP | Data de importação |

**Índices:**
- PRIMARY KEY (`ID`)
- UNIQUE (`ChaveAcesso`)

**Backend:** `handleGetNotasFiscais()`, `handleImportarXMLNFe()`

---

### 21. `ItensNotaFiscal`
**Descrição:** Itens das notas fiscais.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `NotaID` | INT(11) FK | Referência à nota |
| `ProdutoID` | INT(11) | Referência ao produto (se mapeado) |
| `NomeProdutoXML` | VARCHAR(255) | Nome do produto no XML |
| `CodigoProdutoXML` | VARCHAR(50) | Código do produto no XML |
| `NCM` | VARCHAR(20) | Nomenclatura Comum do Mercosul |
| `CFOP` | VARCHAR(10) | Código Fiscal de Operação |
| `Unidade` | VARCHAR(10) | Unidade de medida |
| `Quantidade` | DECIMAL(10,2) | Quantidade |
| `ValorUnitario` | DECIMAL(10,2) | Valor unitário |
| `ValorTotal` | DECIMAL(10,2) | Total do item |

**Índices:**
- PRIMARY KEY (`ID`)
- INDEX (`NotaID`)

**Relacionamentos:**
- `NotaID` → `NotasFiscais.ID` (ON DELETE CASCADE)

---

### 22. `RastreioContainers`
**Descrição:** Rastreamento de containers de importação (COMEX).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `ContainerNumero` | VARCHAR(50) NOT NULL | Número do container |
| `Armador` | VARCHAR(100) | Transportadora/armador |
| `Mercadoria` | VARCHAR(255) | Descrição da mercadoria |
| `DataETA` | DATE | Estimated Time of Arrival |
| `StatusStep` | INT(11) DEFAULT 1 | Etapa (1-6) |
| `StatusAtual` | VARCHAR(100) | Status textual |
| `Observacoes` | TEXT | Observações |
| `UltimaAtualizacao` | DATETIME DEFAULT CURRENT_TIMESTAMP | Última atualização |

**Status Steps:**
1. Coletado
2. Em Trânsito
3. No Porto
4. Desembarque
5. Em Liberação
6. Entregue

**Índices:**
- PRIMARY KEY (`ID`)

**Backend:** `handleGetRastreio()`, `handleUpdateRastreio()`

---

### 23. `Manutencoes`
**Descrição:** Chamados de manutenção e assistência técnica.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `CodigoManutencao` | VARCHAR(50) NOT NULL UNIQUE | Código único do chamado |
| `ClienteID` | INT(11) FK NOT NULL | Cliente solicitante |
| `DataSolicitacao` | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | Data da solicitação |
| `ProblemaDefeito` | TEXT | Descrição do problema |
| `DataCompra` | DATE | Data da compra do produto |
| `DataGarantia` | DATE | Data de vencimento da garantia |
| `ResponsavelID` | INT(11) FK | Técnico responsável |
| `ServicoRealizado` | TEXT | Descrição do serviço |
| `DataManutencao` | DATE | Data da manutenção |
| `Status` | VARCHAR(50) DEFAULT 'Pendente' | Pendente, Em Andamento, Concluído |
| `Valor` | DECIMAL(10,2) DEFAULT 0.00 | Valor cobrado |
| `Observacoes` | TEXT | Observações |

**Índices:**
- PRIMARY KEY (`ID`)
- UNIQUE (`CodigoManutencao`)
- INDEX (`ClienteID`, `ResponsavelID`)

**Relacionamentos:**
- `ClienteID` → `Clientes.ID`
- `ResponsavelID` → `Usuarios.ID`

**Backend:** `handleGetManutencoes()`, `handleAddManutencao()`

---

### 24. `ChatMensagens`
**Descrição:** Mensagens do chat interno entre usuários.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `RemetenteID` | INT(11) FK NOT NULL | Usuário que enviou |
| `DestinatarioID` | INT(11) FK NOT NULL | Usuário que recebe |
| `Mensagem` | TEXT NOT NULL | Conteúdo da mensagem |
| `DataEnvio` | DATETIME DEFAULT CURRENT_TIMESTAMP | Data/hora do envio |
| `Lida` | TINYINT(1) DEFAULT 0 | Se foi lida (0=não, 1=sim) |

**Índices:**
- PRIMARY KEY (`ID`)
- INDEX (`RemetenteID`, `DestinatarioID`)

**Relacionamentos:**
- `RemetenteID` → `Usuarios.ID`
- `DestinatarioID` → `Usuarios.ID`

**Backend:** `handleEnviarMensagem()`, `handleGetChatMensagens()`

---

### 25. `AvisosSistema`
**Descrição:** Notificações globais do sistema.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `Titulo` | VARCHAR(100) NOT NULL | Título do aviso |
| `Mensagem` | TEXT NOT NULL | Conteúdo |
| `Tipo` | VARCHAR(20) DEFAULT 'info' | info, warning, error, success |
| `DataExpiracao` | DATETIME | Data de expiração (opcional) |
| `Ativo` | TINYINT(1) DEFAULT 1 | Se está ativo |
| `CriadoPor` | INT(11) FK | Usuário que criou |
| `DataCriacao` | DATETIME DEFAULT CURRENT_TIMESTAMP | Data de criação |

**Índices:**
- PRIMARY KEY (`ID`)
- INDEX (`CriadoPor`)

**Relacionamentos:**
- `CriadoPor` → `Usuarios.ID`

**Backend:** `handleGetAvisosSistema()`, `handleAddAvisoSistema()`

---

### 26. `Movimentacoes`
**Descrição:** Movimentações gerais de materiais (histórico geral).

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ID` | INT(11) PK AUTO_INCREMENT | Identificador único |
| `Timestamp` | DATETIME DEFAULT CURRENT_TIMESTAMP | Data/hora |
| `TipoMovimentacao` | VARCHAR(100) | Tipo da movimentação |
| `NaturezaOperacao` | VARCHAR(50) | Natureza |
| `Descricao` | VARCHAR(250) | Descrição |
| `Lote` | VARCHAR(100) | Número do lote |
| `PesoKG` | DECIMAL(10,2) | Peso em KG |
| `OrigemDestino` | VARCHAR(150) | Origem/Destino |
| `Observacao` | TEXT | Observações |
| `Usuario` | VARCHAR(50) | Usuário responsável |

**Índices:**
- PRIMARY KEY (`ID`)

**Backend:** `handleGetMovimentacoes()`, `handleAddMovimentacao()`

---

## 🔗 Relacionamentos e Foreign Keys

### Relacionamentos Críticos

#### Fluxo de Vendas
```sql
Usuarios (1) ──→ (N) Orcamentos
Orcamentos (1) ──→ (N) ItensOrcamento
Orcamentos (1) ──→ (1) Pedidos (ao aprovar)
Pedidos (1) ──→ (N) ItensPedido
Pedidos (1) ──→ (1) ContasReceber
```

#### Fluxo de Produção
```sql
ItensPedido (1) ──→ (N) BobinasUtilizadas
BobinasUtilizadas (N) ──→ (1) Bobinas
```

#### Fluxo de Estoque
```sql
Produtos (1) ──→ (N) EstoqueProdutos
Produtos (1) ──→ (N) MovimentacoesEstoqueProdutos
```

#### Controle de Acesso
```sql
Usuarios (1) ──→ (N) Permissoes
Usuarios (1) ──→ (0..1) Funcionarios
```

### Foreign Keys com Ações

| Tabela | FK | Ação ON DELETE |
|--------|-----|----------------|
| `Permissoes` | UsuarioID | CASCADE (deleta permissões ao deletar usuário) |
| `EstoqueProdutos` | ProdutoID | CASCADE (deleta estoque ao deletar produto) |
| `ItensOrcamento` | OrcamentoID | CASCADE (deleta itens ao deletar orçamento) |
| `ItensPedido` | PedidoID | CASCADE (deleta itens ao deletar pedido) |
| `ContasReceber` | PedidoID | CASCADE (deleta conta ao deletar pedido) |
| `Funcionarios` | UsuarioID | SET NULL (mantém funcionário, remove vínculo) |

---

## ⚡ Índices e Performance

### Índices Principais

#### Chaves Primárias (AUTO_INCREMENT)
Todas as tabelas possuem `ID INT(11) AUTO_INCREMENT PRIMARY KEY`

#### Índices UNIQUE (Evitam Duplicatas)
- `Usuarios.NomeUsuario`
- `Usuarios.Email`
- `Orcamentos.NumeroOrcamento`
- `Bobinas.Lote`
- `Produtos.NomeItem`
- `NotasFiscais.ChaveAcesso`
- `Fornecedores.CNPJ`
- `Funcionarios.CPF`

#### Índices Compostos (Performance em Queries)
- `EstoqueProdutos` → `(ProdutoID, Localizacao)` UNIQUE
- `MovimentacoesEstoqueProdutos` → `(ProdutoID, DataMovimentacao)`

#### Dicas de Performance

```sql
-- ✅ BOM: Usa índice
SELECT * FROM Produtos WHERE ID = 123;
SELECT * FROM Orcamentos WHERE NumeroOrcamento = '1225-0001';

-- ✅ BOM: Usa índice composto
SELECT * FROM EstoqueProdutos
WHERE ProdutoID = 10 AND Localizacao = 'Armazém A';

-- ⚠️ ATENÇÃO: Full table scan (sem índice)
SELECT * FROM Produtos WHERE PrecoConsumidor > 100;

-- ✅ SOLUÇÃO: Adicionar índice se necessário
CREATE INDEX idx_preco ON Produtos(PrecoConsumidor);
```

---

## 🔧 Triggers e Procedimentos

Atualmente o sistema **NÃO utiliza triggers ou stored procedures**. Toda a lógica de negócio está implementada no backend PHP.

### Possíveis Melhorias Futuras

#### 1. Trigger para Atualizar Estoque Automaticamente
```sql
DELIMITER $$
CREATE TRIGGER after_movimentacao_insert
AFTER INSERT ON MovimentacoesEstoqueProdutos
FOR EACH ROW
BEGIN
    UPDATE EstoqueProdutos
    SET Quantidade = NEW.QuantidadeAtual,
        UltimaMovimentacao = NOW()
    WHERE ProdutoID = NEW.ProdutoID;
END$$
DELIMITER ;
```

#### 2. Stored Procedure para Gerar Número de Orçamento
```sql
DELIMITER $$
CREATE PROCEDURE GerarNumeroOrcamento(OUT numero VARCHAR(50))
BEGIN
    DECLARE prefixo VARCHAR(10);
    DECLARE proximo INT;

    SET prefixo = CONCAT(LPAD(MONTH(NOW()), 2, '0'), RIGHT(YEAR(NOW()), 2), '-');

    SELECT COALESCE(MAX(CAST(SUBSTRING(NumeroOrcamento, -4) AS UNSIGNED)), 0) + 1
    INTO proximo
    FROM Orcamentos
    WHERE NumeroOrcamento LIKE CONCAT(prefixo, '%');

    SET numero = CONCAT(prefixo, LPAD(proximo, 4, '0'));
END$$
DELIMITER ;
```

---

## 🛠️ Queries Úteis

### Relatórios Financeiros

#### DRE (Demonstrativo de Resultado do Exercício)
```sql
-- Receitas do mês
SELECT
    SUM(Valor) as TotalReceitas,
    COUNT(*) as QtdRecebimentos
FROM ContasReceber
WHERE MONTH(DataRecebimento) = MONTH(CURDATE())
  AND YEAR(DataRecebimento) = YEAR(CURDATE())
  AND Status = 'Pago';

-- Despesas do mês
SELECT
    SUM(Valor) as TotalDespesas,
    COUNT(*) as QtdPagamentos
FROM ContasPagar
WHERE MONTH(DataPagamento) = MONTH(CURDATE())
  AND YEAR(DataPagamento) = YEAR(CURDATE())
  AND Status = 'Pago';

-- Lucro do mês
SELECT
    (SELECT COALESCE(SUM(Valor), 0) FROM ContasReceber
     WHERE MONTH(DataRecebimento) = MONTH(CURDATE())
     AND Status = 'Pago') -
    (SELECT COALESCE(SUM(Valor), 0) FROM ContasPagar
     WHERE MONTH(DataPagamento) = MONTH(CURDATE())
     AND Status = 'Pago') as LucroMes;
```

#### Produtos em Estoque Crítico
```sql
SELECT
    p.NomeItem,
    ep.Localizacao,
    ep.Quantidade as Atual,
    ep.QuantidadeMinima as Minimo,
    (ep.Quantidade - ep.QuantidadeMinima) as Diferenca
FROM EstoqueProdutos ep
JOIN Produtos p ON ep.ProdutoID = p.ID
WHERE ep.Quantidade <= ep.QuantidadeMinima
ORDER BY Diferenca ASC;
```

#### Top 10 Produtos Mais Vendidos
```sql
SELECT
    ip.ItemNome,
    SUM(ip.Quantidade) as TotalVendido,
    COUNT(DISTINCT ip.PedidoID) as QtdPedidos,
    SUM(ip.ValorTotalItem) as Faturamento
FROM ItensPedido ip
JOIN Pedidos p ON ip.PedidoID = p.ID
WHERE p.StatusPedido != 'Cancelado'
  AND YEAR(p.DataPedido) = YEAR(CURDATE())
GROUP BY ip.ItemNome
ORDER BY TotalVendido DESC
LIMIT 10;
```

#### Orçamentos Pendentes de Aprovação
```sql
SELECT
    o.NumeroOrcamento,
    o.ClienteNome,
    o.ValorTotal,
    o.DataOrcamento,
    DATEDIFF(NOW(), o.DataOrcamento) as DiasEspera,
    u.NomeCompleto as Vendedor
FROM Orcamentos o
JOIN Usuarios u ON o.UsuarioID = u.ID
WHERE o.Status = 'pendente'
ORDER BY o.DataOrcamento ASC;
```

#### Fila de Produção (Itens Pendentes)
```sql
SELECT
    p.NumeroPedido,
    p.ClienteNome,
    ip.ItemNome,
    ip.Quantidade,
    ip.UnidadeMedida,
    p.DataPedido,
    DATEDIFF(NOW(), p.DataPedido) as DiasPendente
FROM ItensPedido ip
JOIN Pedidos p ON ip.PedidoID = p.ID
WHERE ip.StatusProducao = 'Pendente'
  AND p.StatusPedido != 'Cancelado'
ORDER BY p.DataPedido ASC;
```

#### Histórico de Uso de Bobinas
```sql
SELECT
    b.Lote,
    b.Tipo,
    p.NumeroPedido,
    ip.ItemNome,
    bu.PesoUsado,
    bu.SucataGerada,
    ((bu.SucataGerada / bu.PesoUsado) * 100) as PercentualSucata,
    bu.DataUso
FROM BobinasUtilizadas bu
JOIN Bobinas b ON bu.BobinaID = b.ID
JOIN ItensPedido ip ON bu.ItemPedidoID = ip.ID
JOIN Pedidos p ON ip.PedidoID = p.ID
ORDER BY bu.DataUso DESC;
```

---

## 💾 Backup e Manutenção

### Comandos de Backup

#### Backup Completo
```bash
mysqldump -u usuario -p atriu019_sinergy > backup_sinergy_$(date +%Y%m%d).sql
```

#### Backup Apenas Estrutura
```bash
mysqldump -u usuario -p --no-data atriu019_sinergy > estrutura_sinergy.sql
```

#### Backup Apenas Dados
```bash
mysqldump -u usuario -p --no-create-info atriu019_sinergy > dados_sinergy.sql
```

### Restauração
```bash
mysql -u usuario -p atriu019_sinergy < backup_sinergy.sql
```

### Manutenção Regular

#### Verificar Tabelas
```sql
CHECK TABLE Orcamentos, Pedidos, EstoqueProdutos;
```

#### Otimizar Tabelas
```sql
OPTIMIZE TABLE Orcamentos, Pedidos, EstoqueProdutos;
```

#### Analisar Tabelas (Atualiza Estatísticas)
```sql
ANALYZE TABLE Orcamentos, Pedidos, EstoqueProdutos;
```

---

## 🔍 Troubleshooting

### Problemas Comuns

#### 1. Erro ao Aprovar Orçamento
**Sintoma:** Erro ao converter orçamento em pedido

**Diagnóstico:**
```sql
-- Verificar estrutura das tabelas
DESCRIBE Pedidos;
DESCRIBE ItensPedido;
DESCRIBE ContasReceber;

-- Verificar se orçamento existe
SELECT * FROM Orcamentos WHERE ID = 123;

-- Verificar itens do orçamento
SELECT * FROM ItensOrcamento WHERE OrcamentoID = 123;
```

#### 2. Estoque Negativo
**Sintoma:** Quantidade negativa em EstoqueProdutos

**Diagnóstico:**
```sql
SELECT
    p.NomeItem,
    ep.Localizacao,
    ep.Quantidade
FROM EstoqueProdutos ep
JOIN Produtos p ON ep.ProdutoID = p.ID
WHERE ep.Quantidade < 0;
```

**Correção:**
```sql
-- Ajustar estoque manualmente (com cuidado!)
UPDATE EstoqueProdutos
SET Quantidade = 0
WHERE Quantidade < 0;
```

#### 3. Foreign Key Constraint Fails
**Sintoma:** Erro ao deletar registro

**Diagnóstico:**
```sql
-- Verificar relacionamentos
SELECT
    CONSTRAINT_NAME,
    TABLE_NAME,
    REFERENCED_TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_NAME = 'Produtos'
  AND TABLE_SCHEMA = 'atriu019_sinergy';
```

---

## 📚 Considerações Finais

### Boas Práticas

1. **Sempre use transações** para operações que afetam múltiplas tabelas
2. **Faça backup regular** (diário recomendado)
3. **Monitore o tamanho** das tabelas com logs (MovimentacoesEstoqueProdutos, ChatMensagens)
4. **Não delete dados** sem backup, prefira soft delete (campo `Ativo`)
5. **Documente alterações** na estrutura do banco

### Melhorias Futuras Sugeridas

- [ ] Implementar soft delete em todas as tabelas
- [ ] Adicionar tabela de Audit Log (quem/quando/o quê alterou)
- [ ] Criar views para relatórios complexos
- [ ] Implementar particionamento em tabelas grandes
- [ ] Adicionar campos de versionamento (created_at, updated_at)

---

**Última Atualização:** Dezembro 2024
**Versão do Banco:** 2.0
**Charset:** UTF-8 Unicode (utf8_unicode_ci)
**Engine:** InnoDB
