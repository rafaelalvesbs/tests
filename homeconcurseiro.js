window.Router.register('homeconcurseiro', async () => {
    const db = window.db;
    const { collection, getDocs, query, where, doc, getDoc, setDoc, updateDoc } = window.fsMethods;
    const auth = window.authMethods.getAuth();
    const userAtual = auth.currentUser;

    if (!userAtual) return '<div>Erro: Usuário não logado.</div>';

    // Estado Local
    let dadosConcurso = null;
    let disciplinasAtuais = [];
    let bateriaQuestoes = [];
    let questoesPendentes = [];
    let questaoAtual = null;
    let progressoUsuario = { resolvidas: {}, acertos: 0, erros: 0, totalFeitas: 0 };
    let disciplinaSelecionada = "";
    let somMutado = false;
    let questaoRespondidaAgora = false;
    let cargoSelecionado = null;
    let cargosDisponiveis = {};
    let todasAtividadesConcurso = [];
    let backupProgresso = null;
    let timerInterval = null;
    let tempoSegundos = 0;
    let modoFocoAtivo = false;
    let refazendoErros = false;

    // Gerador de Som nativo (Web Audio API) para não depender de arquivos externos
    const tocarSom = (tipo) => {
        if (somMutado) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const gain = ctx.createGain();
            gain.connect(ctx.destination);
            
            if (tipo === 'pagina') {
                const bufferSize = ctx.sampleRate * 0.15;
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(800, ctx.currentTime);
                filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);
                noise.connect(filter);
                filter.connect(gain);
                gain.gain.setValueAtTime(0.4, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
                noise.start(); noise.stop(ctx.currentTime + 0.15);
                return;
            }

            const osc = ctx.createOscillator();
            osc.connect(gain);
            
            if (tipo === 'acerto') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, ctx.currentTime);
                osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
                osc.start(); osc.stop(ctx.currentTime + 0.5);
            } else {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, ctx.currentTime);
                osc.frequency.setValueAtTime(200, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.4);
                osc.start(); osc.stop(ctx.currentTime + 0.4);
            }
        } catch(e) {}
    };

    window.toggleMute = () => {
        somMutado = !somMutado;
        const btn = document.getElementById('btn-mute-sound');
        if (somMutado) {
            btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
            btn.style.color = '#ef4444';
        } else {
            btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            btn.style.color = '#10b981';
        }
    };

    // 1. DADOS INICIAIS
    const userInfo = window.usuarioLogado || {};
    const nomeCompleto = userInfo.nome || "Concurseiro";
    const primeiroNome = nomeCompleto.split(' ')[0];

    window.showAlertAluno = (titulo, mensagem, tipo = 'info') => {
        const modal = document.getElementById('modal-alert-aluno');
        document.getElementById('alert-title-aluno').innerText = titulo;
        document.getElementById('alert-msg-aluno').innerHTML = mensagem;
        document.getElementById('alert-icon-aluno').innerHTML = tipo === 'error' ? '<i class="fa-solid fa-circle-xmark" style="color:#ef4444; font-size:40px;"></i>' : '<i class="fa-solid fa-circle-check" style="color:#10b981; font-size:40px;"></i>';
        modal.style.display = 'flex';
    };
    window.closeAlertAluno = () => { document.getElementById('modal-alert-aluno').style.display = 'none'; };

    window.showConfirmAluno = (titulo, mensagem, onConfirm) => {
        const modal = document.getElementById('modal-confirm-aluno');
        document.getElementById('confirm-title-aluno').innerText = titulo;
        document.getElementById('confirm-msg-aluno').innerText = mensagem;
        modal.style.display = 'flex';
        window.pendingConfirmActionAluno = async () => { 
            await onConfirm(); 
            modal.style.display = 'none'; 
        };
    };

    window.filtrarDisciplinasPeloCargo = () => {
        const setDisciplinas = new Set();
        todasAtividadesConcurso.forEach(atv => {
            if(atv.cargoId === cargoSelecionado && atv.disciplina) {
                setDisciplinas.add(atv.disciplina);
            }
        });
        disciplinasAtuais = Array.from(setDisciplinas).sort();
    };

    const buscarDadosIniciais = async () => {
        try {
            const idConcurso = userInfo.concursoId;
            if (!idConcurso) {
                document.getElementById('estado-vazio-concurso').style.display = 'block';
                document.getElementById('view-boas-vindas').style.display = 'none';
                return;
            }

            const cacheCargoKey = `p4f_cache_cargo_${userAtual.uid}`;
            const cargoSalvoLocal = localStorage.getItem(cacheCargoKey);

            const docConc = await getDoc(doc(db, "concursos", idConcurso));
            if (docConc.exists()) {
                dadosConcurso = { id: docConc.id, ...docConc.data() };
                
                const qAtividades = query(collection(db, "atividades_concursos"), where("concursoId", "==", idConcurso));
                const snapAtividades = await getDocs(qAtividades);
                
                todasAtividadesConcurso = [];
                cargosDisponiveis = {};
                
                snapAtividades.forEach(d => {
                    const atv = d.data();
                    todasAtividadesConcurso.push({ idOriginal: d.id, ...atv });
                    if(atv.cargoId && atv.cargoNome) {
                        cargosDisponiveis[atv.cargoId] = atv.cargoNome;
                    }
                });

                const docCargoSalvo = await getDoc(doc(db, "progresso_concurseiro", `${userAtual.uid}_cargo_fixo`));
                if (docCargoSalvo.exists()) {
                    cargoSelecionado = docCargoSalvo.data().cargoId;
                    localStorage.setItem(cacheCargoKey, cargoSelecionado);
                } else if (cargoSalvoLocal) {
                    cargoSelecionado = cargoSalvoLocal;
                }

                if (cargoSelecionado) {
                    window.filtrarDisciplinasPeloCargo();
                    const badgeCargo = document.getElementById('cargo-atual-badge');
                    if (badgeCargo && cargosDisponiveis[cargoSelecionado]) {
                        badgeCargo.innerHTML = `<i class="fa-solid fa-user-tie" style="margin-right: 8px;"></i>Cargo: ${cargosDisponiveis[cargoSelecionado]}`;
                        badgeCargo.style.display = 'inline-block';
                    }
                }
            } else {
                document.getElementById('estado-vazio-concurso').style.display = 'block';
                document.getElementById('view-boas-vindas').style.display = 'none';
            }
        } catch (e) {
            console.error("Erro ao buscar dados:", e);
        }
    };

    // NAVEGAÇÃO ENTRE VIEWS
    window.irParaView = (idView) => {
        document.querySelectorAll('.view-concurseiro').forEach(v => v.style.display = 'none');
        document.getElementById(idView).style.display = 'block';
    };

    window.iniciarJornada = () => {
        if (!dadosConcurso) return;
        document.getElementById('card-concurso-nome').innerText = dadosConcurso.titulo;
        window.irParaView('view-concurso');
    };

    window.verificarCargo = () => {
        if (cargoSelecionado) {
            window.abrirDisciplinas();
        } else {
            window.abrirTelaCargos();
        }
    };

    window.abrirTelaCargos = () => {
        const container = document.getElementById('lista-cargos');
        const chavesCargos = Object.keys(cargosDisponiveis);
        
        if (chavesCargos.length === 0) {
            container.innerHTML = '<p style="color:#64748b; font-size:13px; text-align:center;">Nenhuma questão ou cargo encontrado para este concurso ainda.</p>';
        } else {
            container.innerHTML = chavesCargos.map(idCargo => `
                <div class="card-disciplina" onclick="window.salvarCargoFixo('${idCargo}')">
                    <div class="icone-disc"><i class="fa-solid fa-user-tie"></i></div>
                    <div class="nome-disc">${cargosDisponiveis[idCargo]}</div>
                    <i class="fa-solid fa-chevron-right seta-disc"></i>
                </div>
            `).join('');
        }
        window.irParaView('view-cargos');
    };

   window.salvarCargoFixo = (idCargo) => {
        window.showConfirmAluno("Confirmar Escolha?", "ATENÇÃO: Após escolher este cargo, você NÃO poderá mudar depois. Tem certeza?", () => {
            cargoSelecionado = idCargo;
            localStorage.setItem(`p4f_cache_cargo_${userAtual.uid}`, idCargo);
            window.filtrarDisciplinasPeloCargo();
            window.abrirDisciplinas();
            
            setDoc(doc(db, "progresso_concurseiro", `${userAtual.uid}_cargo_fixo`), { 
                cargoId: idCargo, 
                dataEscolha: Date.now() 
            }).catch(() => {
                console.log("Falha ao salvar no banco, mas salvo em cache local");
            });
        });
    };

    window.abrirDisciplinas = () => {
        const container = document.getElementById('lista-disciplinas');
        if (disciplinasAtuais.length === 0) {
            container.innerHTML = '<p style="color:#64748b; font-size:13px; text-align:center;">Nenhuma disciplina cadastrada para este cargo ainda.</p>';
        } else {
            container.innerHTML = disciplinasAtuais.map(disc => `
                <div class="card-disciplina" onclick="window.abrirQuestoesDisciplina('${disc}')">
                    <div class="icone-disc"><i class="fa-solid fa-book-open"></i></div>
                    <div class="nome-disc">${disc}</div>
                    <i class="fa-solid fa-chevron-right seta-disc"></i>
                </div>
            `).join('');
        }
        window.irParaView('view-disciplinas');
    };

    window.abrirQuestoesDisciplina = async (disciplina) => {
        disciplinaSelecionada = disciplina;
        document.getElementById('loader-questoes').style.display = 'flex';
        window.irParaView('view-questoes');

        try {
            // 1. Usa o array puxado no início, filtrando por disciplina e cargo escolhido
            bateriaQuestoes = [];
            todasAtividadesConcurso.forEach(data => {
                if (data.disciplina === disciplina && data.cargoId === cargoSelecionado) {
                    if (data.questoes) {
                        data.questoes.forEach((qItem, idx) => {
                            bateriaQuestoes.push({
                                idQ: `${data.idOriginal}_${idx}`,
                                ...qItem
                            });
                        });
                    }
                }
            });

            // 2. Busca progresso do aluno nesta disciplina com cache local
            const cacheProgKey = `p4f_prog_${userAtual.uid}_${dadosConcurso.id}_${disciplina}`;
            const progressoSalvoLocal = localStorage.getItem(cacheProgKey);
            
            if (progressoSalvoLocal) {
                progressoUsuario = JSON.parse(progressoSalvoLocal);
                if(!progressoUsuario.resolvidas) progressoUsuario.resolvidas = {};
            } else {
                const docProgresso = await getDoc(doc(db, "progresso_concurseiro", `${userAtual.uid}_${dadosConcurso.id}_${disciplina}`));
                if (docProgresso.exists()) {
                    progressoUsuario = docProgresso.data();
                    if(!progressoUsuario.resolvidas) progressoUsuario.resolvidas = {};
                } else {
                    progressoUsuario = { resolvidas: {}, acertos: 0, erros: 0, totalFeitas: 0 };
                }
                localStorage.setItem(cacheProgKey, JSON.stringify(progressoUsuario));
            }

            // 3. Filtra apenas as que não foram resolvidas
            questoesPendentes = bateriaQuestoes.filter(q => !progressoUsuario.resolvidas[q.idQ]);
            
            document.getElementById('loader-questoes').style.display = 'none';

            if (questoesPendentes.length === 0) {
                document.getElementById('fim-disciplina').style.display = 'flex';
                document.getElementById('area-resolucao').style.display = 'none';
            } else {
                // Embaralha as pendentes para vir aleatório
                questoesPendentes = questoesPendentes.sort(() => Math.random() - 0.5);
                carregarProximaQuestao();
            }

        } catch (e) {
            console.error("Erro ao carregar questões:", e);
        }
    };

    window.abrirModalFiltroDisciplina = () => {
        const modal = document.getElementById('modal-filtro-disciplina');
        const selectDisc = document.getElementById('select-filtro-disciplina');
        selectDisc.innerHTML = '<option value="TODAS">Todas as Disciplinas</option>';
        
        disciplinasAtuais.forEach(disc => {
            const opt = document.createElement('option');
            opt.value = disc;
            opt.innerText = disc;
            if (disc === disciplinaSelecionada) opt.selected = true;
            selectDisc.appendChild(opt);
        });
        modal.style.display = 'flex';
    };

    window.iniciarFiltroPorDisciplina = () => {
        const discSelecionada = document.getElementById('select-filtro-disciplina').value;
        document.getElementById('modal-filtro-disciplina').style.display = 'none';
        
        if (discSelecionada === 'TODAS') {
            window.abrirTodasQuestoesMisturadas();
        } else {
            window.abrirQuestoesDisciplina(discSelecionada);
        }
    };

    window.abrirTodasQuestoesMisturadas = async () => {
        disciplinaSelecionada = "MISTURADO";
        document.getElementById('loader-questoes').style.display = 'flex';
        window.irParaView('view-questoes');

        try {
            bateriaQuestoes = [];
            todasAtividadesConcurso.forEach(data => {
                if (data.cargoId === cargoSelecionado && data.questoes) {
                    data.questoes.forEach((qItem, idx) => {
                        bateriaQuestoes.push({ idQ: `${data.idOriginal}_${idx}`, ...qItem });
                    });
                }
            });

            const cacheProgKey = `p4f_prog_${userAtual.uid}_${dadosConcurso.id}_misturado`;
            const progressoSalvoLocal = localStorage.getItem(cacheProgKey);
            
            if (progressoSalvoLocal) {
                progressoUsuario = JSON.parse(progressoSalvoLocal);
                if (!progressoUsuario.resolvidas) progressoUsuario.resolvidas = {};
            } else {
                const docProgresso = await getDoc(doc(db, "progresso_concurseiro", `${userAtual.uid}_${dadosConcurso.id}_misturado`));
                if (docProgresso.exists()) {
                    progressoUsuario = docProgresso.data();
                    if (!progressoUsuario.resolvidas) progressoUsuario.resolvidas = {};
                } else {
                    progressoUsuario = { resolvidas: {}, acertos: 0, erros: 0, totalFeitas: 0 };
                }
                localStorage.setItem(cacheProgKey, JSON.stringify(progressoUsuario));
            }

            questoesPendentes = bateriaQuestoes.filter(q => !progressoUsuario.resolvidas[q.idQ]);
            document.getElementById('loader-questoes').style.display = 'none';

            if (questoesPendentes.length === 0) {
                document.getElementById('fim-disciplina').style.display = 'flex';
                document.getElementById('area-resolucao').style.display = 'none';
            } else {
                questoesPendentes = questoesPendentes.sort(() => Math.random() - 0.5);
                carregarProximaQuestao();
                document.getElementById('q-concurso-nome').innerText = "MISTURADO";
            }
        } catch (e) { console.error(e); }
    };

    window.abrirModalFiltroAssunto = () => {
        const modal = document.getElementById('modal-filtro-assunto');
        const selectAssunto = document.getElementById('select-filtro-assunto');
        selectAssunto.innerHTML = '<option value="TODOS">Todos os Assuntos</option>';

        let assuntosEncontrados = new Set();
        todasAtividadesConcurso.forEach(data => {
            let pertenceADisciplina = (disciplinaSelecionada === "MISTURADO") || (data.disciplina === disciplinaSelecionada);
            if (data.cargoId === cargoSelecionado && pertenceADisciplina && data.assunto) {
                assuntosEncontrados.add(data.assunto);
            }
        });

        Array.from(assuntosEncontrados).sort().forEach(assunto => {
            const opt = document.createElement('option');
            opt.value = assunto;
            opt.innerText = assunto;
            selectAssunto.appendChild(opt);
        });

        modal.style.display = 'flex';
    };

    window.iniciarFiltroPorAssunto = async () => {
        const assuntoEscolhido = document.getElementById('select-filtro-assunto').value;
        document.getElementById('modal-filtro-assunto').style.display = 'none';

        if (assuntoEscolhido === 'TODOS') {
            if (disciplinaSelecionada === "MISTURADO") {
                window.abrirTodasQuestoesMisturadas();
            } else {
                window.abrirQuestoesDisciplina(disciplinaSelecionada);
            }
            return;
        }

        document.getElementById('loader-questoes').style.display = 'flex';
        window.irParaView('view-questoes');

        try {
            bateriaQuestoes = [];
            todasAtividadesConcurso.forEach(data => {
                let pertenceADisciplina = (disciplinaSelecionada === "MISTURADO") || (data.disciplina === disciplinaSelecionada);
                if (data.cargoId === cargoSelecionado && pertenceADisciplina && data.assunto === assuntoEscolhido && data.questoes) {
                    data.questoes.forEach((qItem, idx) => {
                        bateriaQuestoes.push({ idQ: `${data.idOriginal}_${idx}`, ...qItem });
                    });
                }
            });

            const safeAssuntoKey = assuntoEscolhido.replace(/[^a-zA-Z0-9]/g, '_');
            const cacheProgKey = `p4f_prog_${userAtual.uid}_${dadosConcurso.id}_${safeAssuntoKey}`;
            const progressoSalvoLocal = localStorage.getItem(cacheProgKey);
            
            if (progressoSalvoLocal) {
                progressoUsuario = JSON.parse(progressoSalvoLocal);
                if (!progressoUsuario.resolvidas) progressoUsuario.resolvidas = {};
            } else {
                const docProgresso = await getDoc(doc(db, "progresso_concurseiro", `${userAtual.uid}_${dadosConcurso.id}_${safeAssuntoKey}`));
                if (docProgresso.exists()) {
                    progressoUsuario = docProgresso.data();
                    if (!progressoUsuario.resolvidas) progressoUsuario.resolvidas = {};
                } else {
                    progressoUsuario = { resolvidas: {}, acertos: 0, erros: 0, totalFeitas: 0 };
                }
                localStorage.setItem(cacheProgKey, JSON.stringify(progressoUsuario));
            }

            questoesPendentes = bateriaQuestoes.filter(q => !progressoUsuario.resolvidas[q.idQ]);
            document.getElementById('loader-questoes').style.display = 'none';

            if (questoesPendentes.length === 0) {
                document.getElementById('fim-disciplina').style.display = 'flex';
                document.getElementById('area-resolucao').style.display = 'none';
            } else {
                questoesPendentes = questoesPendentes.sort(() => Math.random() - 0.5);
                carregarProximaQuestao();
                document.getElementById('q-concurso-nome').innerText = assuntoEscolhido.substring(0, 15) + (assuntoEscolhido.length > 15 ? '...' : '');
            }
        } catch (e) { console.error(e); }
    };

    window.toggleTimer = () => {
        const btn = document.getElementById('btn-timer');
        const display = document.getElementById('display-timer');
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
            btn.style.color = '#64748b';
            display.style.display = 'none';
        } else {
            tempoSegundos = 0;
            display.innerText = "00:00";
            display.style.display = 'flex';
            btn.style.color = '#f59e0b';
            timerInterval = setInterval(() => {
                tempoSegundos++;
                const m = Math.floor(tempoSegundos / 60).toString().padStart(2, '0');
                const s = (tempoSegundos % 60).toString().padStart(2, '0');
                display.innerText = `${m}:${s}`;
            }, 1000);
        }
    };

    window.toggleFavorito = () => {
        if (!questaoAtual) return;
        const idQ = questaoAtual.idQ;
        if (!progressoUsuario.favoritas) progressoUsuario.favoritas = {};
        
        if (progressoUsuario.favoritas[idQ]) {
            delete progressoUsuario.favoritas[idQ];
            document.getElementById('btn-fav-q').style.color = '#cbd5e1';
        } else {
            progressoUsuario.favoritas[idQ] = true;
            document.getElementById('btn-fav-q').style.color = '#eab308';
        }
        
        const cacheProgKey = `p4f_prog_${userAtual.uid}_${dadosConcurso.id}_${disciplinaSelecionada}`;
        localStorage.setItem(cacheProgKey, JSON.stringify(progressoUsuario));
        setDoc(doc(db, "progresso_concurseiro", `${userAtual.uid}_${dadosConcurso.id}_${disciplinaSelecionada}`), progressoUsuario, { merge: true });
    };

    window.abrirModalReporte = () => {
        document.getElementById('modal-reportar-erro').style.display = 'flex';
    };

    window.enviarReporte = async () => {
        const desc = document.getElementById('input-reporte-erro').value;
        if (!desc.trim()) return;
        
        document.getElementById('modal-reportar-erro').style.display = 'none';
        
        try {
            await setDoc(doc(collection(db, "reportes_questoes")), {
                usuarioId: userAtual.uid,
                questaoId: questaoAtual.idQ,
                concursoId: dadosConcurso.id,
                descricao: desc,
                data: Date.now()
            });
            window.showAlertAluno("Reporte Enviado", "Obrigado por avisar! Nossa equipe vai analisar essa questão.");
        } catch(e) {
            console.error(e);
        }
    };

    const carregarProximaQuestao = () => {
        if (questoesPendentes.length === 0) {
            const erradas = bateriaQuestoes.filter(q => progressoUsuario.resolvidas[q.idQ] && !progressoUsuario.resolvidas[q.idQ].acertou);
            
            if (erradas.length > 0 && !refazendoErros) {
                refazendoErros = true;
                questoesPendentes = erradas.sort(() => Math.random() - 0.5);
                questoesPendentes.forEach(q => delete progressoUsuario.resolvidas[q.idQ]);
            } else {
                document.getElementById('fim-disciplina').style.display = 'flex';
                document.getElementById('area-resolucao').style.display = 'none';
                return;
            }
        }

        questaoRespondidaAgora = false;
        questaoAtual = questoesPendentes[0];
        
        document.getElementById('fim-disciplina').style.display = 'none';
        document.getElementById('area-resolucao').style.display = 'block';
        document.getElementById('q-concurso-nome').innerText = dadosConcurso.titulo;
        
        const favIconColor = (progressoUsuario.favoritas && progressoUsuario.favoritas[questaoAtual.idQ]) ? '#eab308' : '#cbd5e1';
        
        let headerQuestaoAdicional = '';
        if (refazendoErros) {
            headerQuestaoAdicional = `<span style="display: inline-block; padding: 2px 10px; background: #ef4444; color: #fff; border-radius: 6px; font-size: 11px; font-weight: 800; margin-left: 8px;">REFAZENDO ERROS</span>`;
        }

        document.getElementById('q-progresso').innerText = `${progressoUsuario.totalFeitas + 1} / ${bateriaQuestoes.length}`;
        
        const numQuestao = progressoUsuario.totalFeitas + 1;
        const containerQuestao = document.getElementById('render-questao-aqui');
        const letras = ['A', 'B', 'C', 'D', 'E'];
        
        let htmlAlternativas = letras.filter(opt => questaoAtual.opcoes[opt]).map(opt => `
            <div id="alt-${opt}" onclick="window.responderQuestao('${opt}')" style="position: relative; display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; font-size: 13px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; transition: 0.2s;">
                <span class="alt-letra" style="font-weight: 800; color: #64748b; width: 20px;">${opt})</span>
                <span class="alt-texto" style="color: #334155; font-weight: 500; transition: 0.2s;">${questaoAtual.opcoes[opt]}</span>
                <i class="fa-solid fa-circle-check alt-icone" style="margin-left: auto; color: transparent; transition: 0.2s;"></i>
            </div>
        `).join('');

        containerQuestao.innerHTML = `
            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div>
                        <span style="display: inline-block; padding: 2px 10px; background: #0f172a; color: #fff; border-radius: 6px; font-size: 11px; font-weight: 800;">QUESTÃO ${numQuestao}</span>
                        ${headerQuestaoAdicional}
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <i id="btn-fav-q" class="fa-solid fa-star" onclick="window.toggleFavorito()" style="color: ${favIconColor}; font-size: 18px; cursor: pointer; transition: 0.2s;" title="Favoritar Questão"></i>
                        <i class="fa-solid fa-triangle-exclamation" onclick="window.abrirModalReporte()" style="color: #cbd5e1; font-size: 18px; cursor: pointer; transition: 0.2s;" title="Reportar Erro"></i>
                    </div>
                </div>
                <p style="font-weight: 600; color: #1e293b; font-size: 14px; line-height: 1.6; margin-bottom: 15px;">${questaoAtual.enunciado.replace(/\n/g, '<br>')}</p>
                <div style="display: grid; gap: 8px;">
                    ${htmlAlternativas}
                </div>
                <div id="q-explicacao" style="display: none; margin-top: 15px; padding: 15px; border-radius: 8px; font-size: 13px; color: #475569; background: #f8fafc; border: 1px dashed #cbd5e1;"></div>
            </div>
        `;

        atualizarPlacarEstatisticas();
    };

    const atualizarPlacarEstatisticas = () => {
        document.getElementById('stat-feitas').innerText = progressoUsuario.totalFeitas;
        document.getElementById('stat-acertos').innerText = progressoUsuario.acertos;
        const porcentagem = progressoUsuario.totalFeitas > 0 ? Math.round((progressoUsuario.acertos / progressoUsuario.totalFeitas) * 100) : 0;
        document.getElementById('stat-pct').innerText = `${porcentagem}%`;
    };

    window.responderQuestao = async (letraSelecionada) => {
        if (questaoRespondidaAgora) return;
        questaoRespondidaAgora = true;

        const correta = questaoAtual.correta.toUpperCase();
        const acertou = letraSelecionada === correta;

        const aplicarEstilo = (letra, ehCorreta, marcadaPeloAluno) => {
            const el = document.getElementById(`alt-${letra}`);
            if (!el) return;
            
            if (ehCorreta) {
                el.style.border = "1px solid #10b981";
                el.style.background = "#ecfdf5";
                el.querySelector('.alt-letra').style.color = "#10b981";
                el.querySelector('.alt-texto').style.color = "#065f46";
                el.querySelector('.alt-texto').style.fontWeight = "700";
                el.querySelector('.alt-icone').style.color = "#10b981";
            } else if (marcadaPeloAluno && !ehCorreta) {
                el.style.border = "1px solid #ef4444";
                el.style.background = "#fef2f2";
                el.querySelector('.alt-letra').style.color = "#ef4444";
                el.querySelector('.alt-texto').style.color = "#ef4444";
                el.querySelector('.alt-icone').classList.remove('fa-circle-check');
                el.querySelector('.alt-icone').classList.add('fa-circle-xmark');
                el.querySelector('.alt-icone').style.color = "#ef4444";
            }
        };

        // Toca o som primeiro para resposta imediata
        tocarSom(acertou ? 'acerto' : 'erro');

        if (acertou) {
            aplicarEstilo(letraSelecionada, true, true);
            progressoUsuario.acertos++;
        } else {
            aplicarEstilo(letraSelecionada, false, true); 
            aplicarEstilo(correta, true, false); 
            progressoUsuario.erros++;
        }

        progressoUsuario.totalFeitas++;
        progressoUsuario.resolvidas[questaoAtual.idQ] = { acertou, data: Date.now() };

        const expBox = document.getElementById('q-explicacao');
        const altResposta = document.getElementById(`alt-${correta}`);
        
        let textoExp = questaoAtual.explicacao ? questaoAtual.explicacao.replace(/\n/g, '<br>') : `Gabarito Correto: ${correta}`;

        expBox.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <span style="font-size: 11px; font-weight: 800; color: #64748b;">EXPLICAÇÃO:</span>
            </div>
            ${textoExp}
        `;

        altResposta.style.zIndex = '99';
        expBox.style.position = 'absolute';
        expBox.style.left = '0';
        expBox.style.right = '0';
        expBox.style.zIndex = '100';
        expBox.style.background = '#e0f2fe';
        expBox.style.border = '2px solid #bae6fd';
        expBox.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
        
        if (['A', 'B', 'C'].includes(correta)) {
            expBox.style.top = '100%';
            expBox.style.marginTop = '10px';
            expBox.style.bottom = 'auto';
            expBox.style.marginBottom = '0';
        } else {
            expBox.style.bottom = '100%';
            expBox.style.marginBottom = '10px';
            expBox.style.top = 'auto';
            expBox.style.marginTop = '0';
        }

        altResposta.appendChild(expBox);
        expBox.style.display = 'block';

        atualizarPlacarEstatisticas();

        // Salva Progresso localmente e no Firebase em background
        try {
            const cacheProgKey = `p4f_prog_${userAtual.uid}_${dadosConcurso.id}_${disciplinaSelecionada}`;
            localStorage.setItem(cacheProgKey, JSON.stringify(progressoUsuario));
            
            const refDoc = doc(db, "progresso_concurseiro", `${userAtual.uid}_${dadosConcurso.id}_${disciplinaSelecionada}`);
            setDoc(refDoc, progressoUsuario, { merge: true });
        } catch(e) {}

        // Remove da fila
        questoesPendentes.shift();
    };

    window.avancarPosResposta = () => {
        if (!questaoRespondidaAgora) return;
        carregarProximaQuestao();
    };

    // Lógica de Swipe no Mobile
    let touchstartX = 0;
    let touchendX = 0;
    const checkSwipe = () => {
        if (touchendX < touchstartX - 50 && questaoRespondidaAgora) {
            const container = document.getElementById('render-questao-aqui');
            if (window.innerWidth < 769 && container) {
                tocarSom('pagina');
                container.style.animation = 'pageSwipeOut 0.35s forwards ease-in';
                setTimeout(() => {
                    window.avancarPosResposta();
                    container.style.animation = 'pageSwipeIn 0.35s forwards ease-out';
                    setTimeout(() => { container.style.animation = ''; }, 350);
                }, 300);
            } else {
                window.avancarPosResposta();
            }
        }
    };

    setTimeout(() => {
        buscarDadosIniciais();
        
        // Listener de Swipe
        const areaRes = document.getElementById('area-resolucao');
        if(areaRes) {
            areaRes.addEventListener('touchstart', e => { touchstartX = e.changedTouches[0].screenX; }, {passive: true});
            areaRes.addEventListener('touchend', e => { 
                touchendX = e.changedTouches[0].screenX; 
                checkSwipe(); 
            }, {passive: true});
        }
    }, 300);

    return `
    <style>
        .hc-container { width: 100%; min-height: 100%; font-family: 'Plus Jakarta Sans', sans-serif; background: #f0f9ff; padding-bottom: 50px; }
        @media (min-width: 769px) { .hc-container { background: #f4f7f6; } }
        .view-concurseiro { display: none; padding: 20px; max-width: 800px; margin: 0 auto; }
        
        /* HEADER TOPO */
        .hc-topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .hc-topbar-titulo { font-size: 24px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; }
        .hc-avatar { width: 45px; height: 45px; border-radius: 50%; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; }

        /* VIEW 1: BOAS VINDAS */
        #view-boas-vindas[style*="display: block"] { display: flex !important; }
        #view-boas-vindas { flex-direction: column; justify-content: center; min-height: 80vh; }
        .welcome-box { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 24px; padding: 40px 30px; color: white; text-align: center; box-shadow: 0 10px 25px rgba(15,23,42,0.2); margin: 0 auto; width: 100%; }
        
       @media (min-width: 769px) {
            #view-boas-vindas {
                display: none;
                align-items: center;
                justify-content: center;
                min-height: 75vh;
                max-width: 950px;
            }
            #view-boas-vindas[style*="display: block"] {
                display: flex !important;
            }
            .welcome-box {
                padding: 90px 50px;
                min-height: 550px;
                width: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            .w-icon { font-size: 65px; margin-bottom: 25px; }
            .w-title { font-size: 36px; margin-bottom: 12px; }
            .w-subtitle { font-size: 18px; margin-bottom: 35px; }
            .btn-hc-primario { padding: 18px 35px; font-size: 17px; max-width: 340px; }
        }
        .w-icon { font-size: 50px; margin-bottom: 20px; color: #38bdf8; }
        .w-title { font-size: 28px; font-weight: 900; margin-bottom: 10px; }
        .w-subtitle { font-size: 15px; color: #cbd5e1; margin-bottom: 30px; line-height: 1.5; }
        .btn-hc-primario { background: #38bdf8; color: #0f172a; border: none; padding: 16px 30px; border-radius: 14px; font-size: 16px; font-weight: 800; cursor: pointer; transition: 0.3s; width: 100%; max-width: 300px; box-shadow: 0 4px 15px rgba(56,189,248,0.3); }
        .btn-hc-primario:hover { transform: translateY(-2px); background: #0ea5e9; }

        /* VIEW 2 & 3: CONCURSO E DISCIPLINAS */
        .card-concurso-select { background: #fff; border: 2px solid #e2e8f0; border-radius: 20px; padding: 30px; text-align: center; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 10px rgba(0,0,0,0.03); }
        .card-concurso-select:hover { border-color: #0f172a; transform: translateY(-3px); }
        .cc-icon { font-size: 40px; color: #0f172a; margin-bottom: 15px; }
        .cc-title { font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 5px; text-transform: uppercase; }
        .cc-subtitle { font-size: 13px; color: #64748b; font-weight: 600; }

        .lista-disciplinas { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 20px; }
        .card-disciplina { background: #fff; padding: 18px 20px; border-radius: 16px; display: flex; align-items: center; border: 1px solid #e2e8f0; cursor: pointer; transition: 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.02); }
        .card-disciplina:hover { border-color: #38bdf8; background: #f0f9ff; }
        .icone-disc { width: 40px; height: 40px; background: #f1f5f9; color: #0f172a; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; margin-right: 15px; }
        .nome-disc { flex: 1; font-weight: 800; color: #1e293b; font-size: 15px; text-transform: uppercase; }
        .seta-disc { color: #94a3b8; font-size: 14px; }

        /* VIEW 4: RESOLUÇÃO DE QUESTÃO */
        .q-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .q-tag-concurso { background: #0f172a; color: white; padding: 6px 12px; border-radius: 8px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        .q-progresso-badge { font-size: 12px; font-weight: 800; color: #64748b; background: #e2e8f0; padding: 6px 12px; border-radius: 8px; }
        
        .q-actions { display: flex; justify-content: flex-end; margin-bottom: 15px; gap: 10px; }
        .btn-acao-q { background: #fff; border: 1px solid #e2e8f0; width: 40px; height: 40px; border-radius: 10px; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; transition: 0.2s; }
        
        .q-card-enunciado { background: #fff; padding: 25px; border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); border: 1px solid #f1f5f9; margin-bottom: 20px; }
        .q-texto { font-size: 16px; color: #1e293b; font-weight: 600; line-height: 1.6; }

        .q-alternativas { display: flex; flex-direction: column; gap: 12px; margin-bottom: 25px; }
        .q-alt-card { background: #fff; border: 2px solid #e2e8f0; padding: 15px; border-radius: 16px; display: flex; align-items: center; cursor: pointer; transition: 0.2s; }
        .q-alt-card:hover { border-color: #94a3b8; }
        .q-alt-letra { width: 32px; height: 32px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #0f172a; margin-right: 15px; font-size: 13px; flex-shrink: 0; }
        .q-alt-texto { font-size: 14px; font-weight: 600; color: #334155; line-height: 1.4; }

        /* Estados das Alternativas */
        .alt-correta { border-color: #10b981 !important; background: #ecfdf5 !important; }
        .alt-correta .q-alt-letra { background: #10b981 !important; color: white !important; }
        .alt-errada { border-color: #ef4444 !important; background: #fef2f2 !important; }
        .alt-errada .q-alt-letra { background: #ef4444 !important; color: white !important; }

        /* Explicação */
        .exp-box { padding: 20px; border-radius: 16px; margin-bottom: 25px; font-size: 14px; line-height: 1.5; display: none; animation: slideDown 0.3s ease; }
        .exp-verde { background: #d1fae5; color: #065f46; border: 1px solid #34d399; }
        .exp-vermelha { background: #fee2e2; color: #991b1b; border: 1px solid #f87171; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

        /* Placar */
        .placar-stats { display: flex; justify-content: space-between; background: #fff; padding: 15px 20px; border-radius: 16px; border: 1px solid #e2e8f0; margin-bottom: 25px; }
        .stat-item { display: flex; flex-direction: column; align-items: center; }
        .stat-valor { font-size: 18px; font-weight: 900; color: #0f172a; }
        .stat-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-top: 4px; }
        .stat-acerto-color { color: #10b981; }

        /* Botão Próximo Desktop */
        .btn-proxima-desk { display: none; background: #38bdf8; color: #0f172a; border: none; padding: 16px 20px; border-radius: 14px; font-size: 15px; font-weight: 800; cursor: pointer; width: 100%; box-shadow: 0 4px 15px rgba(56,189,248,0.2); transition: 0.2s; }
        .btn-proxima-desk:hover { background: #0ea5e9; }
        
        .instrucao-swipe { display: block; text-align: center; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-top: 15px; letter-spacing: 0.5px; }

        @media (min-width: 769px) {
            .btn-proxima-desk { display: flex; justify-content: center; align-items: center; gap: 10px; }
            .instrucao-swipe { display: none; }
        }

        /* Loader */
        .loader-q { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 0; }
        .spinner-q { width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top: 4px solid #0f172a; border-radius: 50%; animation: spinQ 0.8s linear infinite; margin-bottom: 15px; }
        @keyframes spinQ { to { transform: rotate(360deg); } }
        @keyframes pageSwipeOut { 0% { transform: translateX(0) scale(1) rotateY(0); opacity: 1; } 100% { transform: translateX(-100%) scale(0.95) rotateY(-20deg); opacity: 0.3; } }
        @keyframes pageSwipeIn { 0% { transform: translateX(100%) scale(0.95) rotateY(20deg); opacity: 0.3; } 100% { transform: translateX(0) scale(1) rotateY(0); opacity: 1; } }
        
        .modal-aluno { position:fixed; inset:0; background:rgba(15, 23, 42, 0.7); backdrop-filter:blur(4px); display:none; justify-content:center; align-items:center; z-index:9999; padding:20px; }
        .modal-aluno-content { background:#fff; width:100%; max-width:400px; border-radius:24px; padding:30px; text-align:center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
        .btn-modal-aluno { background:#0f172a; color:#fff; border:none; padding:16px; width:100%; border-radius:14px; font-weight:800; font-size: 15px; cursor:pointer; margin-top:20px; transition: 0.2s; }
        .btn-modal-aluno:hover { transform: translateY(-2px); }
    </style>

    <div class="hc-container">
        <div id="modal-alert-aluno" class="modal-aluno"><div class="modal-aluno-content"><div id="alert-icon-aluno" style="margin-bottom:15px;"></div><h3 id="alert-title-aluno" style="color:#0f172a; margin-top:0; font-size: 22px; font-weight: 900;"></h3><div id="alert-msg-aluno" style="color:#64748b; margin-bottom:25px; line-height: 1.5;"></div><button class="btn-modal-aluno" onclick="window.closeAlertAluno()" style="margin-top:0;">OK, ENTENDI</button></div></div>
        <div id="modal-confirm-aluno" class="modal-aluno"><div class="modal-aluno-content"><div style="font-size: 40px; color: #ef4444; margin-bottom: 15px;"><i class="fa-solid fa-triangle-exclamation"></i></div><h3 id="confirm-title-aluno" style="color:#0f172a; margin-top:0; font-size: 22px; font-weight: 900;"></h3><p id="confirm-msg-aluno" style="color:#64748b; margin-bottom:25px; line-height: 1.5; font-weight: 600;"></p><div style="display:flex; flex-direction: column; gap:12px;"><button class="btn-modal-aluno" style="background:#ef4444; margin-top:0;" onclick="window.pendingConfirmActionAluno()">SIM, CONFIRMAR ESCOLHA</button><button class="btn-modal-aluno" style="background:#f1f5f9; color:#64748b; margin-top:0;" onclick="this.closest('.modal-aluno').style.display='none'">CANCELAR</button></div></div></div>
        
        <!-- MODAL FILTRO DISCIPLINA -->
        <div id="modal-filtro-disciplina" class="modal-aluno">
            <div class="modal-aluno-content">
                <div style="font-size: 35px; color: #3b82f6; margin-bottom: 10px;"><i class="fa-solid fa-shuffle"></i></div>
                <h3 style="color:#0f172a; margin-top:0; font-size: 20px; font-weight: 900;">Filtrar por Disciplina</h3>
                <p style="color:#64748b; font-size: 13px; margin-bottom:15px;">Escolha uma disciplina específica ou misture todas.</p>
                <select id="select-filtro-disciplina" style="width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #cbd5e1; margin-bottom: 20px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 600; outline: none;"></select>
                <div style="display:flex; flex-direction: column; gap:10px;">
                    <button class="btn-modal-aluno" style="background:#3b82f6; margin-top:0;" onclick="window.iniciarFiltroPorDisciplina()">FILTRAR QUESTÕES</button>
                    <button class="btn-modal-aluno" style="background:#f1f5f9; color:#64748b; margin-top:0;" onclick="this.closest('.modal-aluno').style.display='none'">CANCELAR</button>
                </div>
            </div>
        </div>

        <!-- MODAL FILTRO ASSUNTO -->
        <div id="modal-filtro-assunto" class="modal-aluno">
            <div class="modal-aluno-content">
                <div style="font-size: 35px; color: #8b5cf6; margin-bottom: 10px;"><i class="fa-solid fa-filter"></i></div>
                <h3 style="color:#0f172a; margin-top:0; font-size: 20px; font-weight: 900;">Filtrar por Assunto</h3>
                <p style="color:#64748b; font-size: 13px; margin-bottom:15px;">Escolha um assunto desta disciplina para focar.</p>
                <select id="select-filtro-assunto" style="width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #cbd5e1; margin-bottom: 20px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; font-weight: 600; outline: none;"></select>
                <div style="display:flex; flex-direction: column; gap:10px;">
                    <button class="btn-modal-aluno" style="background:#8b5cf6; margin-top:0;" onclick="window.iniciarFiltroPorAssunto()">FILTRAR QUESTÕES</button>
                    <button class="btn-modal-aluno" style="background:#f1f5f9; color:#64748b; margin-top:0;" onclick="this.closest('.modal-aluno').style.display='none'">CANCELAR</button>
                </div>
            </div>
        </div>

        <!-- ESTADO SEM CONCURSO -->
        <div id="estado-vazio-concurso" style="display:none; padding: 40px 20px; text-align:center;">
            <div style="font-size: 50px; color: #cbd5e1; margin-bottom: 20px;"><i class="fa-solid fa-folder-open"></i></div>
            <h2 style="color: #0f172a; font-weight: 900; margin-bottom: 10px;">Nenhum concurso vinculado</h2>
            <p style="color: #64748b; font-size: 14px; max-width: 300px; margin: 0 auto;">Seu perfil ainda não possui um concurso atribuído. Entre em contato com o suporte.</p>
        </div>

        <!-- VIEW 1: BOAS VINDAS -->
        <div id="view-boas-vindas" class="view-concurseiro" style="display: flex;">
            <div class="welcome-box">
                <div class="w-icon"><i class="fa-solid fa-graduation-cap"></i></div>
                <div class="w-title">Olá, ${primeiroNome}!</div>
                <div class="w-subtitle">Bons estudos hoje! Prepare-se para detonar nas questões.</div>
                <div id="cargo-atual-badge" style="display: none; background: rgba(255,255,255,0.05); padding: 10px 15px; border-radius: 12px; margin-bottom: 25px; font-size: 14px; font-weight: 700; color: #38bdf8; border: 1px solid rgba(56,189,248,0.2);"></div>
                <button class="btn-hc-primario" onclick="window.iniciarJornada()">INICIAR ESTUDOS <i class="fa-solid fa-arrow-right" style="margin-left: 8px;"></i></button>
            </div>
        </div>

        <!-- VIEW 2: MEU CONCURSO -->
        <div id="view-concurso" class="view-concurseiro">
            <button onclick="window.irParaView('view-boas-vindas')" style="background:none; border:none; color:#64748b; font-weight:700; margin-bottom:20px; cursor:pointer; font-size:14px;"><i class="fa-solid fa-arrow-left"></i> Voltar</button>
            <h2 style="color: #0f172a; font-weight: 900; margin-bottom: 5px;">Seu Concurso</h2>
            <p style="color: #64748b; font-size: 13px; margin-bottom: 25px;">Toque no card para selecionar seu cargo e ver as disciplinas.</p>
            
            <div class="card-concurso-select" onclick="window.verificarCargo()">
                <div class="cc-icon"><i class="fa-solid fa-building-columns"></i></div>
                <div class="cc-title" id="card-concurso-nome">Carregando...</div>
                <div class="cc-subtitle">Clique para acessar os cargos e questões</div>
            </div>
        </div>

        <!-- NOVA VIEW: CARGOS -->
        <div id="view-cargos" class="view-concurseiro">
            <button onclick="window.irParaView('view-concurso')" style="background:none; border:none; color:#64748b; font-weight:700; margin-bottom:20px; cursor:pointer; font-size:14px;"><i class="fa-solid fa-arrow-left"></i> Voltar</button>
            <h2 style="color: #0f172a; font-weight: 900; margin-bottom: 5px;">Selecione seu Cargo</h2>
            <p style="color: #ef4444; font-size: 13px; font-weight: bold; margin-bottom: 20px;">Atenção: A escolha do cargo é definitiva!</p>
            
            <div class="lista-disciplinas" id="lista-cargos"></div>
        </div>

        <!-- VIEW 3: DISCIPLINAS -->
        <div id="view-disciplinas" class="view-concurseiro">
            <button onclick="window.irParaView('view-concurso')" style="background:none; border:none; color:#64748b; font-weight:700; margin-bottom:20px; cursor:pointer; font-size:14px;"><i class="fa-solid fa-arrow-left"></i> Voltar</button>
            <h2 style="color: #0f172a; font-weight: 900; margin-bottom: 5px;">Disciplinas</h2>
            <p style="color: #64748b; font-size: 13px; margin-bottom: 20px;">Escolha a matéria que deseja praticar agora.</p>
            
            <div class="lista-disciplinas" id="lista-disciplinas"></div>
        </div>

        <!-- VIEW 4: RESOLUÇÃO -->
        <div id="view-questoes" class="view-concurseiro">
            <div id="loader-questoes" class="loader-q" style="display:none;">
                <div class="spinner-q"></div>
                <div style="color:#64748b; font-weight:700; font-size:12px;">Preparando questões...</div>
            </div>

            <div id="fim-disciplina" style="display:none; flex-direction:column; align-items:center; text-align:center; padding: 40px 10px;">
                <div style="font-size: 60px; color: #10b981; margin-bottom: 20px;"><i class="fa-solid fa-check-double"></i></div>
                <h2 style="color: #0f172a; font-weight: 900; margin-bottom: 10px;">Parabéns!</h2>
                <p style="color: #64748b; font-size: 14px; margin-bottom: 30px;">Você já resolveu todas as questões desta disciplina.</p>
                <button class="btn-hc-primario" onclick="window.irParaView('view-disciplinas')">ESCOLHER OUTRA DISCIPLINA</button>
            </div>

            <div id="area-resolucao" style="display:none;">
                <div class="q-header">
                    <button onclick="window.irParaView('view-disciplinas')" style="background:none; border:none; color:#64748b; font-weight:700; cursor:pointer; font-size:14px; margin-right: 15px;"><i class="fa-solid fa-arrow-left"></i></button>
                    <div class="q-tag-concurso" id="q-concurso-nome">PF 2026</div>
                    <div style="flex:1;"></div>
                    <div class="q-progresso-badge" id="q-progresso">1 / 100</div>
                </div>

                <div class="q-actions">
                    <div id="display-timer" style="display:none; align-items:center; background:#fff; border:1px solid #e2e8f0; padding:0 12px; border-radius:10px; color:#f59e0b; font-weight:800; font-size:14px; letter-spacing:1px; height:40px;">00:00</div>
                    <button id="btn-timer" class="btn-acao-q" onclick="window.toggleTimer()" title="Cronômetro" style="color:#64748b;"><i class="fa-solid fa-clock"></i></button>
                    <div style="width: 2px; background: #e2e8f0; margin: 0 4px;"></div>
                    <button class="btn-acao-q" onclick="window.abrirModalFiltroDisciplina()" title="Filtrar por Disciplina" style="color:#3b82f6;"><i class="fa-solid fa-shuffle"></i></button>
                    <button class="btn-acao-q" onclick="window.abrirModalFiltroAssunto()" title="Filtrar por Assunto" style="color:#8b5cf6;"><i class="fa-solid fa-filter"></i></button>
                    <button id="btn-mute-sound" class="btn-acao-q" onclick="window.toggleMute()" title="Mutar Som" style="color:#10b981;"><i class="fa-solid fa-volume-high"></i></button>
                </div>

                <div id="render-questao-aqui"></div>

                <div class="placar-stats">
                    <div class="stat-item">
                        <div class="stat-valor" id="stat-feitas">0</div>
                        <div class="stat-label">Resolvidas</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-valor stat-acerto-color" id="stat-acertos">0</div>
                        <div class="stat-label">Acertos</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-valor" id="stat-pct">0%</div>
                        <div class="stat-label">Aproveitamento</div>
                    </div>
                </div>

                <button class="btn-proxima-desk" onclick="window.avancarPosResposta()">PRÓXIMA QUESTÃO <i class="fa-solid fa-arrow-right"></i></button>
                <span class="instrucao-swipe">Deslize para a esquerda para avançar</span>
            </div>
        </div>

    </div>
    `;
});
