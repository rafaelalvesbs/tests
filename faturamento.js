window.Router.register('faturamento', async () => {
    const db = window.db;
    const auth = window.authMethods.getAuth();
    const { collection, getDocs, query, where, doc, updateDoc } = window.fsMethods;

    window.faturarMasterState = { 
        concurseiros: [],
        paginaAtual: 1,
        filtros: {
            status: '',
            dataInicio: '',
            dataFim: ''
        }
    };

    window.iniciarDashboardFaturamentoMaster = async () => {
        const container = document.getElementById('wrapper-dados-faturamento-master');
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#64748b;"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:2rem; color:#0f172a; margin-bottom:15px;"></i><br>Carregando painel financeiro master...</div>';
        
        try {
            const qUsuarios = query(collection(db, "usuarios"), where("perfil", "==", "Concurseiro"));
            const snapUsuarios = await getDocs(qUsuarios);
            
            let usuariosTemp = snapUsuarios.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));

            // Ordenação: Alunos sem valor primeiro, depois alfabético
            usuariosTemp.sort((a, b) => {
                const valA = parseFloat(a.valorAssinatura || a.valorMensalidade) || 0;
                const valB = parseFloat(b.valorAssinatura || b.valorMensalidade) || 0;
                const semValorA = valA === 0;
                const semValorB = valB === 0;

                if (semValorA && !semValorB) return -1;
                if (!semValorA && semValorB) return 1;
                return (a.nome || '').localeCompare(b.nome || '');
            });

            window.faturarMasterState.concurseiros = usuariosTemp;
            window.renderizarDashboardMasterCompleto();

        } catch (e) {
            console.error(e);
            container.innerHTML = '<p style="color:#ef4444; text-align:center; font-weight:700; padding:30px;">Erro de conexão. Não foi possível carregar os dados financeiros.</p>';
        }
    };

    window.renderizarDashboardMasterCompleto = () => {
        const container = document.getElementById('wrapper-dados-faturamento-master');
        if (!container) return;
        
        let filtrados = window.faturarMasterState.concurseiros;

        let concurseirosNoPeriodo = filtrados;
        const dtIni = window.faturarMasterState.filtros.dataInicio ? new Date(window.faturarMasterState.filtros.dataInicio + 'T00:00:00') : null;
        const dtFim = window.faturarMasterState.filtros.dataFim ? new Date(window.faturarMasterState.filtros.dataFim + 'T23:59:59') : null;

        if (dtIni || dtFim) {
            concurseirosNoPeriodo = filtrados.filter(a => {
                if (!a.dataCriacao) return false;
                const dtCad = typeof a.dataCriacao.toMillis === 'function' ? new Date(a.dataCriacao.toMillis()) : new Date(a.dataCriacao);
                if (dtIni && dtCad < dtIni) return false;
                if (dtFim && dtCad > dtFim) return false;
                return true;
            });
        }

        const formatarMoeda = (valor) => {
            return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        };

        const totalGlobal = window.faturarMasterState.concurseiros.reduce((acc, a) => acc + (parseFloat(a.valorAssinatura || a.valorMensalidade) || 0), 0);
        const totalPeriodo = concurseirosNoPeriodo.reduce((acc, a) => acc + (parseFloat(a.valorAssinatura || a.valorMensalidade) || 0), 0);

        const textoPlural = filtrados.length === 1 ? 'concurseiro' : 'concurseiros';

        let html = `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:25px;">
                <div style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding:20px; border-radius:16px; color:white; box-shadow:0 8px 20px rgba(15,23,42,0.15); position:relative; overflow:hidden; display:flex; flex-direction:column; justify-content:center;">
                    <i class="fa-solid fa-wallet" style="position:absolute; right:-10px; bottom:-10px; font-size:4rem; opacity:0.1;"></i>
                    <h3 style="font-size:0.75rem; font-weight:700; opacity:0.8; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Faturamento Total</h3>
                    <div style="font-size:1.8rem; font-weight:900;">${formatarMoeda(totalGlobal)}</div>
                    <div style="font-size:0.7rem; margin-top:4px; opacity:0.7;">Soma de todas as assinaturas</div>
                </div>

                <div style="background:linear-gradient(135deg, #059669 0%, #10b981 100%); padding:20px; border-radius:16px; color:white; box-shadow:0 8px 20px rgba(16,185,129,0.15); position:relative; overflow:hidden; display:flex; flex-direction:column; justify-content:center;">
                    <i class="fa-solid fa-chart-line" style="position:absolute; right:-10px; bottom:-10px; font-size:4rem; opacity:0.1;"></i>
                    <h3 style="font-size:0.75rem; font-weight:700; opacity:0.8; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Receita no Período</h3>
                    <div style="font-size:1.8rem; font-weight:900;">${formatarMoeda(totalPeriodo)}</div>
                    <div style="font-size:0.7rem; margin-top:4px; opacity:0.7;">Baseado nas datas filtradas</div>
                </div>

                <div style="background:#fff; padding:20px; border-radius:16px; border:1px solid #e2e8f0; color:#0f172a; box-shadow:0 4px 10px rgba(0,0,0,0.02); display:flex; flex-direction:column; justify-content:center;">
                    <h3 style="font-size:0.75rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Concurseiros Ativos</h3>
                    <div style="font-size:1.8rem; font-weight:900; color:#0f172a;">${filtrados.length} <span style="font-size:0.85rem; color:#94a3b8; font-weight:700;">${textoPlural}</span></div>
                </div>

                <div style="background:#fff; padding:15px; border-radius:16px; border:1px solid #e2e8f0; color:#0f172a; box-shadow:0 4px 10px rgba(0,0,0,0.02); display:flex; flex-direction:column; gap:10px; justify-content:center;">
                    <h3 style="font-size:0.75rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:1px; margin-bottom:0;">Filtros por Período</h3>
                    <div style="display:flex; gap:8px; width:100%; box-sizing:border-box;">
                        <div style="flex:1;">
                            <label style="font-size:0.65rem; font-weight:700; color:#475569; text-transform:uppercase; display:block; margin-bottom:2px;">Início</label>
                            <input type="date" value="${window.faturarMasterState.filtros.dataInicio}" onchange="window.faturarMasterState.filtros.dataInicio = this.value; window.faturarMasterState.paginaAtual = 1; window.renderizarDashboardMasterCompleto();" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.8rem; background:#f8fafc; outline:none;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.65rem; font-weight:700; color:#475569; text-transform:uppercase; display:block; margin-bottom:2px;">Fim</label>
                            <input type="date" value="${window.faturarMasterState.filtros.dataFim}" onchange="window.faturarMasterState.filtros.dataFim = this.value; window.faturarMasterState.paginaAtual = 1; window.renderizarDashboardMasterCompleto();" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.8rem; background:#f8fafc; outline:none;">
                        </div>
                    </div>
                </div>
            </div>

            <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px 20px; border-radius: 12px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 5px 0; color: #047857; font-size: 0.95rem; font-weight: 800;">Gestão de Assinaturas (Master):</h4>
                <p style="margin: 0; color: #065f46; font-size: 0.85rem; line-height: 1.5;">Acompanhe e configure os valores mensais de cada concurseiro cadastrado na plataforma.</p>
            </div>

            <div id="lista-concurseiros-financeiro">
                ${gerarListaMasterHtml(filtrados)}
            </div>
        `;

        container.innerHTML = html;
    };

    const gerarListaMasterHtml = (listaFiltada) => {
        if (listaFiltada.length === 0) {
            return '<div style="text-align:center; padding:40px; background:#fff; border-radius:16px; border:1px dashed #cbd5e1; color:#64748b; font-weight:600;">Nenhum concurseiro encontrado.</div>';
        }

        const itensPorPagina = 7;
        const totalPaginas = Math.ceil(listaFiltada.length / itensPorPagina);
        if (window.faturarMasterState.paginaAtual > totalPaginas) window.faturarMasterState.paginaAtual = totalPaginas || 1;

        const inicio = (window.faturarMasterState.paginaAtual - 1) * itensPorPagina;
        const paginados = listaFiltada.slice(inicio, inicio + itensPorPagina);

        let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
        
        paginados.forEach(a => {
            const valorAtual = a.valorAssinatura || a.valorMensalidade || '';
            const precisaValor = !valorAtual || parseFloat(valorAtual) === 0;
            const alertaHtml = precisaValor ? `<span style="color:#ef4444; font-size:10px; font-weight:800; text-transform:uppercase; margin-right:8px;"><i class="fa-solid fa-triangle-exclamation"></i> Definir Valor</span>` : '';

            html += `
            <div style="display:flex; align-items:center; justify-content:space-between; background:#fff; padding:12px 18px; border-radius:12px; border:1px solid #e2e8f0; gap:10px; box-shadow:0 2px 5px rgba(0,0,0,0.02);">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.9rem; flex-shrink: 0;">
                        ${(a.nome || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h4 style="margin:0; color:#0f172a; font-size:14px; font-weight:800;">${a.nome || 'Concurseiro'}</h4>
                        <span style="font-size:11px; color:#64748b;">${a.email || 'Sem e-mail'}</span>
                    </div>
                </div>
                <div style="display:flex; align-items:center;">
                    ${alertaHtml}
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:11px; color:#94a3b8; font-weight:800;">R$</span>
                        <input type="number" id="input-master-${a.id}" value="${valorAtual}" placeholder="0.00" style="width:90px; padding:8px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px; font-weight:800; color:#0f172a; text-align:center; background:#f8fafc; outline:none;">
                        <button onclick="window.atualizarAssinaturaMaster('${a.id}')" style="background:#0f172a; color:white; border:none; height:36px; padding:0 14px; border-radius:8px; font-weight:800; font-size:11px; cursor:pointer; text-transform:uppercase;">Salvar</button>
                    </div>
                </div>
            </div>`;
        });
        html += '</div>';

        if (totalPaginas > 1) {
            let botoes = '';
            for (let i = 1; i <= totalPaginas; i++) {
                const isActive = i === window.faturarMasterState.paginaAtual;
                botoes += `<button style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid ${isActive ? '#0f172a' : '#e2e8f0'}; background: ${isActive ? '#0f172a' : '#fff'}; color: ${isActive ? '#fff' : '#475569'}; font-weight: 700; cursor: pointer;" onclick="window.faturarMasterState.paginaAtual = ${i}; window.renderizarDashboardMasterCompleto();">${i}</button>`;
            }
            html += `<div style="display: flex; justify-content: center; gap: 6px; margin-top: 15px;">${botoes}</div>`;
        }

        return html;
    };

    window.atualizarAssinaturaMaster = async (usuarioId) => {
        const input = document.getElementById(`input-master-${usuarioId}`);
        const valor = input.value.trim();
        const btn = input.nextElementSibling;
        const textoOriginal = btn.innerText;

        btn.disabled = true;
        btn.innerText = "...";

        try {
            await updateDoc(doc(db, "usuarios", usuarioId), { valorAssinatura: valor });
            const idx = window.faturarMasterState.concurseiros.findIndex(u => u.id === usuarioId);
            if (idx !== -1) window.faturarMasterState.concurseiros[idx].valorAssinatura = valor;

            alert("Valor atualizado com sucesso!");
            window.renderizarDashboardMasterCompleto();
        } catch (e) {
            console.error(e);
            alert("Erro ao atualizar valor.");
        } finally {
            btn.disabled = false;
            btn.innerText = textoOriginal;
        }
    };

    setTimeout(window.iniciarDashboardFaturamentoMaster, 100);

    return `
        <div style="padding: 20px; font-family: 'Plus Jakarta Sans', sans-serif;">
            <div style="margin-bottom: 25px;">
                <h1 style="color: #0f172a; font-weight: 900; font-size: 1.8rem; margin: 0 0 5px 0; text-transform: uppercase;">Financeiro Master</h1>
                <p style="color: #64748b; font-size: 0.95rem; margin: 0;">Acompanhe o faturamento geral e gerencie as assinaturas dos concurseiros.</p>
            </div>
            <div id="wrapper-dados-faturamento-master"></div>
        </div>
    `;
});