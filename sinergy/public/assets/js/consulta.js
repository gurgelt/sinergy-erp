/**
 * js/consulta.js - VERSÃO COM CÁLCULO DE PESO CORRIGIDO E INTEGRADO AO BACKEND
 */

document.addEventListener('DOMContentLoaded', () => {
    const alturaInput = document.getElementById('altura-porta');
    const comprimentoInput = document.getElementById('comprimento-porta');
    const tipoLaminaSelect = document.getElementById('tipo-lamina');
    const calcularBtn = document.getElementById('btn-calcular');
    const resultadoCard = document.getElementById('resultado-card');
    const qtdLaminasResult = document.getElementById('resultado-qtd-laminas');
    const pesoTotalResult = document.getElementById('resultado-peso-total');
    const statusResult = document.getElementById('resultado-status');
    const estoqueAtualResult = document.getElementById('resultado-estoque-atual'); // NOVO ELEMENTO

    // Fatores de peso por metro linear (kg/mL) - Ajustado para o que está em Informações sobre fator e cálculos.docx
    // OBS: O documento DOCX também tem fatores por m2. Verificar qual é o correto para o cálculo.
    // Pelo `produtos.js`, FATORES_MATERIAL é kg por metro linear por lâmina.
    const FATORES_MATERIAL = window.FATORES_MATERIAL || {
        'Meia-Cana': 0.8,
        'Meia-Cana Transvision': 0.7,
        'Super-Cana': 1.48
    };

    // Altura de cada lâmina em CENTÍMETROS para o cálculo da quantidade
    // Baseado na descrição das bobinas em `Documentação do ERP.docx`
    const ALTURAS_LAMINAS_CM = {
        'Meia-Cana': 7.5, 
        'Meia-Cana Transvision': 7.5, 
        'Super-Cana': 10.0 
    };

    const FATORES_MATERIAL_M2 = window.FATORES_MATERIAL_M2 || {
        'Meia-Cana': 11.2,
        'Meia-Cana Transvision': 9.8,
        'Super-Cana': 14.8
    }

    // Evento de clique no botão calcular
    calcularBtn.addEventListener('click', async () => { // Adicionado `async`
        // 1. Obter e validar os dados de entrada
        const altura = parseFloat(alturaInput.value); // em metros
        const comprimento = parseFloat(comprimentoInput.value); // em metros
        const tipoLamina = tipoLaminaSelect.value;

        if (!altura || altura <= 0 || !comprimento || comprimento <= 0 || !tipoLamina) {
            NotificationManager.show({ title: 'Atenção', message: 'Por favor, preencha todos os campos corretamente.', type: 'warning' });
            return;
        }

        // 2. Buscar as constantes necessárias
        const alturaLaminaCm = ALTURAS_LAMINAS_CM[tipoLamina];
        const fatorPesoLinear = FATORES_MATERIAL[tipoLamina];
        const fatorPesoMetroQuadrado = FATORES_MATERIAL_M2[tipoLamina];

        if (!alturaLaminaCm || !fatorPesoLinear) {
            NotificationManager.show({ title: 'Erro', message: 'Fatores ou altura não encontrados para este tipo de lâmina.', type: 'error' });
            return;
        }

        // 3. CALCULAR A QUANTIDADE DE LÂMINAS
        const alturaPortaEmCm = altura * 100;
        const qtdLaminas = Math.ceil(alturaPortaEmCm / alturaLaminaCm);

        // 4. CALCULAR O PESO TOTAL USANDO O FATOR DE METRO QUADRADO (fórmula de peso corrigida)
        // Peso Total Estimado = Altura da Porta (m) x Comprimento da Porta (m) x Fator (kg/m de lâmina)
        const pesoTotalEstimado = qtdLaminas * (fatorPesoLinear * comprimento);

        // 5. Verificar o estoque (AGORA DO BACKEND)
        const pesoTotalDisponivel = await getEstoqueTotalPorTipo(tipoLamina); // Obtém o peso total disponível
        const producaoDisponivel = pesoTotalDisponivel >= pesoTotalEstimado; // Verifica a viabilidade

        // 6. Exibir os resultados
        exibirResultado(qtdLaminas, pesoTotalEstimado, producaoDisponivel, pesoTotalDisponivel); // Passa o estoque atual
    });

    /**
     * Retorna o peso total disponível no estoque para um tipo de material específico.
     * Agora, para "Meia-Cana", considera apenas a largura de 125mm.
     * Busca os dados do backend.
     */
    async function getEstoqueTotalPorTipo(tipoMaterial) {
        try {
            const response = await fetch('https://virtualcriacoes.com/sinergy/api/bobinas');
            if (!response.ok) throw new Error('Falha ao verificar estoque.');
            const bobinasEmEstoque = await response.json();
            
            let bobinasFiltradas;

            // LÓGICA CORRIGIDA PARA O ESTOQUE DA MEIA-CANA
            if (tipoMaterial === 'Meia-Cana') {
                console.log("Consulta: Somando estoque apenas de Meia-Cana 125mm");
                bobinasFiltradas = bobinasEmEstoque.filter(bobina => 
                    bobina.Tipo === 'Meia-Cana' && 
                    parseFloat(bobina.Largura) === 125 && 
                    parseFloat(bobina.Peso) > 0
                );
            } else {
                bobinasFiltradas = bobinasEmEstoque.filter(bobina => 
                    bobina.Tipo === tipoMaterial && 
                    parseFloat(bobina.Peso) > 0
                );
            }
            
            const pesoTotalDisponivel = bobinasFiltradas
                .reduce((total, bobina) => total + parseFloat(bobina.Peso), 0);
            
            return pesoTotalDisponivel;
        } catch (error) {
            console.error('Erro ao verificar estoque na consulta:', error);
            if(window.NotificationManager) NotificationManager.show({ title: 'Erro', message: `Não foi possível verificar o estoque: ${error.message}`, type: 'error' });
            return 0;
        }
    }

    /**
     * Exibe o resultado do cálculo na tela.
     */
    function exibirResultado(qtd, peso, disponivel, estoqueAtual) { // Novo parâmetro: estoqueAtual
        qtdLaminasResult.textContent = qtd;
        pesoTotalResult.textContent = `${peso.toFixed(2)} kg`;
        estoqueAtualResult.textContent = `${estoqueAtual.toFixed(2)} kg`; // Exibe o estoque atual

        if (disponivel) {
            statusResult.textContent = 'Produção Disponível';
            statusResult.className = 'status-message status-disponivel';
        } else {
            statusResult.textContent = 'Produção Indisponível';
            statusResult.className = 'status-message status-indisponivel';
        }

        resultadoCard.classList.remove('hidden');
    }
});