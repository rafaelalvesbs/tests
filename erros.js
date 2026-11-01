window.Router.register('erros', async () => {
    const { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc } = window.fsMethods;
    const db = window.db;

    // Estado Local
    window.dadosErrosRecebidos = [];
    window.dadosErrosCorrigidos = [];
    window.paginaAtualErros = 1;
    window.abaAtualErros = 'recebidos';
    window.questaoEmEdicaoErro = null;

    setTimeout(async () => {
        await window.carregarReportesMaster();
    }, 100);

    window.switchTabErros = (tab) => {
        window.abaAtualErros = tab;
        window.paginaAtualErros = 1;
        document.querySelectorAll('.main-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`tab-btn-${tab}`).classList.add('active');
        window.renderizarListaErros();
    };

    window.carregarReportesMaster = async () => {
        const container = document.getElementById('lista-erros-master-dados');
        if (!container) return;
        
        container.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:30px; color:#0f172a;"></i></div>';
        
        try {
            const snapPendentes = await getDocs(collection(db, "reportes_questoes"));
            let pendentesRaw = [];
            snapPendentes.forEach(d => pendentesRaw.push({ id: d.id, ...d.data() }));

            // Agrupa os reportes por questaoId para responder a todos de uma vez com trava de segurança
            const agrupados = {};
            pendentesRaw.forEach(r => {
                const qId = r.questaoId;
                if (!qId || typeof qId !== 'string' || !qId.includes('_')) return; 

                if(!agrupados[qId]) {
                    agrupados[qId] = {
                        questaoId: qId,
                        atividadeId: qId.split('_')[0],
                        indexQuestao: parseInt(qId.split('_')[1]),
                        disciplina: r.disciplina || 'Desconhecida',
                        dataRecente: r.data || 0,
                        reportesIds: [r.id],
                        usuariosDescricoes: [{ id: r.usuarioId || 'N/A', desc: r.descricao || 'Sem descrição' }]
                    };
                } else {
                    agrupados[qId].reportesIds.push(r.id);
                    agrupados[qId].usuariosDescricoes.push({ id: r.usuarioId || 'N/A', desc: r.descricao || 'Sem descrição' });
                    if(r.data && r.data > agrupados[qId].dataRecente) agrupados[qId].dataRecente = r.data;
                }
            });

            window.dadosErrosRecebidos = Object.values(agrupados).sort((a,b) => (b.dataRecente || 0) - (a.dataRecente || 0));

            const snapCorrigidos = await getDocs(collection(db, "feedbacks_questoes"));
            window.dadosErrosCorrigidos = [];
            snapCorrigidos.forEach(d => window.dadosErrosCorrigidos.push({ id: d.id, ...d.data() }));
            window.dadosErrosCorrigidos.sort((a,b) => (b.data || 0) - (a.data || 0));

            window.renderizarListaErros();

        } catch (e) {
            console.error(e);
            container.innerHTML = `<p style="color:#ef4444; text-align:center; padding: 20px;">Erro ao carregar os dados. Verifique o console para mais detalhes.</p>`;
        }
    };

    window.abrirModalResponderErro = async (questaoId) => {
        const itemAgrupado = window.dadosErrosRecebidos.find(r => r.questaoId === questaoId);
        if (!itemAgrupado) return;

        const modal = document.getElementById('modal-resposta-erro');
        const containerInputs = document.getElementById('inputs-edicao-questao-erro');
        
        containerInputs.innerHTML = '<div style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Buscando Questão Original...</div>';
        modal.style.display = 'flex';
        
        document.getElementById('btn-confirmar-resp-erro').style.display = 'none';
        document.getElementById('modal-resposta-erro-texto').value = '';
        
        try {
            const docAtv = await getDoc(doc(db, "atividades_concursos", itemAgrupado.atividadeId));
            if (!docAtv.exists()) {
                containerInputs.innerHTML = '<p style="color:red;">Atividade não encontrada. Ela pode ter sido excluída.</p>';
                return;
            }
            
            const atividadeData = docAtv.data();
            const questaoOriginal = atividadeData.questoes[itemAgrupado.indexQuestao];
            
            if (!questaoOriginal) {
                containerInputs.innerHTML = '<p style="color:red;">Questão não encontrada dentro da atividade.</p>';
                return;
            }

            window.questaoEmEdicaoErro = {
                atividadeId: itemAgrupado.atividadeId,
                indexQuestao: itemAgrupado.indexQuestao,
                dadosAtividade: atividadeData,
                agrupamento: itemAgrupado
            };

            const htmlQuestoesReportadas = itemAgrupado.usuariosDescricoes.map((ud, i) => `
                <div style="background:#f1f5f9; padding:10px; border-radius:8px; margin-bottom:8px; font-size:12px; text-align:left;">
                    <strong style="color:#0f172a;">Aluno ${i+1}:</strong> ${ud.desc}
                </div>
            `).join('');

            containerInputs.innerHTML = `
                <div style="max-height: 80px; overflow-y: auto; margin-bottom: 10px; border: 1px dashed #cbd5e1; padding: 10px; border-radius: 8px;">
                    <div style="font-size: 11px; font-weight: 800; color: #ef4444; margin-bottom: 8px; text-align:left;">REPORTES RECEBIDOS PARA ESTA QUESTÃO:</div>
                    ${htmlQuestoesReportadas}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left; margin-bottom: 10px;">
                    <div>
                        <label style="font-size:11px; font-weight:700; color:#64748b; margin-bottom:5px; display:block;">Enunciado:</label>
                        <textarea id="ed-erro-enunc" class="input-premium" style="height:100px; resize:none; margin-bottom:10px;">${questaoOriginal.enunciado}</textarea>
                        
                        <label style="font-size:11px; font-weight:700; color:#64748b; margin-bottom:5px; display:block;">Explicação:</label>
                        <textarea id="ed-erro-exp" class="input-premium" style="height:80px; resize:none; margin-bottom:0;">${questaoOriginal.explicacao || ''}</textarea>
                    </div>
                    
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                            <label style="font-size:11px; font-weight:700; color:#64748b;">Gabarito:</label>
                            <select id="ed-erro-correta" class="input-premium" style="width: 60px; padding: 4px; margin:0; font-weight:900;">
                                ${['A','B','C','D','E'].map(l => `<option value="${l}" ${questaoOriginal.correta === l ? 'selected' : ''}>${l}</option>`).join('')}
                            </select>
                        </div>

                        <div style="display:grid; grid-template-columns: auto 1fr; gap: 6px; align-items:center; margin-bottom:4px;">
                            <span style="font-weight:800; color:#64748b; font-size: 11px;">A)</span>
                            <input type="text" id="ed-erro-opt-a" class="input-premium" style="margin:0; padding: 6px;" value="${questaoOriginal.opcoes.A}">
                        </div>
                        <div style="display:grid; grid-template-columns: auto 1fr; gap: 6px; align-items:center; margin-bottom:4px;">
                            <span style="font-weight:800; color:#64748b; font-size: 11px;">B)</span>
                            <input type="text" id="ed-erro-opt-b" class="input-premium" style="margin:0; padding: 6px;" value="${questaoOriginal.opcoes.B}">
                        </div>
                        <div style="display:grid; grid-template-columns: auto 1fr; gap: 6px; align-items:center; margin-bottom:4px;">
                            <span style="font-weight:800; color:#64748b; font-size: 11px;">C)</span>
                            <input type="text" id="ed-erro-opt-c" class="input-premium" style="margin:0; padding: 6px;" value="${questaoOriginal.opcoes.C}">
                        </div>
                        <div style="display:grid; grid-template-columns: auto 1fr; gap: 6px; align-items:center; margin-bottom:4px;">
                            <span style="font-weight:800; color:#64748b; font-size: 11px;">D)</span>
                            <input type="text" id="ed-erro-opt-d" class="input-premium" style="margin:0; padding: 6px;" value="${questaoOriginal.opcoes.D}">
                        </div>
                        <div style="display:grid; grid-template-columns: auto 1fr; gap: 6px; align-items:center; margin-bottom:4px;">
                            <span style="font-weight:800; color:#64748b; font-size: 11px;">E)</span>
                            <input type="text" id="ed-erro-opt-e" class="input-premium" style="margin:0; padding: 6px;" value="${questaoOriginal.opcoes.E}">
                        </div>
                    </div>
                </div>
            `;
            
            document.getElementById('btn-confirmar-resp-erro').style.display = 'block';

        } catch (e) {
            console.error(e);
            containerInputs.innerHTML = '<p style="color:red;">Erro na comunicação com o servidor.</p>';
        }
    };

    window.fecharModalResponderErro = () => {
        document.getElementById('modal-resposta-erro').style.display = 'none';
        window.questaoEmEdicaoErro = null;
    };

    window.confirmarResponderErro = async () => {
        if (!window.questaoEmEdicaoErro) return;

        const textAreaFeedback = document.getElementById('modal-resposta-erro-texto');
        const btn = document.getElementById('btn-confirmar-resp-erro');
        
        let resposta = textAreaFeedback.value;
        if (!resposta.trim()) resposta = "Seu reporte foi analisado, a questão foi corrigida. Bons estudos!";

        btn.innerText = "SALVANDO...";
        btn.disabled = true;

        const env = window.questaoEmEdicaoErro;
        
        const qAtualizada = {
            enunciado: document.getElementById('ed-erro-enunc').value,
            opcoes: {
                A: document.getElementById('ed-erro-opt-a').value,
                B: document.getElementById('ed-erro-opt-b').value,
                C: document.getElementById('ed-erro-opt-c').value,
                D: document.getElementById('ed-erro-opt-d').value,
                E: document.getElementById('ed-erro-opt-e').value
            },
            correta: document.getElementById('ed-erro-correta').value,
            explicacao: document.getElementById('ed-erro-exp').value
        };

        env.dadosAtividade.questoes[env.indexQuestao] = qAtualizada;

        try {
            await updateDoc(doc(db, "atividades_concursos", env.atividadeId), {
                questoes: env.dadosAtividade.questoes
            });

            const promessasFeed = env.agrupamento.usuariosDescricoes.map(async (u) => {
                const feedbackId = `${u.id}_${Date.now()}_${Math.floor(Math.random()*1000)}`;
                return setDoc(doc(collection(db, "feedbacks_questoes"), feedbackId), {
                    usuarioId: u.id,
                    questaoId: env.agrupamento.questaoId,
                    disciplina: env.agrupamento.disciplina,
                    descricaoOriginal: u.desc,
                    respostaEquipe: resposta,
                    lido: false,
                    data: Date.now()
                });
            });
            await Promise.all(promessasFeed);

            const promessasDelete = env.agrupamento.reportesIds.map(rId => deleteDoc(doc(db, "reportes_questoes", rId)));
            await Promise.all(promessasDelete);

            window.fecharModalResponderErro();
            await window.carregarReportesMaster();

        } catch (e) {
            console.error(e);
            alert("Erro ao salvar correção. Verifique sua conexão.");
            btn.innerText = "SALVAR E ENVIAR FEEDBACK";
            btn.disabled = false;
        }
    };

    window.visualizarErro = (id, tipo) => {
        let repObj = null;
        if (tipo === 'recebido') {
            repObj = window.dadosErrosRecebidos.find(r => r.questaoId === id); 
        } else {
            repObj = window.dadosErrosCorrigidos.find(r => r.id === id); 
        }
        
        if (!repObj) return;

        const discFormatada = repObj.disciplina || 'Geral';
        const idQuestaoVisual = repObj.questaoId ? repObj.questaoId.split('_')[1] : 'N/A';
        const modal = document.getElementById('modal-visualizar-erro');
        const content = document.getElementById('modal-visualizar-erro-content');

        if (tipo === 'recebido') {
            const htmlQuestoes = repObj.usuariosDescricoes.map((ud, i) => `
                <div style="background:#f1f5f9; padding:10px; border-radius:8px; margin-bottom:8px; font-size:13px; text-align:left;">
                    <strong style="color:#0f172a;">ID Aluno:</strong> ${ud.id.substring(0,5)}...<br>
                    <span style="color:#475569; display:block; margin-top:5px;">"${ud.desc}"</span>
                </div>
            `).join('');

            content.innerHTML = `
                <div style="text-align: left;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px;">
                        <span style="font-size:10px; font-weight:800; color:#b91c1c; text-transform:uppercase; background:#fef2f2; padding:4px 10px; border-radius:6px;">${discFormatada}</span>
                        <span style="font-size:11px; color:#94a3b8; font-weight:700;">Q #${idQuestaoVisual}</span>
                    </div>
                    <span style="font-size: 11px; font-weight: 800; color: #ef4444; display: block; margin-bottom: 8px; text-transform: uppercase;">${repObj.usuariosDescricoes.length} Aluno(s) reportou(aram):</span>
                    <div style="max-height: 200px; overflow-y:auto;">${htmlQuestoes}</div>
                </div>
            `;
        } else {
            content.innerHTML = `
                <div style="text-align: left;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px;">
                        <span style="font-size:10px; font-weight:800; color:#065f46; text-transform:uppercase; background:#ecfdf5; padding:4px 10px; border-radius:6px;">${discFormatada}</span>
                        <span style="font-size:11px; color:#94a3b8; font-weight:700;">Q #${idQuestaoVisual}</span>
                    </div>
                    <span style="font-size: 11px; font-weight: 800; color: #64748b; display: block; margin-bottom: 4px; text-transform: uppercase;">Dúvida Original do Aluno:</span>
                    <p style="color:#475569; font-size:13px; font-weight:500; line-height:1.4; margin-bottom:15px;">"${repObj.descricaoOriginal}"</p>
                    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px dashed #cbd5e1;">
                        <span style="font-size: 11px; font-weight: 800; color: #10b981; display: block; margin-bottom: 4px; text-transform: uppercase;">Resposta Enviada:</span>
                        <p style="color:#0f172a; font-size:14px; font-weight:600; line-height:1.4; margin:0;">"${repObj.respostaEquipe}"</p>
                    </div>
                </div>
            `;
        }
        modal.style.display = 'flex';
    };

    window.fecharModalVisualizarErro = () => {
        document.getElementById('modal-visualizar-erro').style.display = 'none';
    };


    window.renderizarListaErros = () => {
        const container = document.getElementById('lista-erros-master-dados');
        if (!container) return;

        const listaAtual = window.abaAtualErros === 'recebidos' ? window.dadosErrosRecebidos : window.dadosErrosCorrigidos;

        if (listaAtual.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:50px 20px; background:#fff; border-radius:16px; border:1px dashed #cbd5e1; margin-top: 20px;">
                    <i class="fa-solid ${window.abaAtualErros === 'recebidos' ? 'fa-face-smile' : 'fa-folder-open'}" style="font-size:40px; color:#10b981; margin-bottom:15px;"></i>
                    <h3 style="color:#0f172a; margin-bottom:5px;">${window.abaAtualErros === 'recebidos' ? 'Tudo tranquilo por aqui!' : 'Nenhum erro corrigido ainda.'}</h3>
                    <p style="color:#64748b; font-size:14px;">${window.abaAtualErros === 'recebidos' ? 'Os alunos não reportaram nenhum problema no momento.' : 'Os feedbacks enviados aparecerão nesta lista.'}</p>
                </div>
            `;
            return;
        }

        const itensPorPagina = 8;
        const totalPaginas = Math.ceil(listaAtual.length / itensPorPagina);
        const inicio = (window.paginaAtualErros - 1) * itensPorPagina;
        const itensPagina = listaAtual.slice(inicio, inicio + itensPorPagina);

        let htmlLista = itensPagina.map(item => {
            const idQuestaoVisual = item.questaoId ? item.questaoId.split('_')[1] : 'N/A';
            const discFormatada = item.disciplina || 'Geral';
            
            if (window.abaAtualErros === 'recebidos') {
                const multiReportes = item.usuariosDescricoes.length > 1;
                return `
                <div class="card-premium-list" style="margin-bottom:10.5px; padding:0 15px; border-left:4px solid #ef4444; background:#fff; border-radius:8px; display:grid; grid-template-columns: 1fr 1fr auto; align-items:center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); height: 45px; box-sizing: border-box; width: 100%; gap: 15px;">
                    <div style="display: flex; align-items: center; overflow: hidden; gap: 5px;">
                        <span style="font-size:9px; padding:2px 6px; background:#ef4444; color:white; border-radius:4px; font-weight:700; white-space:nowrap; flex-shrink: 0;"><i class="fa-solid fa-triangle-exclamation"></i> NOVO</span>
                        ${multiReportes ? `<span style="font-size:9px; padding:2px 6px; background:#fef2f2; color:#b91c1c; border-radius:4px; font-weight:800; white-space:nowrap; flex-shrink: 0;">${item.usuariosDescricoes.length} ALUNOS</span>` : `<span style="font-size:9px; padding:2px 6px; background:#f1f5f9; color:#0f172a; border-radius:4px; font-weight:700; white-space:nowrap;">ID: ${item.usuariosDescricoes[0].id.substring(0,5)}...</span>`}
                    </div>
                    <div style="display: flex; justify-content: center; flex-direction:column; overflow: hidden; line-height: 1.2; text-align: center;">
                        <h3 style="margin:0; color:#0f172a; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight: 800; text-transform: uppercase;" title="${discFormatada}">${discFormatada}</h3>
                        <span style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">QUESTÃO #${idQuestaoVisual}</span>
                    </div>
                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 12px; white-space: nowrap;">
                        <div style="display: flex; gap: 5px;">
                            <button onclick="window.visualizarErro('${item.questaoId}', 'recebido')" style="background:#e0f2fe; color:#0369a1; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; height:30px;" title="Ver Dúvidas"><i class="fa-solid fa-eye"></i></button>
                            <button onclick="window.abrirModalResponderErro('${item.questaoId}')" style="background:#0f172a; color:#fff; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; height:30px;" title="Corrigir e Responder"><i class="fa-solid fa-pen-to-square"></i></button>
                        </div>
                    </div>
                </div>`;
            } else {
                const idCurtoUser = item.usuarioId ? item.usuarioId.substring(0, 5) + '...' : 'N/A';
                return `
                <div class="card-premium-list" style="margin-bottom:10.5px; padding:0 15px; border-left:4px solid #10b981; background:#fff; border-radius:8px; display:grid; grid-template-columns: 1fr 1fr auto; align-items:center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); height: 45px; box-sizing: border-box; width: 100%; gap: 15px;">
                    <div style="display: flex; align-items: center; overflow: hidden; gap: 5px;">
                        <span style="font-size:9px; padding:2px 6px; background:#10b981; color:white; border-radius:4px; font-weight:700; white-space:nowrap; flex-shrink: 0;"><i class="fa-solid fa-check"></i> OK</span>
                        <span style="font-size:9px; padding:2px 6px; background:#f1f5f9; color:#0f172a; border-radius:4px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:inline-block; max-width: 100%;">ID: ${idCurtoUser}</span>
                    </div>
                    <div style="display: flex; justify-content: center; flex-direction:column; overflow: hidden; line-height: 1.2; text-align: center;">
                        <h3 style="margin:0; color:#0f172a; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight: 800; text-transform: uppercase;" title="${discFormatada}">${discFormatada}</h3>
                        <span style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">QUESTÃO #${idQuestaoVisual}</span>
                    </div>
                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 12px; white-space: nowrap;">
                        <div style="display: flex; gap: 5px;">
                            <button onclick="window.visualizarErro('${item.id}', 'corrigido')" style="background:#e0f2fe; color:#0369a1; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; height:30px;" title="Ver Resposta"><i class="fa-solid fa-eye"></i></button>
                        </div>
                    </div>
                </div>`;
            }
        }).join('');

        let htmlPaginacao = '';
        if (totalPaginas > 1) {
            htmlPaginacao = `<div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:20px; margin-bottom:20px;">
                <button onclick="if(window.paginaAtualErros > 1) { window.paginaAtualErros--; window.renderizarListaErros(); }" 
                    style="width:40px; height:40px; border-radius:10px; border:1px solid #e2e8f0; background:white; cursor:${window.paginaAtualErros === 1 ? 'not-allowed' : 'pointer'}; opacity:${window.paginaAtualErros === 1 ? '0.5' : '1'}; display:flex; align-items:center; justify-content:center;">
                    <i class="fa-solid fa-chevron-left" style="color:#64748b;"></i>
                </button>`;
            
            const maxVisible = 10;
            let startPage = Math.max(1, window.paginaAtualErros - Math.floor(maxVisible / 2));
            let endPage = startPage + maxVisible - 1;
            if (endPage > totalPaginas) { endPage = totalPaginas; startPage = Math.max(1, endPage - maxVisible + 1); }

            for (let i = startPage; i <= endPage; i++) {
                const ativa = i === window.paginaAtualErros;
                htmlPaginacao += `<button onclick="window.paginaAtualErros=${i}; window.renderizarListaErros();" style="width:40px; height:40px; border-radius:10px; border:1px solid ${ativa ? '#0f172a' : '#e2e8f0'}; background:${ativa ? '#0f172a' : 'white'}; color:${ativa ? 'white' : '#64748b'}; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .2s;">${i}</button>`;
            }

            htmlPaginacao += `<button onclick="if(window.paginaAtualErros < ${totalPaginas}) { window.paginaAtualErros++; window.renderizarListaErros(); }" 
                    style="width:40px; height:40px; border-radius:10px; border:1px solid #e2e8f0; background:white; cursor:${window.paginaAtualErros === totalPaginas ? 'not-allowed' : 'pointer'}; opacity:${window.paginaAtualErros === totalPaginas ? '0.5' : '1'}; display:flex; align-items:center; justify-content:center;">
                    <i class="fa-solid fa-chevron-right" style="color:#64748b;"></i>
                </button></div>`;
        }

        container.innerHTML = htmlLista + htmlPaginacao;
    };


    return `
        <style>
            .erros-container { width:100%; font-family:'Inter',sans-serif; padding:15px; box-sizing:border-box; }
            .input-premium { width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px; background:#f8fafc; margin-bottom:10px; outline:none; font-family:inherit; transition: 0.2s;}
            .input-premium:focus { border-color: #0f172a; background: #fff; box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.05);}
            .main-tab-btn { padding:10px 15px; border:none; background:none; cursor:pointer; font-weight:700; color:#64748b; font-size: 13px;}
            .main-tab-btn.active { color:#0f172a; border-bottom:3px solid #0f172a; }
            .spinner-q { width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top: 4px solid #0f172a; border-radius: 50%; animation: spinQ 0.8s linear infinite; }
            @keyframes spinQ { to { transform: rotate(360deg); } }
            .modal-admin { position:fixed; inset:0; background:rgba(15, 23, 42, 0.7); backdrop-filter:blur(4px); display:none; justify-content:center; align-items:center; z-index:9999; padding:20px; }
            .modal-admin-content { background:#fff; width:100%; max-width:800px; border-radius:24px; padding:30px; text-align:center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); position:relative; max-height: 90vh; overflow-y: auto;}
        </style>
        
        <div class="erros-container">
            <div style="margin-bottom: 20px;">
                <h1 style="color:#0f172a; font-weight:900; margin:0; font-size: 24px; text-transform: uppercase;">Erros Reportados</h1>
                <p style="color:#64748b; font-size:13px; margin-top: 5px;">Corrija questões e envie o feedback de resolução para os alunos.</p>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; margin-bottom:20px; flex-wrap: wrap; gap: 10px;">
                <div style="display:flex; gap:15px;">
                    <button id="tab-btn-recebidos" class="main-tab-btn active" onclick="window.switchTabErros('recebidos')">ERROS RECEBIDOS</button>
                    <button id="tab-btn-corrigidos" class="main-tab-btn" onclick="window.switchTabErros('corrigidos')">ERROS CORRIGIDOS</button>
                </div>
            </div>

            <div id="lista-erros-master-dados"></div>
            
            <!-- MODAL RESPONDER E CORRIGIR A QUESTÃO -->
            <div id="modal-resposta-erro" class="modal-admin">
                <div class="modal-admin-content">
                    <button onclick="window.fecharModalResponderErro()" style="position:absolute; top:20px; right:20px; border:none; background:none; cursor:pointer; font-size:18px; color:#64748b;"><i class="fa-solid fa-xmark"></i></button>
                    <div style="font-size: 30px; color: #0f172a; margin-bottom: 5px;"><i class="fa-solid fa-pen-to-square"></i></div>
                    <h3 style="color:#0f172a; margin-top:0; font-size: 18px; font-weight: 900;">Corrigir Questão e Enviar Feedback</h3>
                    
                    <div id="inputs-edicao-questao-erro" style="margin-top: 15px; margin-bottom: 15px;"></div>
                    
                    <input type="hidden" id="modal-resposta-erro-id">
                    <textarea id="modal-resposta-erro-texto" class="input-premium" rows="2" placeholder="Escreva a resposta aos alunos (ex: Gabarito alterado. Obrigado pelo aviso!)..." style="resize:none; height: 60px; font-size: 13px; margin-bottom: 15px; border-color:#3b82f6;"></textarea>
                    
                    <div style="display:flex; flex-direction: column; gap:10px;">
                        <button id="btn-confirmar-resp-erro" onclick="window.confirmarResponderErro()" style="background:#0f172a; color:#fff; border:none; padding:16px; border-radius:14px; font-weight:800; font-size: 14px; cursor:pointer; transition:0.2s; display:none;">SALVAR E ENVIAR FEEDBACK</button>
                    </div>
                </div>
            </div>

            <!-- MODAL VISUALIZAR -->
            <div id="modal-visualizar-erro" class="modal-admin">
                <div class="modal-admin-content" style="max-width:400px;">
                    <button onclick="window.fecharModalVisualizarErro()" style="position:absolute; top:20px; right:20px; border:none; background:none; cursor:pointer; font-size:18px; color:#64748b;"><i class="fa-solid fa-xmark"></i></button>
                    <div id="modal-visualizar-erro-content" style="margin-top: 15px;"></div>
                </div>
            </div>

        </div>
    `;
});
