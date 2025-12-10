/**
 * chat-widget.js - Chat Sinergy (Versão Azul & Privada)
 */

const CHAT_API = 'https://virtualcriacoes.com/sinergy/api';
let chatWidgetUserID = null;
let chatWidgetPartnerID = null;
let chatWidgetInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    // Tenta pegar o ID do usuário de várias fontes seguras
    chatWidgetUserID = window.getLoggedInUserID ? window.getLoggedInUserID() : localStorage.getItem('usuarioID');
    
    if (chatWidgetUserID) {
        injectChatWidgetHTML();
        startWidgetHeartbeat();
    }
});

function injectChatWidgetHTML() {
    const html = `
        <div class="chat-launcher" onclick="window.toggleChatWindow()">
            <i class="fas fa-comment-dots"></i>
            <div class="chat-badge" id="chat-total-badge" style="display:none;">0</div>
        </div>

        <div class="chat-window" id="chat-window">
            <div id="view-contacts" style="display:flex; flex-direction:column; height:100%;">
                <div class="chat-header">
                    <h4>Mensagens Internas</h4>
                    <button class="btn-close-chat" onclick="window.toggleChatWindow()"><i class="fas fa-times"></i></button>
                </div>
                <div class="chat-body">
                    <div id="widget-user-list">
                        <p style="text-align:center; padding:20px; color:#95a5a6; font-size:13px;">Carregando equipe...</p>
                    </div>
                </div>
            </div>

            <div id="view-conversation" class="conversation-view">
                <div class="chat-header">
                    <div class="chat-partner-info">
                        <button class="btn-back" onclick="window.backToContacts()"><i class="fas fa-arrow-left"></i></button>
                        <h4 id="chat-partner-name">Nome</h4>
                    </div>
                    <button class="btn-close-chat" onclick="window.toggleChatWindow()"><i class="fas fa-times"></i></button>
                </div>
                
                <div class="messages-area" id="widget-messages-area"></div>

                <div class="chat-footer">
                    <form id="widget-form" style="display:flex; width:100%; gap:8px;" onsubmit="window.sendWidgetMessage(event)">
                        <input type="text" id="widget-input" placeholder="Digite sua mensagem..." autocomplete="off">
                        <button type="submit" class="btn-send"><i class="fas fa-paper-plane"></i></button>
                    </form>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

// === LÓGICA VISUAL ===

window.toggleChatWindow = function() {
    const win = document.getElementById('chat-window');
    win.classList.toggle('active');
    
    if (win.classList.contains('active')) {
        loadWidgetUsers();
        // Polling rápido (3s) quando aberto
        if(chatWidgetInterval) clearInterval(chatWidgetInterval);
        chatWidgetInterval = setInterval(() => {
            if(chatWidgetPartnerID) loadWidgetMessages(false);
            else loadWidgetUsers(true);
        }, 3000);
    } else {
        // Polling lento (15s) quando fechado
        if(chatWidgetInterval) clearInterval(chatWidgetInterval);
        chatWidgetInterval = setInterval(() => loadWidgetUsers(true), 15000);
    }
};

window.backToContacts = function() {
    document.getElementById('view-conversation').classList.remove('active');
    document.getElementById('view-contacts').style.display = 'flex';
    chatWidgetPartnerID = null;
    loadWidgetUsers();
};

// === LÓGICA DE DADOS ===

function startWidgetHeartbeat() {
    // 1. Sinal de vida inicial
    pingServer();
    // 2. Loop de background
    setInterval(pingServer, 20000);
}

function pingServer() {
    fetch(`${CHAT_API}/chat/heartbeat`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({usuarioID: chatWidgetUserID})
    }).catch(()=>{});
    
    // Atualiza badge se fechado
    if (!document.getElementById('chat-window')?.classList.contains('active')) {
        loadWidgetUsers(true);
    }
}

async function loadWidgetUsers(silent = false) {
    try {
        const res = await fetch(`${CHAT_API}/chat/usuarios?meuID=${chatWidgetUserID}`);
        const users = await res.json();
        
        // Badge
        const totalUnread = users.reduce((acc, u) => acc + (parseInt(u.NaoLidas)||0), 0);
        const badge = document.getElementById('chat-total-badge');
        if(badge) {
            badge.textContent = totalUnread;
            badge.style.display = totalUnread > 0 ? 'flex' : 'none';
        }

        if (silent) return; // Se for silent, para aqui (só atualiza badge)

        const list = document.getElementById('widget-user-list');
        if (!list) return;
        
        list.innerHTML = '';
        users.forEach(u => {
            const statusClass = u.Online ? 'status-online' : 'status-offline';
            const statusText = u.Online ? 'Online' : 'Offline';
            const initial = u.NomeCompleto.charAt(0).toUpperCase();
            
            const div = document.createElement('div');
            div.className = 'user-list-item';
            div.onclick = () => openWidgetChat(u);
            
            div.innerHTML = `
                <div class="user-avatar-mini" style="background:#bdc3c7;">
                    ${initial}
                    <div class="status-indicator ${statusClass}"></div>
                </div>
                <div class="user-details" style="flex:1;">
                    <h5>${u.NomeCompleto}</h5>
                    <small>${statusText}</small>
                </div>
                ${u.NaoLidas > 0 ? `<div class="unread-count">${u.NaoLidas}</div>` : ''}
            `;
            list.appendChild(div);
        });
    } catch(e) {}
}

window.openWidgetChat = function(user) {
    chatWidgetPartnerID = user.ID;
    document.getElementById('chat-partner-name').textContent = user.NomeCompleto.split(' ')[0];
    
    document.getElementById('view-contacts').style.display = 'none';
    document.getElementById('view-conversation').classList.add('active');
    
    loadWidgetMessages(true);
};

async function loadWidgetMessages(scroll = false) {
    if(!chatWidgetPartnerID) return;
    try {
        // Envia meuID e o ID do parceiro para o PHP filtrar
        const res = await fetch(`${CHAT_API}/chat/mensagens?meuID=${chatWidgetUserID}&usuarioID=${chatWidgetPartnerID}`);
        const msgs = await res.json();
        
        const container = document.getElementById('widget-messages-area');
        container.innerHTML = '';
        
        if (msgs.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#bdc3c7; font-size:12px;">Nenhuma mensagem. Inicie a conversa!</div>';
            return;
        }

        msgs.forEach(m => {
            const isMe = m.RemetenteID == chatWidgetUserID;
            const div = document.createElement('div');
            div.className = `chat-msg ${isMe ? 'sent' : 'received'}`;
            div.innerHTML = `
                ${m.Mensagem}
                <span class="msg-meta">${m.HoraFormatada || ''}</span>
            `;
            container.appendChild(div);
        });

        if(scroll) container.scrollTop = container.scrollHeight;
    } catch(e) {}
}

window.sendWidgetMessage = async function(e) {
    e.preventDefault();
    const input = document.getElementById('widget-input');
    const text = input.value.trim();
    if(!text || !chatWidgetPartnerID) return;
    
    input.value = ''; // Limpa input
    
    // Adiciona visualmente (Otimista)
    const container = document.getElementById('widget-messages-area');
    const div = document.createElement('div');
    div.className = 'chat-msg sent';
    div.innerHTML = `${text} <span class="msg-meta">...</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    try {
        await fetch(`${CHAT_API}/chat/enviar`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({
                RemetenteID: chatWidgetUserID,
                DestinatarioID: chatWidgetPartnerID,
                Mensagem: text
            })
        });
        loadWidgetMessages(true); // Confirma envio
    } catch(e) { 
        div.style.backgroundColor = '#e74c3c'; // Erro visual
        alert('Erro ao enviar'); 
    }
};