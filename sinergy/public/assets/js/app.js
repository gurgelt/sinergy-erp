/**
 * app.js - Script Global de Autenticação, Permissões e Funcionalidades Comuns
 * ATUALIZADO: Correção de Segurança - Home protegida por Login
 */

const USERS_STORAGE_KEY = 'sinergy_users'; 
const REMEMBER_USER_KEY = 'sinergy_remember';
const USER_ID_KEY = 'sinergy_user_id';
const USER_ROLE_KEY = 'sinergy_user_role';
const USER_NAME_KEY = 'sinergy_user_name'; 
const LOGIN_FLASH_KEY = 'sinergy_login_success_flash'; 

document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup inicial
    setupLoaderHiding();

    // 2. Verifica Flash Message (Login Sucesso)
    if (sessionStorage.getItem(LOGIN_FLASH_KEY)) {
        setTimeout(() => {
            if (window.NotificationManager) {
                window.NotificationManager.show({ 
                    title: 'Bem-vindo!', 
                    message: 'Login efetuado com sucesso.', 
                    type: 'success',
                    duration: 4000
                });
            }
            sessionStorage.removeItem(LOGIN_FLASH_KEY);
        }, 800);
    }

    const rememberedUser = getLoggedInUser(); 
    const userId = getLoggedInUserID(); 
    const role = getLoggedInUserRole();

    // Detecta se é página de login para não redirecionar em loop
    const isAuthPage = window.location.pathname.includes('login.html') || window.location.pathname.includes('reset-password.html');

    // === 3. BLOQUEIO DE SEGURANÇA ===
    // Se não tem usuário e não está na tela de login, redireciona IMEDIATAMENTE.
    // O CSS "body:not(.access-granted)" manterá a tela branca durante esse processo.
    if (!rememberedUser || !userId) { 
        if (!isAuthPage) {
            redirectToLogin();
            return; // Interrompe todo o resto do script
        }
    } else {
        // Se está logado mas tenta acessar a tela de login, manda pra home
        if (isAuthPage) {
            window.location.href = '../index.html';
            return;
        }
        
        // Carrega perfil e permissões
        loadAndSetupUserProfile(rememberedUser); 
        setupUserProfileDropdown();
        checkAndApplyPermissions(userId, role);
    }
});

async function checkAndApplyPermissions(userId, role) {
    // Admin tem acesso total
    if (role === 'admin') {
        document.body.classList.add('access-granted');
        return;
    }

    try {
        const res = await fetch(`https://virtualcriacoes.com/sinergy/api/permissoes/${userId}`);
        if (res.ok) {
            const modulosPermitidos = await res.json();
            applyMenuPermissions(modulosPermitidos);
        } else {
            console.error("Erro na API de permissões. Status:", res.status);
            handleApiFailure(); 
        }
    } catch (e) {
        console.error("Erro de conexão com permissões", e);
        handleApiFailure();
    }
}

function handleApiFailure() {
    const page = getPageName();
    // Apenas páginas que NÃO precisam de dados sensíveis
    const publicPages = ['consulta.html', 'suporte.html', 'meus-dados.html'];
    
    if (publicPages.includes(page)) {
        document.body.classList.add('access-granted');
    } else {
        showAccessDeniedModal(true);
    }
}

function getPageName() {
    let path = window.location.pathname;
    let page = path.split('/').pop();
    if (page === '' || page === '/') return 'index.html';
    return page.split('?')[0];
}

