/**
 * chat.js - Chat Interno com Polling
 */

const API_URL = 'https://virtualcriacoes.com/sinergy/api';
let currentUserID = null; // EU
let chatPartnerID = null; // Com quem falo
let pollInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    // Pega ID do usuário logado (função do seu app.js ou sidebar.js)
    // Se não tiver essa função global, tente pegar do localStorage
    currentUserID = window.getLoggedInUserID ? window.getLoggedInUserID() : localStorage.getItem('usuarioID');
    
    if(!currentUserID) {
        alert("Erro: Usuário não identificado.");
        return;
    }

    // Envia sinal de vida (online) imediatamente
    sendHeartbeat();
    
    // Inicia carregamento da lista
    loadUserList();
    
    // Atualiza lista e status a cada 5 segundos
    setInterval(() => {
        loadUserList();
        sendHeartbeat();
    }, 5000);

    // Loop de mensagens se tiver chat aberto (3s)
    setInterval(() => {
        if(chatPartnerID) loadMessages();
    }, 3000);

    // Envio de mensagem
    document.getElementById('form-chat').addEventListener('submit', sendMessage);
});

// Envia sinal de que estou online
async function sendHeartbeat() {
    try {
        await fetch(`${API_URL}/chat/heartbeat`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({usuarioID: currentUserID})
        });
    } catch(e) {}
}

async function loadUserList() {
    try {
        const res = await fetch(`${API_URL}/chat/usuarios?meuID=${currentUserID}`);
        const users = await res.json();
        renderUserList(users);
    } catch(e) { console.error("Erro lista usuarios", e); }
}

function renderUserList(users) {
    const list = document.getElementById('users-list');
    // Salva scroll atual para não pular
    const scrollPos = list.scrollTop;
    
    list.innerHTML = '';
    
    users.forEach(u => {
        const isOnline = u.Online; // Vem do PHP
        const unread = u.NaoLidas > 0 ? `<span class="badge-unread">${u.NaoLidas}</span>` : '';
        const activeClass = chatPartnerID == u.ID ? 'active' : '';
        
        const div = document.createElement('div');
        div.className = `user-item ${activeClass}`;
        div.onclick = () => openChat(u);
        
        div.innerHTML = `
            <div class="user-avatar">
                <img src="${u.FotoPerfilBase64 || 'https://i.pravatar.cc/150?u='+u.ID}" style="width:100%;height:100%;border-radius:50%;">
                <div class="status-dot ${isOnline ? 'online' : 'offline'}"></div>
            </div>
            <div class="user-info">
                <h4>${u.NomeCompleto}</h4>
                <p>${isOnline ? 'Online' : 'Offline'}</p>
            </div>
            ${unread}
        `;
        list.appendChild(div);
    });
    
    list.scrollTop = scrollPos;
}

function openChat(user) {
    chatPartnerID = user.ID;
    
    // UI Updates
    document.getElementById('chat-header').style.display = 'flex';
    document.getElementById('chat-input-area').style.display = 'flex';
    document.getElementById('chat-username').textContent = user.NomeCompleto;
    document.getElementById('chat-status').textContent = user.Online ? 'Online agora' : `Visto por último: ${new Date(user.UltimaAtividade).toLocaleTimeString()}`;
    
    loadMessages();
    // Força atualização da lista para remover badge de não lido
    loadUserList();
}

async function loadMessages() {
    if(!chatPartnerID) return;
    
    try {
        const res = await fetch(`${API_URL}/chat/mensagens?meuID=${currentUserID}&usuarioID=${chatPartnerID}`);
        const msgs = await res.json();
        renderMessages(msgs);
    } catch(e) { console.error(e); }
}

function renderMessages(msgs) {
    const container = document.getElementById('chat-messages');
    
    // Verifica se houve mudança para não renderizar tudo e perder scroll (otimização básica)
    // Para simplificar, renderizamos tudo, mas mantemos scroll embaixo se já estava
    const isAtBottom = container.scrollHeight - container.scrollTop === container.clientHeight;
    
    container.innerHTML = '';
    
    if(msgs.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#999;margin-top:20px;">Nenhuma mensagem ainda.</div>';
        return;
    }

    msgs.forEach(m => {
        const isMe = m.RemetenteID == currentUserID;
        const div = document.createElement('div');
        div.className = `msg ${isMe ? 'sent' : 'received'}`;
        
        const hora = new Date(m.DataEnvio).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
        
        div.innerHTML = `
            ${m.Mensagem}
            <div class="msg-time">${hora} ${isMe && m.Lida == 1 ? '<i class="fas fa-check-double" style="color:#34b7f1"></i>' : ''}</div>
        `;
        container.appendChild(div);
    });

    // Auto-scroll para baixo na primeira carga ou se usuário estava embaixo
    if(isAtBottom || container.children.length > 0) {
        container.scrollTop = container.scrollHeight;
    }
}

async function sendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('input-mensagem');
    const text = input.value.trim();
    if(!text) return;

    const payload = {
        RemetenteID: currentUserID,
        DestinatarioID: chatPartnerID,
        Mensagem: text
    };

    input.value = ''; // Limpa rápido para UX

    try {
        await fetch(`${API_URL}/chat/enviar`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(payload)
        });
        loadMessages(); // Recarrega para ver a mensagem
    } catch(e) { alert('Erro ao enviar'); }
}