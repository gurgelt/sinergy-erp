/**
 * js/sidebar.js - Controle Inteligente do Menu Lateral
 * VERSÃO MODERNA - Corrigido problema de seleção e melhorado UX
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeSidebar();
});

function initializeSidebar() {
    setupActiveLinks();
    setupSidebarToggle();
    addTooltips();
}

/**
 * Configura os links ativos baseado na URL atual
 */
function setupActiveLinks() {
    const currentPath = window.location.pathname;
    const allLinks = document.querySelectorAll('.ul-nav a');

    // 1. Limpa TODOS os estados ativos anteriores
    clearAllActiveStates();

    // 2. Identifica e ativa a página atual
    let pageFound = false;

    allLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href === '#' || href.startsWith('javascript')) return;

        const pageName = href.split('/').pop();
        const isCurrentPage = currentPath.includes(pageName) || 
                              (pageName === 'index.html' && (currentPath.endsWith('/') || currentPath.endsWith('index.html')));

        if (isCurrentPage && !pageFound) {
            pageFound = true;
            
            // Se for um link dentro de submenu
            if (link.closest('.submenu')) {
                activateSubmenuItem(link);
            } 
            // Se for um link direto (sem submenu)
            else {
                activateDirectLink(link);
            }
        }
    });

    // 3. Setup dos event listeners para os menus accordion
    setupAccordionBehavior();
}

/**
 * Limpa todos os estados ativos
 */
function clearAllActiveStates() {
    // Remove classe 'active' de links simples
    document.querySelectorAll('.items-nav:not(.has-submenu) > a').forEach(link => {
        link.classList.remove('active');
    });
    
    // Remove classe 'active' de links dentro de submenu
    document.querySelectorAll('.submenu a').forEach(link => {
        link.classList.remove('active');
    });
    
    // Remove classe 'open' dos pais (usa 'open' ao invés de 'active' para diferenciar)
    document.querySelectorAll('.items-nav.has-submenu').forEach(parent => {
        parent.classList.remove('open', 'active');
    });
    
    // Fecha todos os submenus
    document.querySelectorAll('.submenu').forEach(submenu => {
        submenu.style.display = 'none';
    });
}

/**
 * Ativa um link dentro de submenu
 */
function activateSubmenuItem(link) {
    link.classList.add('active');
    
    const parent = link.closest('.items-nav.has-submenu');
    if (parent) {
        parent.classList.add('open'); // Usa 'open' para indicar submenu aberto
        const submenu = parent.querySelector('.submenu');
        if (submenu) {
            submenu.style.display = 'block';
        }
    }
}

/**
 * Ativa um link direto (sem submenu)
 */
function activateDirectLink(link) {
    link.classList.add('active');
    const parentLi = link.closest('.items-nav');
    if (parentLi) {
        parentLi.classList.add('active');
    }
}

/**
 * Configura o comportamento de acordeão dos submenus
 */
function setupAccordionBehavior() {
    // Remove listeners antigos para evitar duplicação
    const parentLinks = document.querySelectorAll('.has-submenu > a');
    
    parentLinks.forEach(toggle => {
        // Clone o elemento para remover todos os event listeners antigos
        const newToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(newToggle, toggle);
    });

    // Adiciona novos listeners
    document.querySelectorAll('.has-submenu > a').forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const parent = this.parentElement;
            const submenu = parent.querySelector('.submenu');
            const wasOpen = parent.classList.contains('open');

            // Fecha todos os outros submenus (comportamento acordeão)
            document.querySelectorAll('.items-nav.has-submenu.open').forEach(item => {
                if (item !== parent) {
                    item.classList.remove('open');
                    const otherSubmenu = item.querySelector('.submenu');
                    if (otherSubmenu) {
                        slideUp(otherSubmenu);
                    }
                }
            });

            // Toggle do menu atual
            if (wasOpen) {
                parent.classList.remove('open');
                if (submenu) slideUp(submenu);
            } else {
                parent.classList.add('open');
                if (submenu) slideDown(submenu);
            }
        });
    });

    // Adiciona listener para links dentro do submenu
    document.querySelectorAll('.submenu a').forEach(link => {
        link.addEventListener('click', function(e) {
            // Remove active de todos os links do submenu
            document.querySelectorAll('.submenu a').forEach(l => {
                l.classList.remove('active');
            });
            
            // Adiciona active no link clicado
            this.classList.add('active');
        });
    });
}