function applyMenuPermissions(permitidos) {
    const currentPage = getPageName();

    // === 1. LISTA BRANCA (Páginas que não exigem permissão de MÓDULO, mas exigem LOGIN) ===
    // Removi index.html da verificação de módulo, mas ele já passou pela verificação de login lá em cima.
    const commonPages = [
        'index.html', 'consulta.html', 'suporte.html', 'meus-dados.html'
    ];

    // === 2. MAPEAMENTO DE PÁGINAS RESTRITAS ===
    const restrictedPages = {
        'suprimentos.html': 'suprimentos',
        'estoque.html': 'estoque',
        'saldo.html': 'estoque',
        'orcamentos.html': 'comercial',
        'pedidos.html': 'comercial',
        'financeiro.html': 'financeiro',
        'contasapagar.html': 'financeiro',
        'contasareceber.html': 'financeiro',
        'informacoes.html': 'comex',
        'documentos.html': 'comex',
        'rastreio.html': 'comex',
        'funcionarios.html': 'rh',
        'manutencoes.html': 'manutencao',
        'produtos.html': 'producao',
        'movimentacoes.html': 'movimentacoes',
        'relatorios.html': 'relatorios'
    };

    // 3. Bloqueio visual do menu (Sidebar)
    const menuItems = document.querySelectorAll('.items-nav[data-module]');
    menuItems.forEach(item => {
        const modulo = item.dataset.module;
        if (!permitidos.includes(modulo)) {
            item.classList.add('restricted');
            item.classList.remove('has-submenu'); 
            const submenu = item.querySelector('.submenu');
            if (submenu) submenu.remove();
            
            const link = item.querySelector('a');
            if (link) {
                link.setAttribute('href', '#'); 
                link.setAttribute('onclick', 'return false;'); 
                if (!link.querySelector('.lock-icon')) {
                    const lockIcon = document.createElement('i');
                    lockIcon.className = 'fas fa-lock lock-icon';
                    lockIcon.title = 'Acesso Bloqueado';
                    link.appendChild(lockIcon);
                }
            }
        }
    });

    // === 4. LIBERAÇÃO DA TELA ===
    
    // Se for página comum (Home, Suporte, etc), libera, pois o login já foi verificado
    if (commonPages.includes(currentPage)) {
        document.body.classList.add('access-granted');
        return;
    }

    // Se for página restrita, verifica se tem o módulo
    const moduloNecessario = restrictedPages[currentPage];

    if (!moduloNecessario) {
        // Página nova sem mapeamento? Libera por padrão (segurança média) ou bloqueia (alta)
        document.body.classList.add('access-granted');
        return;
    }

    if (!permitidos.includes(moduloNecessario)) {
        // BLOQUEADO
        showAccessDeniedModal();
    } else {
        // PERMITIDO
        document.body.classList.add('access-granted');
    }
}

