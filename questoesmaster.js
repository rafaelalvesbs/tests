window.Router.register('questoesmaster', async () => {
    if (performance.navigation.type === performance.navigation.TYPE_RELOAD) {
        localStorage.removeItem('p4f_rascunho_questoes');
    }
    
    if (window.innerWidth < 1024) {
        return `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80vh; text-align: center; padding: 30px; font-family: 'Inter', sans-serif;">
                <div style="background: #fff1f2; width: 70px; height: 70px; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; border: 2px solid #e11d48;">
                    <i class="fa-solid fa-laptop" style="color:#e11d48; font-size: 1.8rem;"></i>
                </div>
                <h2 style="color: #0f172a; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.5px;">Painel Exclusivo para Desktop</h2>
                <p style="color: #64748b; max-width: 320px; line-height: 1.6; font-size: 0.95rem;">
                    A criação de questões requer uma tela maior para melhor organização dos campos e visualização.
                </p>
                <button onclick="window.location.hash = '#home'" style="margin-top: 30px; padding: 14px 30px; background: #0f172a; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: 0.2s;">
                    Voltar ao Início
                </button>
            </div>
        `;
    }

    const db = window.db;
    const { collection, getDocs, addDoc, serverTimestamp, query, where, doc, deleteDoc, updateDoc, orderBy } = window.fsMethods;

    let enviadasCache = [];
    let abasCarregadas = { enviadas: false };
    let idEditandoAtv = null; 
    let concursosCarregados = [];
    let cargosCarregados = [];
    let disciplinasCarregadas = [];
    window.paginaAtualEnviadasConc = 1;

    window.showAlertConcurso = (titulo, mensagem, tipo = 'info') => {
        const modal = document.getElementById('modal-alert-conc');
        document.getElementById('alert-title-conc').innerText = titulo;
        document.getElementById('alert-msg-conc').innerHTML = mensagem;
        document.getElementById('alert-icon-conc').innerHTML = tipo === 'error' ? '<i class="fa-solid fa-circle-xmark" style="color:#ef4444; font-size:40px;"></i>' : '<i class="fa-solid fa-circle-check" style="color:#0f172a; font-size:40px;"></i>';
        modal.style.display = 'flex';
    };
    window.closeAlertConcurso = () => { document.getElementById('modal-alert-conc').style.display = 'none'; };

    window.mostrarToastSucessoConc = (mensagem) => {
        const toast = document.createElement('div');
        toast.className = 'toast-sucesso-conc';
        toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${mensagem}`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.5s ease-in reverse';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    };

    window.showConfirmConc = (titulo, mensagem, onConfirm) => {
        const modal = document.getElementById('modal-confirm-conc');
        document.getElementById('confirm-title-conc').innerText = titulo;
        document.getElementById('confirm-msg-conc').innerText = mensagem;
        modal.style.display = 'flex';
        window.pendingConfirmActionConc = async () => { 
            await onConfirm(); 
            modal.style.display = 'none'; 
        };
    };

    window.cargosSelecionadosVal = [];

    window.carregarDropdownCargos = async () => {
        try {
            const q = query(collection(db, "cargos_concurso"), orderBy("nome", "asc"));
            const snap = await getDocs(q);
            cargosCarregados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            window.atualizarTextoBotaoCargos();
        } catch (e) {
            console.error("Erro ao carregar cargos", e);
        }
    };

    window.atualizarTextoBotaoCargos = () => {
        const btnText = document.getElementById('texto-btn-cargo');
        if (!btnText) return;
        if (window.cargosSelecionadosVal.length === 0) {
            btnText.innerText = "Selecionar Cargos...";
            btnText.style.color = "#64748b";
        } else if (window.cargosSelecionadosVal.length === 1) {
            const c = cargosCarregados.find(x => x.id === window.cargosSelecionadosVal[0]);
            btnText.innerText = c ? c.nome : "1 Cargo Selecionado";
            btnText.style.color = "#0f172a";
        } else {
            btnText.innerText = `${window.cargosSelecionadosVal.length} Cargos Selecionados`;
            btnText.style.color = "#0f172a";
        }
    };

    window.abrirModalSelecaoCargos = () => {
        const modal = document.getElementById('modal-selecionar-cargos');
        const lista = document.getElementById('lista-selecao-cargos');
        lista.innerHTML = '';

        if (cargosCarregados.length === 0) {
            lista.innerHTML = '<p style="color:#64748b; font-size:13px; text-align:center; padding:15px;">Nenhum cargo cadastrado.</p>';
        } else {
            cargosCarregados.forEach(c => {
                const isChecked = window.cargosSelecionadosVal.includes(c.id) ? 'checked' : '';
                const div = document.createElement('div');
                div.style.cssText = 'display:flex; align-items:center; gap:12px; padding:12px; border-bottom:1px solid #e2e8f0; cursor:pointer; transition:0.2s;';
                div.onmouseover = () => div.style.background = '#f8fafc';
                div.onmouseout = () => div.style.background = 'transparent';
                div.onclick = (e) => {
                    if (e.target.tagName !== 'INPUT') {
                        const cb = div.querySelector('input');
                        cb.checked = !cb.checked;
                        window.toggleCargoSelecao(c.id, cb.checked);
                    }
                };
                div.innerHTML = `
                    <input type="checkbox" value="${c.id}" ${isChecked} onchange="window.toggleCargoSelecao('${c.id}', this.checked)" style="width:18px; height:18px; cursor:pointer; margin:0; accent-color:#0f172a;">
                    <span style="font-weight:600; color:#1e293b; font-size:14px; user-select:none;">${c.nome}</span>
                `;
                lista.appendChild(div);
            });
        }
        modal.style.display = 'flex';
    };

    window.toggleCargoSelecao = (id, isChecked) => {
        if (isChecked) {
            if (!window.cargosSelecionadosVal.includes(id)) window.cargosSelecionadosVal.push(id);
        } else {
            window.cargosSelecionadosVal = window.cargosSelecionadosVal.filter(x => x !== id);
        }
        window.atualizarTextoBotaoCargos();
        window.triggerAutoSaveConc();
    };

    window.fecharModalSelecaoCargos = () => {
        document.getElementById('modal-selecionar-cargos').style.display = 'none';
    };

    window.adicionarNovoCargo = async () => {
        const novoNome = prompt("Digite o nome do novo cargo:");
        if (novoNome && novoNome.trim()) {
            try {
                const docRef = await addDoc(collection(db, "cargos_concurso"), {
                    nome: novoNome.trim().toUpperCase(),
                    criadoEm: serverTimestamp()
                });
                await window.carregarDropdownCargos();
                window.cargosSelecionadosVal.push(docRef.id);
                window.atualizarTextoBotaoCargos();
                window.abrirModalSelecaoCargos();
                window.triggerAutoSaveConc();
            } catch(e) {
                alert("Erro ao salvar o cargo");
            }
        }
    };

    window.abrirModalGerenciarCargos = () => {
        const modal = document.getElementById('modal-gerenciar-cargos');
        const lista = document.getElementById('lista-gerenciar-cargos');
        lista.innerHTML = '';
        
        if (cargosCarregados.length === 0) {
            lista.innerHTML = '<p style="color:#64748b; font-size:13px; text-align:center;">Nenhum cargo cadastrado.</p>';
        } else {
            cargosCarregados.forEach(c => {
                const div = document.createElement('div');
                div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #e2e8f0;';
                div.innerHTML = `
                    <span style="font-weight:600; color:#1e293b; font-size:14px;">${c.nome}</span>
                    <button onclick="window.excluirCargo('${c.id}')" style="background:#fee2e2; color:#ef4444; border:none; padding:5px 10px; border-radius:6px; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                `;
                lista.appendChild(div);
            });
        }
        modal.style.display = 'flex';
    };

    window.excluirCargo = async (id) => {
        if(confirm('Tem certeza que deseja excluir este cargo?')) {
            try {
                await deleteDoc(doc(db, "cargos_concurso", id));
                await window.carregarDropdownCargos();
                window.abrirModalGerenciarCargos();
            } catch(e) {
                alert('Erro ao excluir cargo.');
            }
        }
    };

    window.fecharModalGerenciarCargos = () => {
        document.getElementById('modal-gerenciar-cargos').style.display = 'none';
    };

    window.carregarDropdownConcursos = async () => {
        const select = document.getElementById('select-concurso-master');
        if (!select) return;

        try {
            const q = query(collection(db, "concursos"), orderBy("titulo", "asc"));
            const snap = await getDocs(q);
            
            concursosCarregados = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            if (concursosCarregados.length === 0) {
                select.innerHTML = '<option value="" disabled selected>Nenhum concurso cadastrado.</option>';
                return;
            }

            let optionsHtml = '<option value="" disabled selected>Concurso Alvo</option>';
            concursosCarregados.forEach(c => {
                optionsHtml += `<option value="${c.id}">${c.titulo} (${c.ano || '-'})</option>`;
            });
            select.innerHTML = optionsHtml;
        } catch (e) {
            console.error("Erro ao carregar concursos:", e);
        }
    };

    window.carregarDropdownDisciplinas = async () => {
        const selectDisc = document.getElementById('select-disciplina-master');
        if (!selectDisc) return;

        try {
            const q = query(collection(db, "disciplinas_concurso"), orderBy("nome", "asc"));
            const snap = await getDocs(q);
            disciplinasCarregadas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            let html = '<option value="" disabled selected>Disciplina Alvo</option>';
            disciplinasCarregadas.forEach(d => {
                html += `<option value="${d.nome}">${d.nome}</option>`;
            });
            html += '<option value="novo">+ Adicionar Nova Disciplina</option>';
            html += '<option value="gerenciar">⚙️ Gerenciar Disciplinas</option>';
            selectDisc.innerHTML = html;
        } catch (e) {
            console.error("Erro ao carregar disciplinas", e);
        }
    };

    window.handleDisciplinaChange = async (select) => {
        if (select.value === 'novo') {
            const novoNome = prompt("Digite o nome da nova disciplina:");
            if (novoNome && novoNome.trim()) {
                try {
                    const nomeFormatado = novoNome.trim().toUpperCase();
                    await addDoc(collection(db, "disciplinas_concurso"), {
                        nome: nomeFormatado,
                        criadoEm: serverTimestamp()
                    });
                    await window.carregarDropdownDisciplinas();
                    select.value = nomeFormatado;
                    window.triggerAutoSaveConc();
                } catch(e) {
                    alert("Erro ao salvar disciplina");
                }
            } else {
                select.value = "";
            }
        } else if (select.value === 'gerenciar') {
            window.abrirModalGerenciarDisciplinas();
            select.value = "";
        } else {
            window.triggerAutoSaveConc();
        }
    };

    window.abrirModalGerenciarDisciplinas = () => {
        const modal = document.getElementById('modal-gerenciar-disciplinas');
        const lista = document.getElementById('lista-gerenciar-disciplinas');
        lista.innerHTML = '';
        
        if (disciplinasCarregadas.length === 0) {
            lista.innerHTML = '<p style="color:#64748b; font-size:13px; text-align:center;">Nenhuma disciplina cadastrada.</p>';
        } else {
            disciplinasCarregadas.forEach(d => {
                const div = document.createElement('div');
                div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #e2e8f0;';
                div.innerHTML = `
                    <span style="font-weight:600; color:#1e293b; font-size:14px;">${d.nome}</span>
                    <button onclick="window.excluirDisciplina('${d.id}')" style="background:#fee2e2; color:#ef4444; border:none; padding:5px 10px; border-radius:6px; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                `;
                lista.appendChild(div);
            });
        }
        modal.style.display = 'flex';
    };

    window.excluirDisciplina = async (id) => {
        if(confirm('Tem certeza que deseja excluir esta disciplina?')) {
            try {
                await deleteDoc(doc(db, "disciplinas_concurso", id));
                await window.carregarDropdownDisciplinas();
                window.abrirModalGerenciarDisciplinas();
            } catch(e) {
                alert('Erro ao excluir disciplina.');
            }
        }
    };

    window.fecharModalGerenciarDisciplinas = () => {
        document.getElementById('modal-gerenciar-disciplinas').style.display = 'none';
    };

    window.triggerAutoSaveConc = () => {
        const rascunho = {
            concursoId: document.getElementById('select-concurso-master')?.value || "",
            disciplina: document.getElementById('select-disciplina-master')?.value || "",
            cargosIds: window.cargosSelecionadosVal || [],
            tituloPrompt: document.getElementById('titulo-prompt-conc')?.value || "",
            questoes: []
        };

        for (let i = 1; i <= 50; i++) {
            rascunho.questoes.push({
                enunciado: document.getElementById(`enunc-atv-${i}`)?.value || "",
                optA: document.getElementById(`opt-a-${i}`)?.value || "",
                optB: document.getElementById(`opt-b-${i}`)?.value || "",
                optC: document.getElementById(`opt-c-${i}`)?.value || "",
                optD: document.getElementById(`opt-d-${i}`)?.value || "",
                optE: document.getElementById(`opt-e-${i}`)?.value || "",
                correta: document.getElementById(`correct-${i}`)?.value || "A",
                explicacao: document.getElementById(`explicacao-atv-${i}`)?.value || ""
            });
        }
        localStorage.setItem('p4f_rascunho_questoes', JSON.stringify(rascunho));
    };

    const recuperarRascunho = () => {
        const salvo = localStorage.getItem('p4f_rascunho_questoes');
        if(!salvo || idEditandoAtv) return;
        try {
            const data = JSON.parse(salvo);
            if (data.concursoId) {
                const sel = document.getElementById('select-concurso-master');
                if(sel) sel.value = data.concursoId;
                
                setTimeout(() => {
                    if (data.disciplina) {
                        const selDisc = document.getElementById('select-disciplina-master');
                        if(selDisc) selDisc.value = data.disciplina;
                    }
                }, 100);
            }
            if (data.cargosIds && Array.isArray(data.cargosIds)) {
                window.cargosSelecionadosVal = data.cargosIds;
                window.atualizarTextoBotaoCargos();
            } else if (data.cargoId) {
                window.cargosSelecionadosVal = [data.cargoId];
                window.atualizarTextoBotaoCargos();
            }
            if (document.getElementById('titulo-prompt-conc')) document.getElementById('titulo-prompt-conc').value = data.tituloPrompt || "";
            
            data.questoes.forEach((q, idx) => {
                const i = idx + 1;
                if(document.getElementById(`enunc-atv-${i}`)) document.getElementById(`enunc-atv-${i}`).value = q.enunciado || "";
                if(document.getElementById(`opt-a-${i}`)) document.getElementById(`opt-a-${i}`).value = q.optA || "";
                if(document.getElementById(`opt-b-${i}`)) document.getElementById(`opt-b-${i}`).value = q.optB || "";
                if(document.getElementById(`opt-c-${i}`)) document.getElementById(`opt-c-${i}`).value = q.optC || "";
                if(document.getElementById(`opt-d-${i}`)) document.getElementById(`opt-d-${i}`).value = q.optD || "";
                if(document.getElementById(`opt-e-${i}`)) document.getElementById(`opt-e-${i}`).value = q.optE || "";
                if(document.getElementById(`correct-${i}`)) document.getElementById(`correct-${i}`).value = q.correta || "A";
                if(document.getElementById(`explicacao-atv-${i}`)) document.getElementById(`explicacao-atv-${i}`).value = q.explicacao || "";
            });
        } catch(e) {}
    };

    window.switchMainTabConc = (tab) => {
        document.querySelectorAll('.main-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane-conc').forEach(pane => pane.style.display = 'none');
        document.getElementById(`tab-btn-${tab}`).classList.add('active');
        document.getElementById(`pane-${tab}`).style.display = 'block';

        const containerFiltro = document.getElementById('container-filtro-conc');
        if(tab === 'enviadas') { 
            if(containerFiltro) containerFiltro.style.display = 'flex';
            window.paginaAtualEnviadasConc = 1;
            if(!abasCarregadas.enviadas) {
                window.carregarAtividadesEnviadasConc(true);
                abasCarregadas.enviadas = true;
            } else {
                window.carregarAtividadesEnviadasConc(false);
            }
        }
        if(tab === 'criar') {
            if(containerFiltro) containerFiltro.style.display = 'none';
            idEditandoAtv = null;
            document.querySelector('.btn-publish-conc').innerText = "PUBLICAR QUESTÕES AGORA";
        }
    };

    window.switchQuestaoConc = (target) => {
        document.querySelectorAll('.g-btn-pill').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.g-content-box').forEach(c => c.style.display = 'none');
        document.getElementById(`btn-atv-${target}`).classList.add('active');
        document.getElementById(`content-atv-${target}`).style.display = 'block';
    };

    window.copiarPromptConc = function(event) {
        const disciplina = document.getElementById('select-disciplina-master')?.value || 'Assuntos Gerais do Concurso';
        const tituloPrompt = document.getElementById('titulo-prompt-conc')?.value.trim();
        const assuntoFinal = tituloPrompt ? tituloPrompt : disciplina;
        const btn = event.currentTarget;
        
        const prompt = "Gere 50 questões para concurso sobre o tema: [" + assuntoFinal + "]\n\n" +
                       "MUITO IMPORTANTE: O resultado inteiro deve ser gerado dentro de UM ÚNICO BLOCO DE CÓDIGO COPIÁVEL (markdown code block) para que eu possa clicar em copiar e importar diretamente no meu sistema sem perder a formatação.\n\n" +
                       "Regras:\n" +
                       "1. Cada questão deve ter 5 alternativas (a, b, c, d, e).\n" +
                       "2. O gabarito precisa ser mesclado/aleatório (não deixe respostas corretas seguidas na mesma letra).\n" +
                       "3. Formate rigorosamente neste padrão exato para todas as 50 questões (sem negrito e sem pular linhas extras no meio da questão):\n\n" +
                       "1) Enunciado da questão aqui\n" +
                       "a) alternativa a\n" +
                       "b) alternativa b\n" +
                       "c) alternativa c\n" +
                       "d) alternativa d\n" +
                       "e) alternativa e\n" +
                       "correct answer: a\n" +
                       "explanation: explicação detalhada do gabarito aqui.\n\n" +
                       "Mantenha exatamente os termos 'correct answer:' e 'explanation:' minúsculos no final de cada questão para o meu importador funcionar.";

        navigator.clipboard.writeText(prompt).then(() => {
            btn.innerText = 'COPIADO!';
            btn.style.transform = 'scale(0.95)';
            btn.style.opacity = '0.8';
            setTimeout(() => {
                btn.style.transform = 'scale(1)';
                btn.style.opacity = '1';
                btn.innerText = 'PROMPT';
            }, 2000);
        });
    };

    window.abrirModalImportacaoConc = () => {
        let textoAcumulado = "";
        for (let i = 1; i <= 50; i++) {
            const enunc = document.getElementById(`enunc-atv-${i}`)?.value || "";
            const optA = document.getElementById(`opt-a-${i}`)?.value || "";
            const optB = document.getElementById(`opt-b-${i}`)?.value || "";
            const optC = document.getElementById(`opt-c-${i}`)?.value || "";
            const optD = document.getElementById(`opt-d-${i}`)?.value || "";
            const optE = document.getElementById(`opt-e-${i}`)?.value || "";
            const correct = document.getElementById(`correct-${i}`)?.value || "A";
            const exp = document.getElementById(`explicacao-atv-${i}`)?.value || "";

            if (enunc.trim() !== "") {
                textoAcumulado += `${i}) ${enunc}\na) ${optA}\nb) ${optB}\nc) ${optC}\nd) ${optD}\ne) ${optE}\ncorrect answer: ${correct.toLowerCase()}\nexplanation: ${exp}\n\n`;
            }
        }

        document.getElementById('texto-importar-conc').value = textoAcumulado.trim();
        document.getElementById('modal-import-conc').style.display = 'flex';
    };

    window.processarImportacaoConc = () => {
        const texto = document.getElementById('texto-importar-conc').value;
        if(!texto.trim()) return;

        const textoLimpo = texto.replace(/\*/g, '');
        const blocos = textoLimpo.split(/\n\s*(?=\d+[\)\.\-\s])|(?<=\n|^)\s*(?=\d+[\)\.\-\s])/).filter(b => b.trim().length > 5);
        
        for(let i=1; i<=50; i++) {
            if(document.getElementById(`enunc-atv-${i}`)) document.getElementById(`enunc-atv-${i}`).value = "";
            if(document.getElementById(`explicacao-atv-${i}`)) document.getElementById(`explicacao-atv-${i}`).value = "";
        }

        blocos.forEach((bloco, i) => {
            if(i >= 50) return;
            const num = i + 1;
            const linhas = bloco.split('\n').map(l => l.trim()).filter(l => l !== "");
            if (linhas.length < 2) return;

            let enunciado = linhas[0].replace(/^\d+[\)\.\-\s]+\s*/, '');
            const optA = linhas.find(l => l.toLowerCase().startsWith('a)'))?.replace(/^[a-zA-Z]\)\s*/, '') || "";
            const optB = linhas.find(l => l.toLowerCase().startsWith('b)'))?.replace(/^[a-zA-Z]\)\s*/, '') || "";
            const optC = linhas.find(l => l.toLowerCase().startsWith('c)'))?.replace(/^[a-zA-Z]\)\s*/, '') || "";
            const optD = linhas.find(l => l.toLowerCase().startsWith('d)'))?.replace(/^[a-zA-Z]\)\s*/, '') || "";
            const optE = linhas.find(l => l.toLowerCase().startsWith('e)'))?.replace(/^[a-zA-Z]\)\s*/, '') || "";
            
            let correta = "A";
            let explicacaoQuestao = "";
            
            const linhaGabaritoIndex = linhas.findIndex(l => l.toLowerCase().includes('correct answer') || l.toLowerCase().includes('respuesta correcta'));
            
            if (linhaGabaritoIndex !== -1) {
                const matchLetra = linhas[linhaGabaritoIndex].match(/[:\s]+([a-eA-E])\s*$/);
                if (matchLetra) {
                    correta = matchLetra[1].toUpperCase();
                }
                const linhasRestantes = linhas.slice(linhaGabaritoIndex + 1);
                explicacaoQuestao = linhasRestantes.join('\n').replace(/^explanation:\s*/i, '').trim();
            }

            if(document.getElementById(`enunc-atv-${num}`)) document.getElementById(`enunc-atv-${num}`).value = enunciado;
            if(document.getElementById(`opt-a-${num}`)) document.getElementById(`opt-a-${num}`).value = optA;
            if(document.getElementById(`opt-b-${num}`)) document.getElementById(`opt-b-${num}`).value = optB;
            if(document.getElementById(`opt-c-${num}`)) document.getElementById(`opt-c-${num}`).value = optC;
            if(document.getElementById(`opt-d-${num}`)) document.getElementById(`opt-d-${num}`).value = optD;
            if(document.getElementById(`opt-e-${num}`)) document.getElementById(`opt-e-${num}`).value = optE;
            if(document.getElementById(`correct-${num}`)) document.getElementById(`correct-${num}`).value = correta;
            if(document.getElementById(`explicacao-atv-${num}`)) document.getElementById(`explicacao-atv-${num}`).value = explicacaoQuestao;
        });

        document.getElementById('modal-import-conc').style.display = 'none';
        window.triggerAutoSaveConc();
        window.mostrarToastSucessoConc("Importação concluída!");
    };

    window.enviarAtividadeConcurso = async () => {
        const btnPublish = document.querySelector('.btn-publish-conc');
        if (btnPublish.disabled) return;

        const selectConcurso = document.getElementById('select-concurso-master');
        const disciplinaVal = document.getElementById('select-disciplina-master')?.value;
        const tituloPrompt = document.getElementById('titulo-prompt-conc')?.value.trim();
        const cargosSelecionadosParaEnvio = window.cargosSelecionadosVal || [];

        if (!selectConcurso.value || !disciplinaVal || cargosSelecionadosParaEnvio.length === 0) {
            return window.showAlertConcurso("Atenção", "Selecione o concurso, a disciplina e ao menos um cargo primeiro!", "error");
        }

        const assuntoFinal = tituloPrompt ? tituloPrompt : disciplinaVal;

        let temQuestaoValida = false;
        let questoes = [];
        for (let i = 1; i <= 50; i++) {
            const enunc = (document.getElementById(`enunc-atv-${i}`)?.value || "").trim();
            if (enunc) {
                temQuestaoValida = true;
                questoes.push({
                    enunciado: enunc,
                    opcoes: {
                        A: document.getElementById(`opt-a-${i}`).value,
                        B: document.getElementById(`opt-b-${i}`).value,
                        C: document.getElementById(`opt-c-${i}`).value,
                        D: document.getElementById(`opt-d-${i}`).value,
                        E: document.getElementById(`opt-e-${i}`).value
                    },
                    correta: document.getElementById(`correct-${i}`).value,
                    explicacao: document.getElementById(`explicacao-atv-${i}`).value
                });
            }
        }

        if (!temQuestaoValida) {
            return window.showAlertConcurso("Vazio", "Crie pelo menos uma questão completa com alternativas.", "error");
        }

        btnPublish.disabled = true;
        btnPublish.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> SALVANDO...';

        try {
            const auth = window.authMethods.getAuth();
            const profId = auth.currentUser.uid;
            const concursoInfo = concursosCarregados.find(c => c.id === selectConcurso.value);

            if (idEditandoAtv) {
                const cargoVal = cargosSelecionadosParaEnvio[0];
                const cargoInfo = cargosCarregados.find(c => c.id === cargoVal);
                const dados = {
                    tipo: 'questoes_concurso',
                    professorId: profId,
                    concursoId: selectConcurso.value,
                    concursoNome: concursoInfo.titulo,
                    cargoId: cargoVal,
                    cargoNome: cargoInfo ? cargoInfo.nome : '',
                    disciplina: disciplinaVal,
                    assunto: assuntoFinal,
                    questoes
                };
                await updateDoc(doc(db, "atividades_concursos", idEditandoAtv), dados);
                window.mostrarToastSucessoConc("Bateria de questões atualizada!");
            } else {
                for (let cId of cargosSelecionadosParaEnvio) {
                    const cargoInfo = cargosCarregados.find(c => c.id === cId);
                    const dados = {
                        tipo: 'questoes_concurso',
                        professorId: profId,
                        concursoId: selectConcurso.value,
                        concursoNome: concursoInfo.titulo,
                        cargoId: cId,
                        cargoNome: cargoInfo ? cargoInfo.nome : '',
                        disciplina: disciplinaVal,
                        assunto: assuntoFinal,
                        questoes,
                        dataEnvio: serverTimestamp()
                    };
                    await addDoc(collection(db, "atividades_concursos"), dados);
                }
                window.mostrarToastSucessoConc("Bateria de questões publicada!");
            }

            localStorage.removeItem('p4f_rascunho_questoes');
            abasCarregadas.enviadas = false;
            
            document.querySelectorAll('input[type="text"], textarea').forEach(el => el.value = '');
            document.querySelectorAll('select.input-premium').forEach(el => {
                if(el.id !== 'select-concurso-master' && el.tagName.toLowerCase() === 'select') el.value = 'A';
            });
            window.cargosSelecionadosVal = [];
            window.atualizarTextoBotaoCargos();
            
            window.switchMainTabConc('enviadas');

        } catch (e) {
            console.error(e);
            window.showAlertConcurso("Erro", "Falha ao salvar as questões.", "error");
        } finally {
            btnPublish.disabled = false;
            btnPublish.innerText = idEditandoAtv ? "ATUALIZAR QUESTÕES" : "PUBLICAR QUESTÕES AGORA";
        }
    };

    window.carregarAtividadesEnviadasConc = async (forcarBanco = false) => {
        const containerDados = document.getElementById('lista-enviadas-dados');

        try {
            if (forcarBanco || !window.memoriaAtividadesConc) {
                containerDados.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:30px; color:#0f172a;"></i></div>';
                const auth = window.authMethods.getAuth();
                const q = query(collection(db, "atividades_concursos"), where("professorId", "==", auth.currentUser.uid), where("tipo", "==", "questoes_concurso"));
                const snap = await getDocs(q);
                
                let obtidas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                obtidas.sort((a,b) => (b.dataEnvio?.seconds || 0) - (a.dataEnvio?.seconds || 0));
                window.memoriaAtividadesConc = obtidas;
            }

            let todasEnviadas = window.memoriaAtividadesConc;

            const filtroSelect = document.getElementById('filtro-disciplina-conc');
            const filtroCargo = document.getElementById('filtro-cargo-conc');

            if (filtroSelect) {
                const disciplinasUnicas = [...new Set(todasEnviadas.map(item => item.disciplina))].filter(Boolean).sort();
                const valorAtual = filtroSelect.value;
                filtroSelect.innerHTML = '<option value="todas">TODAS AS DISCIPLINAS</option>';
                disciplinasUnicas.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d;
                    opt.innerText = d.toUpperCase();
                    if (d === valorAtual) opt.selected = true;
                    filtroSelect.appendChild(opt);
                });
            }

            if (filtroCargo) {
                const cargosUnicos = [...new Set(todasEnviadas.map(item => item.cargoNome))].filter(Boolean).sort();
                const valorAtualCargo = filtroCargo.value;
                filtroCargo.innerHTML = '<option value="todos">TODOS OS CARGOS</option>';
                cargosUnicos.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.innerText = c.toUpperCase();
                    if (c === valorAtualCargo) opt.selected = true;
                    filtroCargo.appendChild(opt);
                });
            }

            const valorFiltroDisc = filtroSelect ? filtroSelect.value : 'todas';
            const valorFiltroCargo = filtroCargo ? filtroCargo.value : 'todos';

            enviadasCache = todasEnviadas.filter(item => {
                const passaDisc = valorFiltroDisc === 'todas' || item.disciplina === valorFiltroDisc;
                const passaCargo = valorFiltroCargo === 'todos' || item.cargoNome === valorFiltroCargo;
                return passaDisc && passaCargo;
            });

            if (enviadasCache.length === 0) {
                containerDados.innerHTML = '<p style="text-align:center; padding: 40px; font-weight: bold; color: #64748b;">Nenhuma bateria de questões encontrada.</p>';
                return;
            }

            const itensPorPagina = 8;
            const totalPaginas = Math.ceil(enviadasCache.length / itensPorPagina);
            const inicio = (window.paginaAtualEnviadasConc - 1) * itensPorPagina;
            const itensPagina = enviadasCache.slice(inicio, inicio + itensPorPagina);

            let htmlLista = itensPagina.map((data) => {
                const assunto = data.assunto || data.disciplina;
                const qtd = data.questoes ? data.questoes.length : 0;

                const nomeDoCargo = data.cargoNome ? data.cargoNome : 'CARGO NÃO INFORMADO';

                return `
                <div class="card-premium-list" style="margin-bottom:10.5px; padding:0 15px; border-left:4px solid #0f172a; background:#fff; border-radius:8px; display:flex; align-items:center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); height: 45px; box-sizing: border-box;">
                    <div style="flex: 1.1; display: flex; align-items: center; overflow: hidden; gap: 5px;">
                        <span style="font-size:9px; padding:2px 6px; background:#0f172a; color:white; border-radius:4px; font-weight:700; white-space:nowrap;">${data.concursoNome}</span>
                        <span style="font-size:9px; padding:2px 6px; background:#f1f5f9; color:#0f172a; border-radius:4px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${assunto}">${assunto}</span>
                    </div>
                    <div style="flex: 1.9; display: flex; justify-content: center; align-items: center; flex-direction:column; overflow: hidden; padding: 0 10px; line-height: 1.2;">
                        <h3 style="margin:0; color:#0f172a; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align: center; font-weight: 800; text-transform: uppercase;">${data.disciplina}</h3>
                        <span style="font-size:9px; color:#64748b; font-weight:700; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;" title="${nomeDoCargo}">${nomeDoCargo}</span>
                    </div>
                    <div style="flex: 1.5; display: flex; justify-content: flex-end; align-items: center; gap: 12px;">
                        <span style="font-size:10px; color:#94a3b8; white-space:nowrap; font-weight: 700;"><i class="fa-solid fa-list-check"></i> ${qtd} Q</span>
                        <div style="display: flex; gap: 5px;">
                            <button onclick="window.visualizarAtividadeConc('${data.id}')" style="background:#e0f2fe; color:#0369a1; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; height:30px;" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
                            <button onclick="window.prepararEdicaoConc('${data.id}')" style="background:#f1f5f9; color:#0f172a; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; height:30px;" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="window.excluirAtividadeConc('${data.id}')" style="background:#fee2e2; color:#ef4444; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; height:30px;" title="Excluir"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </div>
                </div>`;
            }).join('');

            let htmlPaginacao = '';
            if (totalPaginas > 1) {
                htmlPaginacao = `<div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:20px; margin-bottom:20px;">
                    <button onclick="if(window.paginaAtualEnviadasConc > 1) { window.paginaAtualEnviadasConc--; window.carregarAtividadesEnviadasConc(); }" 
                        style="width:40px; height:40px; border-radius:10px; border:1px solid #e2e8f0; background:white; cursor:${window.paginaAtualEnviadasConc === 1 ? 'not-allowed' : 'pointer'}; opacity:${window.paginaAtualEnviadasConc === 1 ? '0.5' : '1'}; display:flex; align-items:center; justify-content:center;">
                        <i class="fa-solid fa-chevron-left" style="color:#64748b;"></i>
                    </button>`;
                
                const maxVisible = 10;
                let startPage = Math.max(1, window.paginaAtualEnviadasConc - Math.floor(maxVisible / 2));
                let endPage = startPage + maxVisible - 1;
                if (endPage > totalPaginas) { endPage = totalPaginas; startPage = Math.max(1, endPage - maxVisible + 1); }

                for (let i = startPage; i <= endPage; i++) {
                    const ativa = i === window.paginaAtualEnviadasConc;
                    htmlPaginacao += `<button onclick="window.paginaAtualEnviadasConc=${i}; window.carregarAtividadesEnviadasConc();" style="width:40px; height:40px; border-radius:10px; border:1px solid ${ativa ? '#0f172a' : '#e2e8f0'}; background:${ativa ? '#0f172a' : 'white'}; color:${ativa ? 'white' : '#64748b'}; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .2s;">${i}</button>`;
                }

                htmlPaginacao += `<button onclick="if(window.paginaAtualEnviadasConc < ${totalPaginas}) { window.paginaAtualEnviadasConc++; window.carregarAtividadesEnviadasConc(); }" 
                        style="width:40px; height:40px; border-radius:10px; border:1px solid #e2e8f0; background:white; cursor:${window.paginaAtualEnviadasConc === totalPaginas ? 'not-allowed' : 'pointer'}; opacity:${window.paginaAtualEnviadasConc === totalPaginas ? '0.5' : '1'}; display:flex; align-items:center; justify-content:center;">
                        <i class="fa-solid fa-chevron-right" style="color:#64748b;"></i>
                    </button></div>`;
            }

            containerDados.innerHTML = htmlLista + htmlPaginacao;

        } catch (e) { 
            console.error(e);
            containerDados.innerHTML = '<p style="color:red; text-align:center;">Erro ao carregar os dados.</p>';
        }
    };

    window.prepararEdicaoConc = (id) => {
        const item = enviadasCache.find(atv => atv.id === id);
        if(!item) return;
        window.switchMainTabConc('criar');
        idEditandoAtv = id;
        
        const selConcurso = document.getElementById('select-concurso-master');
        if(selConcurso) selConcurso.value = item.concursoId;
        
        if (item.cargoId) {
            window.cargosSelecionadosVal = [item.cargoId];
        } else {
            window.cargosSelecionadosVal = [];
        }
        window.atualizarTextoBotaoCargos();

        setTimeout(() => {
            const selDisc = document.getElementById('select-disciplina-master');
            if(selDisc) selDisc.value = item.disciplina;
        }, 100);

        if(document.getElementById('titulo-prompt-conc')) document.getElementById('titulo-prompt-conc').value = item.assunto || item.disciplina || "";
        
        for(let i=1; i<=50; i++) {
            if(document.getElementById(`enunc-atv-${i}`)) document.getElementById(`enunc-atv-${i}`).value = "";
            if(document.getElementById(`opt-a-${i}`)) document.getElementById(`opt-a-${i}`).value = "";
            if(document.getElementById(`opt-b-${i}`)) document.getElementById(`opt-b-${i}`).value = "";
            if(document.getElementById(`opt-c-${i}`)) document.getElementById(`opt-c-${i}`).value = "";
            if(document.getElementById(`opt-d-${i}`)) document.getElementById(`opt-d-${i}`).value = "";
            if(document.getElementById(`opt-e-${i}`)) document.getElementById(`opt-e-${i}`).value = "";
            if(document.getElementById(`correct-${i}`)) document.getElementById(`correct-${i}`).value = "A";
            if(document.getElementById(`explicacao-atv-${i}`)) document.getElementById(`explicacao-atv-${i}`).value = "";
        }

        item.questoes.forEach((q, idx) => {
            const i = idx + 1;
            if(document.getElementById(`enunc-atv-${i}`)) document.getElementById(`enunc-atv-${i}`).value = q.enunciado || "";
            if(document.getElementById(`opt-a-${i}`)) document.getElementById(`opt-a-${i}`).value = q.opcoes.A || "";
            if(document.getElementById(`opt-b-${i}`)) document.getElementById(`opt-b-${i}`).value = q.opcoes.B || "";
            if(document.getElementById(`opt-c-${i}`)) document.getElementById(`opt-c-${i}`).value = q.opcoes.C || "";
            if(document.getElementById(`opt-d-${i}`)) document.getElementById(`opt-d-${i}`).value = q.opcoes.D || "";
            if(document.getElementById(`opt-e-${i}`)) document.getElementById(`opt-e-${i}`).value = q.opcoes.E || "";
            if(document.getElementById(`correct-${i}`)) document.getElementById(`correct-${i}`).value = q.correta || "A";
            if(document.getElementById(`explicacao-atv-${i}`)) document.getElementById(`explicacao-atv-${i}`).value = q.explicacao || "";
        });

        document.querySelector('.btn-publish-conc').innerText = "ATUALIZAR QUESTÕES";
    };

    window.visualizarAtividadeConc = (id) => {
        const item = enviadasCache.find(atv => atv.id === id);
        if (!item) return;

        const modal = document.getElementById('modal-preview-conc');
        const content = document.getElementById('modal-preview-content-conc');

        let htmlQuestoes = item.questoes.map((q, i) => {
            return `
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="margin-bottom: 10px;">
                        <span style="display: inline-block; padding: 2px 10px; background: #0f172a; color: #fff; border-radius: 6px; font-size: 11px; font-weight: 800;">QUESTÃO ${i + 1}</span>
                    </div>
                    <p style="font-weight: 600; color: #1e293b; font-size: 14px; line-height: 1.6; margin-bottom: 15px;">${q.enunciado}</p>
                    <div style="display: grid; gap: 8px;">
                        ${['A', 'B', 'C', 'D', 'E'].map(opt => {
                            const isCorrect = q.correta === opt;
                            return `
                                <div style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; font-size: 13px; border: 1px solid ${isCorrect ? '#0f172a' : '#f1f5f9'}; background: ${isCorrect ? '#f1f5f9' : '#fff'};">
                                    <span style="font-weight: 800; color: ${isCorrect ? '#0f172a' : '#94a3b8'}; width: 20px;">${opt})</span>
                                    <span style="color: ${isCorrect ? '#0f172a' : '#475569'}; font-weight: ${isCorrect ? '700' : '400'};">${q.opcoes[opt]}</span>
                                    ${isCorrect ? '<i class="fa-solid fa-circle-check" style="margin-left: auto; color: #0f172a;"></i>' : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                    ${q.explicacao ? `
                        <div style="margin-top: 15px; padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                            <span style="font-size: 11px; font-weight: 800; color: #64748b; display: block; margin-bottom: 5px;">EXPLICAÇÃO:</span>
                            <span style="font-size: 13px; color: #475569;">${q.explicacao}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px;">
                <div>
                    <h2 style="font-size: 20px; color: #0f172a; font-weight: 800; margin: 0; text-transform: uppercase;">${item.assunto || item.disciplina}</h2>
                    <span style="font-size: 12px; color: #64748b; font-weight: 600;">${item.concursoNome} | ${item.cargoNome || ''} | ${item.questoes.length} Questões</span>
                </div>
            </div>
            <div style="max-height: 70vh; overflow-y: auto; padding-right: 8px;">
                ${htmlQuestoes}
            </div>
        `;

        modal.style.display = 'flex';
    };
    window.closePreviewConc = () => { document.getElementById('modal-preview-conc').style.display = 'none'; };

    window.excluirAtividadeConc = (id) => {
        window.showConfirmConc("Excluir?", "Apagar este caderno de questões permanentemente?", async () => {
            await deleteDoc(doc(db, "atividades_concursos", id));
            window.mostrarToastSucessoConc("Caderno de questões excluído!");
            window.carregarAtividadesEnviadasConc(true);
        });
    };

setTimeout(() => { 
        Promise.all([window.carregarDropdownConcursos(), window.carregarDropdownCargos(), window.carregarDropdownDisciplinas()]).then(recuperarRascunho);
    }, 500);

    return `
    <style>
        .conc-container { width:100%; font-family:'Inter',sans-serif; padding:15px; box-sizing:border-box; }
        .card-conc { background:#fff; border-radius:12px; padding:20px; box-shadow:0 4px 12px rgba(0,0,0,0.05); border:1px solid #eef2f6; }
        .input-premium { width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px; background:#f8fafc; margin-bottom:10px; outline:none; font-family:inherit; transition: 0.2s;}
        .input-premium:focus { border-color: #0f172a; background: #fff; box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.05);}
        .label-sutil { font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; display:block; margin-bottom:6px; }
        .main-tab-btn { padding:10px 15px; border:none; background:none; cursor:pointer; font-weight:700; color:#64748b; font-size: 13px;}
        .main-tab-btn.active { color:#0f172a; border-bottom:3px solid #0f172a; }
        .btn-disciplina-pill { padding:8px 14px; border:1px solid #cbd5e1; background:#fff; border-radius:8px; cursor:pointer; font-size:11px; font-weight:800; margin-right:8px; margin-bottom:8px; transition: 0.2s;}
        .btn-disciplina-pill.active { background:#0f172a; color:#fff; border-color:#0f172a;}
        .g-btn-pill { min-width:36px; height:36px; border-radius:8px; border:1px solid #cbd5e1; background:#fff; cursor:pointer; font-weight:800; font-size:12px; color:#475569; }
        .g-btn-pill.active { background:#0f172a; color:#fff; border-color:#0f172a; }
        .btn-publish-conc { background:#0f172a; color:#fff; border:none; padding:14px; width:100%; border-radius:10px; font-weight:800; font-size: 14px; cursor:pointer; margin-top:20px; transition: 0.2s;}
        .btn-tool { padding: 0 15px; height: 38px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 11px; transition: all 0.2s ease; border: none; display: flex; align-items: center; justify-content: center; text-transform: uppercase;}
        
        .toast-sucesso-conc { position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 16px 24px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 12px; z-index: 10000; animation: slideIn 0.5s ease-out; font-weight: 700; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .modal-conc { position:fixed; inset:0; background:rgba(15, 23, 42, 0.6); backdrop-filter:blur(4px); display:none; justify-content:center; align-items:center; z-index:9999; padding:20px; }
        .modal-conc-content { background:#fff; width:100%; max-width:400px; border-radius:20px; padding:25px; text-align:center; }
    </style>

    <div class="conc-container">
        <div id="modal-alert-conc" class="modal-conc"><div class="modal-conc-content"><div id="alert-icon-conc" style="margin-bottom:10px;"></div><h3 id="alert-title-conc" style="color:#0f172a; margin-top:0;"></h3><div id="alert-msg-conc" style="color:#64748b; margin-bottom:20px;"></div><button class="btn-publish-conc" onclick="window.closeAlertConcurso()" style="margin-top:0;">OK</button></div></div>
        <div id="modal-confirm-conc" class="modal-conc"><div class="modal-conc-content"><h3 id="confirm-title-conc" style="color:#ef4444; margin-top:0;"></h3><p id="confirm-msg-conc" style="color:#64748b; margin-bottom:20px;"></p><div style="display:flex; gap:10px;"><button class="btn-publish-conc" style="background:#ef4444; margin-top:0;" onclick="window.pendingConfirmActionConc()">SIM</button><button class="btn-publish-conc" style="background:#f1f5f9; color:#64748b; margin-top:0;" onclick="this.closest('.modal-conc').style.display='none'">NÃO</button></div></div></div>

        <!-- Preview Modal -->
        <div id="modal-preview-conc" class="modal-conc" onclick="if(event.target===this)window.closePreviewConc()">
            <div class="modal-conc-content" style="max-width:800px; width:90%; text-align:left; position:relative; padding:25px;">
                <button onclick="window.closePreviewConc()" style="position:absolute; top:20px; right:20px; border:none; background:none; cursor:pointer; font-size:18px; color:#64748b;"><i class="fa-solid fa-xmark"></i></button>
                <div id="modal-preview-content-conc"></div>
            </div>
        </div>

        <div id="modal-import-conc" class="modal-conc" style="display:none; position:fixed; inset:0; background:rgba(15, 23, 42, 0.8); z-index:10000; align-items:center; justify-content:center;">
            <div class="modal-conc-content" style="max-width:600px; width:90%; background:white; padding:25px; border-radius:15px; text-align:center;">
                <h3 style="color:#0f172a; margin-top:0;">Importar Questões</h3>
                <p style="font-size:12px; color:#64748b;">Cole o texto gerado (questões, alternativas, gabarito e explicação).</p>
                <textarea id="texto-importar-conc" class="input-premium" style="height:250px; resize:none; margin-top:10px;" placeholder="Cole o texto aqui..."></textarea>
                <div style="display:flex; gap:10px; margin-top:15px;">
                    <button class="btn-publish-conc" onclick="window.processarImportacaoConc()" style="margin:0; flex:1;">PROCESSAR</button>
                    <button class="btn-publish-conc" onclick="document.getElementById('modal-import-conc').style.display='none'" style="margin:0; flex:1; background:#f1f5f9; color:#64748b; border: 1px solid #e2e8f0;">CANCELAR</button>
                </div>
            </div>
        </div>

        <div id="modal-selecionar-cargos" class="modal-conc" style="display:none; position:fixed; inset:0; background:rgba(15, 23, 42, 0.8); z-index:10001; align-items:center; justify-content:center;">
            <div class="modal-conc-content" style="max-width:400px; width:90%; background:white; padding:25px; border-radius:15px; text-align:center;">
                <h3 style="color:#0f172a; margin-top:0; font-size: 18px;">Selecione os Cargos</h3>
                <div id="lista-selecao-cargos" style="max-height:250px; overflow-y:auto; margin:15px 0; border:1px solid #e2e8f0; border-radius:8px; text-align:left;"></div>
                <div style="display:flex; gap:10px; margin-bottom: 15px;">
                    <button class="btn-publish-conc" onclick="window.adicionarNovoCargo()" style="margin:0; flex:1; font-size:12px; background:#10b981;">+ NOVO</button>
                    <button class="btn-publish-conc" onclick="window.fecharModalSelecaoCargos(); window.abrirModalGerenciarCargos();" style="margin:0; flex:1; font-size:12px; background:#f1f5f9; color:#0f172a; border:1px solid #e2e8f0;">⚙️ GERENCIAR</button>
                </div>
                <button class="btn-publish-conc" onclick="window.fecharModalSelecaoCargos()" style="margin:0; width:100%;">CONCLUIR SELEÇÃO</button>
            </div>
        </div>

        <div id="modal-gerenciar-cargos" class="modal-conc" style="display:none; position:fixed; inset:0; background:rgba(15, 23, 42, 0.8); z-index:10001; align-items:center; justify-content:center;">
            <div class="modal-conc-content" style="max-width:400px; width:90%; background:white; padding:25px; border-radius:15px; text-align:center;">
                <h3 style="color:#0f172a; margin-top:0;">Gerenciar Cargos</h3>
                <div id="lista-gerenciar-cargos" style="max-height:250px; overflow-y:auto; margin:15px 0; border:1px solid #e2e8f0; border-radius:8px;"></div>
                <button class="btn-publish-conc" onclick="window.fecharModalGerenciarCargos()" style="margin:0; width:100%;">FECHAR</button>
                <p style="font-size: 10px; color: #ef4444; margin-top: 10px; line-height: 1.3;">ATENÇÃO: Ao excluir um cargo aqui, ele não aparecerá mais na lista, mas as questões já criadas para ele continuarão funcionando normalmente para os alunos.</p>
            </div>
        </div>

        <div id="modal-gerenciar-disciplinas" class="modal-conc" style="display:none; position:fixed; inset:0; background:rgba(15, 23, 42, 0.8); z-index:10001; align-items:center; justify-content:center;">
            <div class="modal-conc-content" style="max-width:400px; width:90%; background:white; padding:25px; border-radius:15px; text-align:center;">
                <h3 style="color:#0f172a; margin-top:0;">Gerenciar Disciplinas</h3>
                <div id="lista-gerenciar-disciplinas" style="max-height:250px; overflow-y:auto; margin:15px 0; border:1px solid #e2e8f0; border-radius:8px;"></div>
                <button class="btn-publish-conc" onclick="window.fecharModalGerenciarDisciplinas()" style="margin:0; width:100%;">FECHAR</button>
                <p style="font-size: 10px; color: #ef4444; margin-top: 10px; line-height: 1.3;">ATENÇÃO: Ao excluir uma disciplina aqui, ela não aparecerá mais na lista, mas as questões já criadas para ela continuarão funcionando normalmente para os alunos.</p>
            </div>
        </div>

        <div style="margin-bottom: 20px;">
            <h1 style="color:#0f172a; font-weight:900; margin:0; font-size: 24px; text-transform: uppercase;">Questões</h1>
            <p style="color:#64748b; font-size:13px; margin-top: 5px;">Crie cadernos com 50 questões para as disciplinas dos concursos.</p>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; margin-bottom:20px; flex-wrap: wrap; gap: 10px;">
            <div style="display:flex; gap:15px;">
                <button id="tab-btn-criar" class="main-tab-btn active" onclick="window.switchMainTabConc('criar')">CRIAR QUESTÕES</button>
                <button id="tab-btn-enviadas" class="main-tab-btn" onclick="window.switchMainTabConc('enviadas')">QUESTÕES CRIADAS</button>
            </div>
            <div id="container-filtro-conc" style="display:none; align-items:center; gap:10px; margin-bottom: 5px;">
                <span style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">FILTRAR:</span>
                <select id="filtro-disciplina-conc" class="input-premium" style="margin:0; width:180px; padding:6px; font-size:11px; font-weight:bold; color:#0f172a;" onchange="window.paginaAtualEnviadasConc = 1; window.carregarAtividadesEnviadasConc()">
                    <option value="todas">TODAS AS DISCIPLINAS</option>
                </select>
                <select id="filtro-cargo-conc" class="input-premium" style="margin:0; width:180px; padding:6px; font-size:11px; font-weight:bold; color:#0f172a;" onchange="window.paginaAtualEnviadasConc = 1; window.carregarAtividadesEnviadasConc()">
                    <option value="todos">TODOS OS CARGOS</option>
                </select>
            </div>
        </div>

        <div id="pane-criar" class="tab-pane-conc" style="display:block;">
            <div class="card-conc">
                
                <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 15px; border-radius: 12px; margin-bottom: 25px;">
                    <div style="display:flex; gap: 8px; align-items: center; flex-wrap: nowrap; overflow-x: auto;">
                        <input type="text" id="titulo-prompt-conc" class="input-premium" style="width: 250px; min-width: 250px; margin-bottom: 0;" placeholder="Título/Assunto para o prompt" autocomplete="off" oninput="window.triggerAutoSaveConc()">
                        <button id="btn-prompt-conc" onclick="window.copiarPromptConc(event)" class="btn-tool" style="background:#0f172a; color:#fff; min-width: 100px;">PROMPT</button>
                        <button onclick="window.abrirModalImportacaoConc()" class="btn-tool" style="background:#10b981; color:#fff; min-width: 100px;">IMPORTAR</button>
                        
                        <select id="select-concurso-master" class="input-premium" onchange="window.triggerAutoSaveConc();" style="font-weight: bold; color: #0f172a; margin-bottom: 0; min-width: 200px;">
                            <option value="" disabled selected>Carregando concursos...</option>
                        </select>
                        
                        <select id="select-disciplina-master" class="input-premium" onchange="window.handleDisciplinaChange(this);" style="font-weight: bold; color: #0f172a; margin-bottom: 0; min-width: 200px;">
                            <option value="" disabled selected>Carregando disciplinas...</option>
                        </select>
                        
                        <button id="btn-select-cargo" onclick="window.abrirModalSelecaoCargos()" class="input-premium" style="font-weight: bold; color: #0f172a; margin-bottom: 0; min-width: 200px; text-align: left; display: flex; justify-content: space-between; align-items: center; background: #fff; cursor: pointer;">
                            <span id="texto-btn-cargo">Selecionar Cargos...</span>
                            <i class="fa-solid fa-chevron-down"></i>
                        </button>
                    </div>
                </div>

                <div style="margin:20px 0 10px 0; display:flex; flex-direction:column; gap:8px; overflow-x:auto; padding-bottom:10px;">
                    <div style="display:flex; gap:8px; width:max-content;">
                        ${Array.from({length: 25}, (_, i) => i + 1).map(n=>`<button id="btn-atv-${n}" class="g-btn-pill ${n===1 ? 'active' : ''}" onclick="window.switchQuestaoConc(${n})">${n}</button>`).join('')}
                    </div>
                    <div style="display:flex; gap:8px; width:max-content;">
                        ${Array.from({length: 25}, (_, i) => i + 26).map(n=>`<button id="btn-atv-${n}" class="g-btn-pill" onclick="window.switchQuestaoConc(${n})">${n}</button>`).join('')}
                    </div>
                </div>

                <div style="background:#fbfcfd; padding:20px; border-radius:12px; border:1px solid #f1f5f9; min-height:300px;">
                    ${Array.from({length: 50}, (_, i) => i + 1).map(n=>`
                    <div id="content-atv-${n}" class="g-content-box" style="display:${n===1 ? 'block' : 'none'};">
                        <label class="label-sutil">Enunciado da Questão ${n}:</label>
                        <textarea id="enunc-atv-${n}" class="input-premium" style="height:80px; resize:none;" placeholder="Digite a pergunta completa..." autocomplete="off" oninput="window.triggerAutoSaveConc()"></textarea>
                        
                        <label class="label-sutil" style="margin-top:10px;">Alternativas:</label>
                        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
                            <div style="position: relative;">
                                <span style="position: absolute; left: 12px; top: 11px; color: #94a3b8; font-size: 13px; font-weight: 800;">A</span>
                                <input type="text" id="opt-a-${n}" class="input-premium" style="padding-left: 32px; margin-bottom:0;" autocomplete="off" oninput="window.triggerAutoSaveConc()">
                            </div>
                            <div style="position: relative;">
                                <span style="position: absolute; left: 12px; top: 11px; color: #94a3b8; font-size: 13px; font-weight: 800;">B</span>
                                <input type="text" id="opt-b-${n}" class="input-premium" style="padding-left: 32px; margin-bottom:0;" autocomplete="off" oninput="window.triggerAutoSaveConc()">
                            </div>
                            <div style="position: relative;">
                                <span style="position: absolute; left: 12px; top: 11px; color: #94a3b8; font-size: 13px; font-weight: 800;">C</span>
                                <input type="text" id="opt-c-${n}" class="input-premium" style="padding-left: 32px; margin-bottom:0;" autocomplete="off" oninput="window.triggerAutoSaveConc()">
                            </div>
                            <div style="position: relative;">
                                <span style="position: absolute; left: 12px; top: 11px; color: #94a3b8; font-size: 13px; font-weight: 800;">D</span>
                                <input type="text" id="opt-d-${n}" class="input-premium" style="padding-left: 32px; margin-bottom:0;" autocomplete="off" oninput="window.triggerAutoSaveConc()">
                            </div>
                            <div style="position: relative;">
                                <span style="position: absolute; left: 12px; top: 11px; color: #94a3b8; font-size: 13px; font-weight: 800;">E</span>
                                <input type="text" id="opt-e-${n}" class="input-premium" style="padding-left: 32px; margin-bottom:0;" autocomplete="off" oninput="window.triggerAutoSaveConc()">
                            </div>
                        </div>
                        
                        <div style="display:flex; flex-direction:column; gap:10px; background:#f8fafc; padding:15px; border-radius:8px; border:1px dashed #cbd5e1;">
                            <div>
                                <label class="label-sutil">Alternativa Correta (Gabarito):</label>
                                <select id="correct-${n}" class="input-premium" style="width:100px; margin:0; font-weight:900; color:#0f172a;" onchange="window.triggerAutoSaveConc()">
                                    <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option><option value="E">E</option>
                                </select>
                            </div>
                            <div>
                                <label class="label-sutil" style="margin-top: 5px;">Explicação da Alternativa Correta:</label>
                                <textarea id="explicacao-atv-${n}" class="input-premium" style="height:60px; resize:none; margin-bottom: 0;" placeholder="Escreva o porquê desta resposta estar certa..." autocomplete="off" oninput="window.triggerAutoSaveConc()"></textarea>
                            </div>
                        </div>
                    </div>`).join('')}
                </div>

                <button class="btn-publish-conc" onclick="window.enviarAtividadeConcurso()">PUBLICAR QUESTÕES AGORA</button>
            </div>
        </div>

        <div id="pane-enviadas" class="tab-pane-conc" style="display:none;">
            <div id="lista-enviadas-dados"></div>
        </div>

    </div>`;
});