/**
 * Animação de slide down
 */
function slideDown(element) {
    element.style.display = 'block';
    element.style.maxHeight = '0px';
    element.style.overflow = 'hidden';
    element.style.transition = 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    
    setTimeout(() => {
        element.style.maxHeight = element.scrollHeight + 'px';
    }, 10);
    
    setTimeout(() => {
        element.style.maxHeight = '';
        element.style.overflow = '';
    }, 300);
}

/**
 * Animação de slide up
 */
function slideUp(element) {
    element.style.maxHeight = element.scrollHeight + 'px';
    element.style.overflow = 'hidden';
    element.style.transition = 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    
    setTimeout(() => {
        element.style.maxHeight = '0px';
    }, 10);
    
    setTimeout(() => {
        element.style.display = 'none';
        element.style.maxHeight = '';
        element.style.overflow = '';
    }, 300);
}

/**
 * Configura o botão de toggle da sidebar
 */
function setupSidebarToggle() {
    const btn = document.getElementById('sidebar-toggle');
    const body = document.body;
    const KEY = 'sinergy_sidebar_collapsed';

    // Recupera estado salvo
    const savedState = localStorage.getItem(KEY);
    if (savedState === 'true') {
        body.classList.add('sidebar-collapsed');
        // Fecha todos os submenus visualmente quando inicia colapsado
        document.querySelectorAll('.submenu').forEach(s => {
            s.style.display = 'none';
        });
    }

    if (btn) {
        btn.addEventListener('click', () => {
            body.classList.toggle('sidebar-collapsed');
            const isCollapsed = body.classList.contains('sidebar-collapsed');
            localStorage.setItem(KEY, isCollapsed);

            if (isCollapsed) {
                // Ao colapsar, fecha todos os submenus
                document.querySelectorAll('.submenu').forEach(s => {
                    slideUp(s);
                });
                document.querySelectorAll('.has-submenu').forEach(p => {
                    p.classList.remove('open');
                });
            } else {
                // Ao expandir, reabre o submenu da página atual
                setTimeout(() => {
                    setupActiveLinks();
                }, 100);
            }
        });
    }

    // Listener para quando o mouse sai da sidebar colapsada
    const header = document.querySelector('.cabecalho');
    if (header) {
        header.addEventListener('mouseleave', function() {
            if (body.classList.contains('sidebar-collapsed')) {
                // Fecha submenus quando o mouse sai da sidebar colapsada
                document.querySelectorAll('.submenu').forEach(s => {
                    if (s.style.display === 'block') {
                        slideUp(s);
                    }
                });
                // Remove a classe 'open' mas mantém o link ativo
                document.querySelectorAll('.has-submenu.open').forEach(p => {
                    const hasActiveChild = p.querySelector('.submenu a.active');
                    if (hasActiveChild) {
                        // Se tem filho ativo, mantém como 'open' visualmente mas fecha o submenu
                        // Isso garante que ao passar o mouse novamente ele saiba qual reabrir
                    }
                });
            }
        });

        header.addEventListener('mouseenter', function() {
            if (body.classList.contains('sidebar-collapsed')) {
                // Reabre o submenu que contém a página atual
                const activeSubmenuLink = document.querySelector('.submenu a.active');
                if (activeSubmenuLink) {
                    const parent = activeSubmenuLink.closest('.items-nav.has-submenu');
                    if (parent) {
                        parent.classList.add('open');
                        const submenu = parent.querySelector('.submenu');
                        if (submenu) {
                            slideDown(submenu);
                        }
                    }
                }
            }
        });
    }
}

/**
 * Adiciona tooltips aos itens do menu quando colapsado
 */
function addTooltips() {
    const menuLinks = document.querySelectorAll('.items-nav > a');
    
    menuLinks.forEach(link => {
        const textSpan = link.querySelector('span');
        if (textSpan) {
            const tooltipText = textSpan.textContent.trim();
            link.setAttribute('data-tooltip', tooltipText);
            link.setAttribute('title', ''); // Remove o title padrão do browser
        }
    });
}

/**
 * Função utilitária: debounce
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Listener para mudanças de rota (SPA)
 * Se você usar navegação SPA no futuro, pode usar isso
 */
window.addEventListener('popstate', debounce(() => {
    setupActiveLinks();
}, 100));