function showAccessDeniedModal(isSystemError = false) {
    const existing = document.getElementById('modal-acesso-negado');
    if (existing) existing.remove();

    const styleOverride = `
        position: fixed; 
        top: 0; left: 0; width: 100%; height: 100%; 
        display: flex !important; 
        align-items: center; justify-content: center; 
        z-index: 2147483647; 
        background-color: #f5f7fa;
    `;

    const title = isSystemError ? 'Erro de Sistema' : 'Acesso Negado';
    const msg = isSystemError 
        ? 'Não foi possível validar suas permissões. Verifique sua conexão.' 
        : 'Você não possui permissão para acessar este módulo.<br>Solicite acesso ao administrador.';
    
    const homePath = window.location.pathname.includes('/pages/') ? '../index.html' : 'index.html';

    const modalHTML = `
        <div id="modal-acesso-negado" style="${styleOverride}">
            <div style="background: white; max-width: 400px; width: 90%; text-align: center; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                <div style="width: 80px; height: 80px; background-color: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                    <i class="fas fa-lock" style="color: #ef4444; font-size: 36px;"></i>
                </div>
                <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 22px; font-family: sans-serif;">${title}</h2>
                <p style="color: #6b7280; margin-bottom: 25px; font-size: 15px; line-height: 1.5; font-family: sans-serif;">${msg}</p>
                <button id="btn-redirect-home" style="width: 100%; background-color: #ef4444; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: background 0.2s; font-size: 14px;">
                    <i class="fas fa-arrow-left" style="margin-right: 8px;"></i> Voltar para o Início
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('btn-redirect-home').addEventListener('click', () => {
        window.location.href = homePath;
    });
}

function setupLoaderHiding() {
    // Fallback para esconder loader se demorar muito
    setTimeout(() => {
        const loader = document.getElementById('loader-overlay');
        if (loader) loader.style.display = 'none';
    }, 3000);

    window.addEventListener('load', () => {
        const loaderOverlay = document.getElementById('loader-overlay');
        if (loaderOverlay) {
            loaderOverlay.classList.add('hidden');
            setTimeout(() => {
                if (loaderOverlay.parentNode) loaderOverlay.parentNode.removeChild(loaderOverlay);
            }, 500);
        }
    });
}

async function loadAndSetupUserProfile(username) {
    try {
        const apiPath = 'https://virtualcriacoes.com/sinergy/api'; 
        const response = await fetch(`${apiPath}/users/${username}`);
        
        if (!response.ok) {
            // Se falhar ao carregar o usuário (ex: deletado do banco), desloga
            logout(); 
            return;
        }
        const currentUser = await response.json();
        updateTopBar(currentUser);
    } catch (error) {
        console.error('Erro de rede ao carregar perfil do usuário:', error);
    }
}

function updateTopBar(user) {
    const userNameElement = document.getElementById('user-name');
    const userEmailElement = document.getElementById('user-email');
    const userAvatarElement = document.getElementById('user-avatar'); 

    if(userNameElement) userNameElement.textContent = user.NomeCompleto || user.NomeUsuario || 'Usuário';
    if(userEmailElement) userEmailElement.textContent = user.Email || 'email@exemplo.com';

    if (userAvatarElement) {
        userAvatarElement.src = user.FotoPerfilBase64 || 'https://i.pravatar.cc/100';
    }
}

function setupUserProfileDropdown() {
    const userProfile = document.getElementById('user-profile-container');
    const dropdownMenu = document.getElementById('user-dropdown-menu');
    if (!userProfile || !dropdownMenu) return;

    userProfile.addEventListener('click', (event) => {
        event.stopPropagation();
        dropdownMenu.classList.toggle('visible');
        userProfile.classList.toggle('open');
    });

    window.addEventListener('click', () => {
        dropdownMenu.classList.remove('visible');
        userProfile.classList.remove('open');
    });

    document.getElementById('logout-btn')?.addEventListener('click', (e) => { e.preventDefault(); logout(); });
    document.getElementById('meus-dados-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        const profilePath = window.location.pathname.includes('/pages/') ? 'meus-dados.html' : './pages/meus-dados.html';
        window.location.href = profilePath;
    });
}

function logout() {
    localStorage.removeItem(REMEMBER_USER_KEY);
    sessionStorage.removeItem(REMEMBER_USER_KEY);
    localStorage.removeItem(USER_ID_KEY); 
    sessionStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(USER_ROLE_KEY); 
    sessionStorage.removeItem(USER_ROLE_KEY);
    localStorage.removeItem(USER_NAME_KEY); 
    sessionStorage.removeItem(USER_NAME_KEY); 
    
    setTimeout(() => { redirectToLogin(); }, 500);
}

function redirectToLogin() {
    if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('reset-password.html')) {
        sessionStorage.setItem('redirect_after_login', window.location.href);
        const loginPath = window.location.pathname.includes('/pages/') ? 'login.html' : './pages/login.html';
        window.location.href = loginPath;
    }
}

function getLoggedInUser() { return localStorage.getItem(REMEMBER_USER_KEY) || sessionStorage.getItem(REMEMBER_USER_KEY); }
function getLoggedInUserID() { return localStorage.getItem(USER_ID_KEY) || sessionStorage.getItem(USER_ID_KEY); }
function getLoggedInUserRole() { return localStorage.getItem(USER_ROLE_KEY) || sessionStorage.getItem(USER_ROLE_KEY); }
function getLoggedInUserFullName() { return localStorage.getItem(USER_NAME_KEY) || sessionStorage.getItem(USER_NAME_KEY); }

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => { m.classList.remove('active', 'is-active'); m.style.display = 'none'; });
}

window.closeAllModals = closeAllModals;
window.getLoggedInUser = getLoggedInUser;
window.getLoggedInUserID = getLoggedInUserID;
window.getLoggedInUserRole = getLoggedInUserRole;
window.getLoggedInUserFullName = getLoggedInUserFullName; 

function loginSuccess(data, remember) {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(REMEMBER_USER_KEY, data.username);
    storage.setItem(USER_ID_KEY, data.id); 
    storage.setItem(USER_ROLE_KEY, data.role);
    storage.setItem(USER_NAME_KEY, data.fullname); 
    
    // Define o Flash Message para exibir na próxima tela
    sessionStorage.setItem(LOGIN_FLASH_KEY, 'true');

    const redirectUrl = sessionStorage.getItem('redirect_after_login');
    window.location.href = redirectUrl || (window.location.pathname.includes('/pages/') ? '../index.html' : 'index.html');
}