# Sistema Sinergy - ERP

Sistema de Gestão Empresarial (ERP) desenvolvido para a ATRON.

## 📋 Descrição

Sistema completo de gestão empresarial com módulos de:
- 📦 Gestão de Estoque (Bobinas e Produtos)
- 🏭 Controle de Produção
- 💰 Financeiro (Contas a Pagar/Receber, Tesouraria)
- 🛒 Comercial (Orçamentos e Pedidos)
- 🌍 Comércio Exterior (COMEX)
- 👥 Recursos Humanos
- 🔧 Manutenções
- 📊 Relatórios e Dashboards

---

## 🚀 Deploy na Hostgator - Passo a Passo

### **1. Baixar do GitHub**
- Clique no botão verde **Code**
- Selecione **Download ZIP**
- Extraia o arquivo baixado

### **2. Compactar a Pasta**
- Localize a pasta `sinergy` extraída
- Clique com botão direito → **Enviar para** → **Pasta compactada (zip)**
- Você terá: `sinergy.zip`

### **3. Upload no cPanel**
- Acesse o cPanel da Hostgator
- Abra **File Manager**
- Navegue até `public_html/`
- Clique em **Upload**
- Envie o arquivo `sinergy.zip`
- Aguarde o upload terminar

### **4. Extrair no Servidor**
- No File Manager, localize `sinergy.zip`
- Clique com botão direito → **Extract**
- Clique em **Extract Files**
- Aguarde a extração
- (Opcional) Delete o arquivo `sinergy.zip`

### **5. Criar arquivo .env** ⚠️ **IMPORTANTE**
- Entre na pasta `sinergy`
- Clique em **+ File**
- Nome: `.env` (com o ponto!)
- Edite o arquivo e cole:

```env
# Configurações do Banco de Dados
DB_HOST=localhost
DB_NAME=seu_banco
DB_USER=seu_usuario
DB_PASSWORD=sua_senha

# Configurações da Aplicação
APP_ENV=production
APP_DEBUG=false
APP_URL=https://seu-dominio.com

# Configurações de Segurança
SESSION_LIFETIME=7200
CORS_ALLOWED_ORIGINS=*

# API Settings
API_BASE_PATH=/api
```

**⚠️ ATENÇÃO:** Substitua `DB_NAME`, `DB_USER` e `DB_PASSWORD` pelas credenciais reais do seu MySQL na Hostgator!

- Clique em **Save Changes**

### **6. Ajustar Permissões**
- Localize a pasta `logs`
- Clique com botão direito → **Change Permissions**
- Digite `777`
- Clique em **Change Permissions**

### **7. Testar**
Abra no navegador:
```
https://seu-dominio.com/sinergy/api/status
```

**Deve retornar:**
```json
{
    "status": "success",
    "message": "API funcionando corretamente"
}
```

**Frontend:**
```
https://seu-dominio.com/sinergy/public/
```

---

## 🏗️ Estrutura do Projeto

```
sinergy/
├── .env                    # Configurações (criar manualmente)
├── .env.example           # Exemplo de configuração
├── .gitignore             # Arquivos ignorados pelo Git
├── .htaccess              # Configurações Apache
├── README.md              # Este arquivo
│
├── api/                   # API REST
│   ├── index.php         # Router da API
│   └── .htaccess         # Configurações da API
│
├── config/                # Configurações do sistema
│   ├── config.php        # Configurações gerais
│   ├── database.php      # Conexão com banco
│   └── cors.php          # Configurações CORS
│
├── src/                   # Código-fonte backend
│   ├── autoload.php      # Autoloader
│   ├── legacy_functions.php  # Handlers da API
│   ├── Controllers/      # Controllers
│   └── Utils/            # Utilitários
│
├── public/                # Arquivos públicos
│   ├── index.html        # Página principal
│   ├── .htaccess
│   ├── assets/           # CSS, JS, Images
│   └── pages/            # Páginas HTML
│
└── logs/                  # Logs do sistema (777)
```

---

## 🔒 Segurança

### Arquivo .env
- **NUNCA** versione o arquivo `.env` com credenciais reais
- Use o `.env.example` como modelo
- O `.env` está protegido no `.gitignore`

### Permissões Recomendadas
- Pastas: `755`
- Arquivos: `644`
- Pasta `logs/`: `777` (necessita escrita)

---

## ⚙️ Tecnologias

**Backend:**
- PHP 7.4+
- MySQL 5.7+
- Apache

**Frontend:**
- HTML5
- CSS3
- JavaScript (Vanilla)
- Chart.js
- Font Awesome

---

## 🆘 Problemas Comuns

### Erro 500
**Causa:** Permissões incorretas ou .env com erro

**Solução:**
- Verifique permissão 777 na pasta `logs/`
- Verifique se o `.env` foi criado
- Verifique credenciais do banco

### API retorna HTML ao invés de JSON
**Causa:** mod_rewrite não funcionando

**Solução:**
- Teste: `https://seu-dominio.com/sinergy/api/index.php`
- Se funcionar, contate Hostgator para habilitar mod_rewrite

### Erro de conexão com banco
**Causa:** Credenciais incorretas no `.env`

**Solução:**
- No cPanel → **MySQL Databases**
- Verifique nome do banco, usuário e senha
- Atualize o `.env`

---

## ✅ Checklist de Deploy

- [ ] Baixou do GitHub
- [ ] Compactou em ZIP
- [ ] Fez upload no cPanel
- [ ] Extraiu o ZIP
- [ ] Criou arquivo `.env`
- [ ] Configurou credenciais do banco no `.env`
- [ ] Ajustou permissão 777 na pasta `logs/`
- [ ] Testou `/api/status`
- [ ] Frontend carrega corretamente

---

## 📞 Suporte

Para problemas técnicos, verifique:
1. Logs em: `logs/php_errors.log`
2. Erros do Apache no cPanel → **Errors**

---

## 📄 Licença

Uso interno - ATRON

---

**Versão:** 2.0
**Última atualização:** Novembro 2025
