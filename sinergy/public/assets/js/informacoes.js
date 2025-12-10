document.addEventListener('DOMContentLoaded', () => {
    // Chama a função de cotação assim que a página carrega
    fetchCotacoes();
    
    // Chama a nova função de notícias
    loadMarketNews(); 
    
    // Atualiza a cotação a cada 5 minutos (300000 milissegundos)
    setInterval(fetchCotacoes, 300000);
});

/**
 * Busca as cotações de Dólar, Euro e Yuan de uma API pública
 * e atualiza os cards na tela.
 */
async function fetchCotacoes() {
    // API gratuita para múltiplas cotações
    const apiUrl = 'https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,CNY-BRL';

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error('Não foi possível buscar as cotações.');
        }
        
        const data = await response.json();
        
        // Atualiza o Card do Dólar (USD)
        if (data.USDBRL) {
            updateCotacaoCard(
                data.USDBRL, 
                'cotacao-valor-usd', 
                'cotacao-timestamp-usd'
            );
        }

        // Atualiza o Card do Euro (EUR)
        if (data.EURBRL) {
            updateCotacaoCard(
                data.EURBRL, 
                'cotacao-valor-eur', 
                'cotacao-timestamp-eur'
            );
        }

        // Atualiza o Card do Yuan (CNY)
        if (data.CNYBRL) {
            updateCotacaoCard(
                data.CNYBRL, 
                'cotacao-valor-cny', 
                'cotacao-timestamp-cny'
            );
        }
        
    } catch (error) {
        console.error('Erro ao buscar cotações:', error);
        // Notifica o usuário sobre o erro (se o manager estiver disponível)
        if (window.NotificationManager) {
            window.NotificationManager.show({
                title: 'Erro de Cotação',
                message: error.message,
                type: 'error'
            });
        }
        // Atualiza todos os cards para "Erro"
        document.getElementById('cotacao-valor-usd').textContent = 'Erro';
        document.getElementById('cotacao-timestamp-usd').textContent = 'Falha na atualização.';
        document.getElementById('cotacao-valor-eur').textContent = 'Erro';
        document.getElementById('cotacao-timestamp-eur').textContent = 'Falha na atualização.';
        document.getElementById('cotacao-valor-cny').textContent = 'Erro';
        document.getElementById('cotacao-timestamp-cny').textContent = 'Falha na atualização.';
    }
}

/**
 * Função auxiliar para atualizar um card de cotação específico.
 * @param {object} cotacaoData - O objeto de dados da API (ex: data.USDBRL)
 * @param {string} valorElementId - O ID do elemento que exibe o valor
 * @param {string} timestampElementId - O ID do elemento que exibe a data/hora
 */
function updateCotacaoCard(cotacaoData, valorElementId, timestampElementId) {
    const valorElement = document.getElementById(valorElementId);
    const timestampElement = document.getElementById(timestampElementId);

    if (!valorElement || !timestampElement) return;

    // Pegamos o valor de "venda" (ask)
    const valorVenda = parseFloat(cotacaoData.ask);
    
    // Formatamos para Moeda Brasileira (R$)
    const valorFormatado = valorVenda.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
    
    // Pegamos o timestamp (vem em segundos, convertemos para milissegundos)
    const dataAtualizacao = new Date(parseInt(cotacaoData.timestamp) * 1000);
    const dataFormatada = dataAtualizacao.toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    // Atualiza o HTML
    valorElement.textContent = valorFormatado;
    timestampElement.textContent = `Atualizado em: ${dataFormatada}`;
}

/**
 * Busca notícias de um feed RSS de commodities e filtra por
 * palavras-chave relevantes (aço, metal, minério).
 */
async function loadMarketNews() {
    const newsContainer = document.getElementById('market-news-container');

    // URL do feed RSS de Notícias Econômicas (mais abrangente)
    const RSS_FEED_URL = 'https://br.investing.com/rss/news_1.rss';
    
    // API gratuita que converte RSS para JSON
    const API_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_FEED_URL)}`;

    // Palavras-chave para filtrar (minúsculas)
    const KEYWORDS = [
        'aço', 
        'steel', 
        'minério', // minério de ferro
        'iron ore',
        'metal', 
        'siderurgia',
        'commodities',
        'china', // Importante para o mercado de aço
        'motor',
        'industrial',
        'eua',
        'brazil',
        'brasil',
        'tax',
        'fees',
        'motor',
        'industrial',
        'taxas',
        'taxa',
        'imposto'
    ];

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Falha ao buscar feed de notícias');
        
        const data = await response.json();
        
        if (data.status !== 'ok') throw new Error('API de notícias retornou um erro');

        // Filtra as notícias
        const filteredNews = data.items.filter(item => {
            const title = item.title.toLowerCase();
            const description = (item.description || '').toLowerCase();
            
            // Retorna 'true' se alguma palavra-chave for encontrada no título ou descrição
            return KEYWORDS.some(keyword => title.includes(keyword) || description.includes(keyword));
        });

        // Limita a 5 notícias
        const newsToShow = filteredNews.slice(0, 6);
        
        // Limpa o "loading"
        newsContainer.innerHTML = ''; 

        if (newsToShow.length === 0) {
            newsContainer.innerHTML = '<p style="color: #64748b;">Nenhuma notícia relevante encontrada no momento.</p>';
            return;
        }

        // Constrói o HTML das notícias
        newsToShow.forEach(item => {
            const pubDate = new Date(item.pubDate);
            const formattedDate = pubDate.toLocaleDateString('pt-BR', {
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric'
            });

            const newsItem = document.createElement('a');
            newsItem.className = 'news-item';
            newsItem.href = item.link;
            newsItem.target = '_blank'; // Abre em nova aba
            
            newsItem.innerHTML = `
                <h3 class="news-title">${item.title}</h3>
                <div class="news-details">
                    <span class="news-source">${item.author || data.feed.title}</span>
                    <span class="news-date">${formattedDate}</span>
                </div>
            `;
            newsContainer.appendChild(newsItem);
        });

    } catch (error) {
        console.error('Erro ao carregar notícias:', error);
        newsContainer.innerHTML = '<p style="color: #e74c3c;">Erro ao carregar o feed de notícias.</p>';
    }
}