window.Router.register('concurseiros', async () => {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
  const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
  const { getFirestore, doc, deleteDoc, updateDoc, collection, addDoc, getDocs, serverTimestamp, query, orderBy, where } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

  const firebaseConfig = {
    apiKey: "AIzaSyCrz2G3qQXkq5CqTB64BCwnFw-dO9dNA14",
    authDomain: "concurseiros-24d24.firebaseapp.com",
    projectId: "concurseiros-24d24",
    storageBucket: "concurseiros-24d24.firebasestorage.app",
    messagingSenderId: "106430651443",
    appId: "1:106430651443:web:b2868a280325c703a9d746"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  let codigosPendentesCache = [];
  let codigosAtivosCache = [];

  // ALERTAS NATIVOS SUBSTITUÍDOS POR MODAIS MODERNOS
  window.showAlertConcurseiro = (titulo, mensagem, tipo = 'info') => {
      const modal = document.getElementById('modal-alert-concurseiro');
      document.getElementById('alert-title-concurseiro').innerText = titulo;
      document.getElementById('alert-msg-concurseiro').innerHTML = mensagem;
      document.getElementById('alert-icon-concurseiro').innerHTML = tipo === 'error' ? '<i class="fa-solid fa-circle-xmark" style="color:#ef4444; font-size:40px;"></i>' : '<i class="fa-solid fa-circle-check" style="color:#0f172a; font-size:40px;"></i>';
      modal.style.display = 'flex';
  };
  window.closeAlertConcurseiro = () => { document.getElementById('modal-alert-concurseiro').style.display = 'none'; };

  window.showConfirmConcurseiro = (titulo, mensagem, onConfirm) => {
      const modal = document.getElementById('modal-confirm-concurseiro');
      document.getElementById('confirm-title-concurseiro').innerText = titulo;
      document.getElementById('confirm-msg-concurseiro').innerText = mensagem;
      modal.style.display = 'flex';
      window.pendingConfirmActionConcurseiro = async () => { 
          await onConfirm(); 
          modal.style.display = 'none'; 
      };
  };

  window.mostrarToastSucessoConcurseiro = (mensagem) => {
      const toast = document.getElementById('toastConcurseirosCriado');
      toast.innerHTML = `<i class="fa-solid fa-circle-check" style="margin-right:8px; color:#ffffff;"></i> ${mensagem}`;
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
      setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(-20px)';
      }, 2000);
  };

  // NAVEGAÇÃO DE ABAS
  window.switchTabConcurseiros = (tabId) => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    
    const btnTab = document.getElementById('btn-' + tabId);
    const contentTab = document.getElementById('content-' + tabId);
    
    if (btnTab) btnTab.classList.add('tab-active');
    if (contentTab) contentTab.style.display = 'block';

    if(tabId === 'cadastro') {
        window.carregarSelectsConcurseiros();
    } else if(tabId === 'criados') {
        window.paginaAtualPendentes = 1;
        window.carregarListaPendentes();
    } else if(tabId === 'ativos') {
        window.paginaAtualAtivos = 1;
        window.carregarListaAtivos();
    }
  };

 // CARREGAR SELECTS (INFLUENCIADOR E CONCURSO)
  window.carregarSelectsConcurseiros = async () => {
    const selectInf = document.getElementById('influenciadorVinculado');
    const selectConc = document.getElementById('concursoVinculadoParaCodigo');
    if (!selectInf || !selectConc) return;
    
    selectInf.innerHTML = '<option value="" disabled selected>Carregando...</option>';
    selectConc.innerHTML = '<option value="" disabled selected>Carregando...</option>';
    
    try {
      const snapInf = await getDocs(query(collection(db, "influenciadores"), orderBy("nome", "asc")));
      const snapConc = await getDocs(query(collection(db, "concursos"), orderBy("titulo", "asc")));
      
      let htmlInf = '<option value="" disabled selected>Selecione o parceiro</option>';
      snapInf.forEach(d => { 
          const inf = d.data();
          htmlInf += `<option value="${d.id}" data-concurso="${inf.concursoId}">${inf.nome}</option>`; 
      });
      selectInf.innerHTML = htmlInf;

      let htmlConc = '<option value="" disabled selected>Selecione o concurso alvo</option>';
      snapConc.forEach(d => { 
          const c = d.data();
          htmlConc += `<option value="${d.id}">${c.titulo} (${c.ano})</option>`; 
      });
      selectConc.innerHTML = htmlConc;

      selectInf.addEventListener('change', function() {
          const selectedOption = this.options[this.selectedIndex];
          const concursoIdDoInfluenciador = selectedOption.getAttribute('data-concurso');
          if (concursoIdDoInfluenciador) {
              selectConc.value = concursoIdDoInfluenciador;
          }
      });

    } catch (e) {
      console.error(e);
      window.showAlertConcurseiro("Erro", "Erro ao carregar dados.", "error");
    }
  };

  // GERAR CÓDIGOS EM MASSA
  window.salvarCodigosNoFirebase = async (e) => {
    e.preventDefault();
    
    const selectInf = document.getElementById('influenciadorVinculado');
    const selectConc = document.getElementById('concursoVinculadoParaCodigo');
    const qtdStr = document.getElementById('quantidadeCodigos').value;
    const qtd = parseInt(qtdStr, 10);

    const nomeInf = selectInf.options[selectInf.selectedIndex]?.text || '';
    const nomeConc = selectConc.options[selectConc.selectedIndex]?.text || '';

    if (!selectInf.value || !selectConc.value || isNaN(qtd) || qtd < 1) {
      window.showAlertConcurseiro("Atenção", "Preencha todos os campos e insira uma quantidade válida.", "error");
      return;
    }

    const btnSalvar = document.getElementById('btnGerarCodigos');
    const textoOriginal = btnSalvar.innerHTML;
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';

    try {
      const userAtual = auth.currentUser;
      const caracteresValidos = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      
      const promessas = [];
      
      for(let i=0; i<qtd; i++) {
          let codigoAleatorio = 'ALU-';
          for (let j = 0; j < 6; j++) {
            codigoAleatorio += caracteresValidos.charAt(Math.floor(Math.random() * caracteresValidos.length));
          }

          promessas.push(addDoc(collection(db, "codigos_acesso"), {
            codigo: codigoAleatorio,
            influenciadorId: selectInf.value,
            influenciadorNome: nomeInf,
            concursoId: selectConc.value,
            concursoNome: nomeConc,
            status: 'pendente', // pendente, ativo
            criadoPor: userAtual.uid,
            dataCriacao: serverTimestamp()
          }));
      }

      await Promise.all(promessas);
      
      window.mostrarToastSucessoConcurseiro(`${qtd} códigos gerados com sucesso!`);
      e.target.reset();
      window.switchTabConcurseiros('criados');
    } catch (err) {
      console.error(err);
      window.showAlertConcurseiro("Erro", "Erro ao gerar os códigos.", "error");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = textoOriginal;
    }
  };

  // CARREGAR PENDENTES
  window.carregarListaPendentes = async () => {
    const container = document.getElementById('lista-pendentes-unificada');
    if(!container) return;
    
    try {
      const q = query(collection(db, "codigos_acesso"), where("status", "==", "pendente"));
      const snap = await getDocs(q);
      
      codigosPendentesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      codigosPendentesCache.sort((a, b) => (b.dataCriacao?.seconds || 0) - (a.dataCriacao?.seconds || 0));

      if (codigosPendentesCache.length === 0) { 
        document.getElementById('lista-pendentes-unificada').innerHTML = `
            <div style="text-align:center; padding:40px; background:#fff; border-radius:12px; border:1px dashed #cbd5e1; color:#64748b; font-weight:600;">
                Nenhum código pendente encontrado.
            </div>`; 
        return; 
      }

      if (window.paginaAtualPendentes === undefined) window.paginaAtualPendentes = 1;
      
      const itensPorPagina = 10;
      const totalPaginas = Math.ceil(codigosPendentesCache.length / itensPorPagina);
      const inicio = (window.paginaAtualPendentes - 1) * itensPorPagina;
      const itensPagina = codigosPendentesCache.slice(inicio, inicio + itensPorPagina);

      document.getElementById('lista-pendentes-unificada').innerHTML = `<div class="lista-turmas-vertical" id="grid-pendentes-dinamico"></div><div id="paginacao-pendentes"></div>`;
      const grid = document.getElementById('grid-pendentes-dinamico');

      for (const inf of itensPagina) {
        const card = document.createElement('div');
        card.className = "card-premium-list";
        card.style.cssText = "margin-bottom:10.5px; padding:0 15px; border-left:4px solid #0f172a; background:#fff; border-radius:8px; display:flex; align-items:center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); height: 45px; box-sizing: border-box;";
        card.innerHTML = `
          <div style="flex: 1; display: flex; align-items: center; overflow: hidden; gap: 10px;">
            <div style="width: 28px; height: 28px; background: #0f172a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; font-size: 12px;">
                <i class="fa-solid fa-ticket"></i>
            </div>
            <span style="font-weight: 800; color: #0f172a; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase;" title="${inf.influenciadorNome}">${inf.influenciadorNome}</span>
          </div>
          <div style="flex: 2; display: flex; justify-content: center; align-items: center; overflow: hidden; padding: 0 10px; flex-direction:column;">
            <h3 style="margin:0; color:#0f172a; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align: center; font-weight: 800; text-transform: uppercase;">${inf.concursoNome}</h3>
          </div>
          <div style="flex: 1.5; display: flex; justify-content: flex-end; align-items: center; gap: 12px;">
            <code onclick="window.copiarCodigoDireto('${inf.codigo}')" title="Clique para copiar" style="cursor: pointer; padding: 4px 10px; border-radius: 6px; background: #f1f5f9; color: #0f172a; font-weight: 800; font-size: 11px; display: inline-flex; align-items: center; transition: 0.2s;">
               <i class="fa-solid fa-copy" style="margin-right: 4px;"></i> ${inf.codigo}
            </code>
            <div style="display: flex; gap: 5px;">
              <button id="btn-excluir-pendente-${inf.id}" style="background:#fee2e2; color:#ef4444; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; height:30px;" title="Excluir">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>`;
        grid.appendChild(card);

        document.getElementById(`btn-excluir-pendente-${inf.id}`).onclick = (e) => window.excluirCodigo(inf.id, inf.codigo, 'pendente', e);
      }

      if (totalPaginas > 1) {
        let htmlPaginacao = `<div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:20px; margin-bottom:20px;">
          <button onclick="if(window.paginaAtualPendentes > 1) { window.paginaAtualPendentes--; window.carregarListaPendentes(); }" 
            style="width:40px; height:40px; border-radius:10px; border:1px solid #e2e8f0; background:white; cursor:pointer; display:flex; align-items:center; justify-content:center;">
            <i class="fa-solid fa-chevron-left" style="color:#64748b;"></i>
          </button>`;
        
        for (let i = 1; i <= totalPaginas; i++) {
          const ativa = i === window.paginaAtualPendentes;
          htmlPaginacao += `<button onclick="window.paginaAtualPendentes=${i}; window.carregarListaPendentes();" style="width:40px; height:40px; border-radius:10px; border:1px solid ${ativa ? '#0f172a' : '#e2e8f0'}; background:${ativa ? '#0f172a' : 'white'}; color:${ativa ? 'white' : '#64748b'}; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .2s;">${i}</button>`;
        }

        htmlPaginacao += `<button onclick="if(window.paginaAtualPendentes < ${totalPaginas}) { window.paginaAtualPendentes++; window.carregarListaPendentes(); }" 
          style="width:40px; height:40px; border-radius:10px; border:1px solid #e2e8f0; background:white; cursor:pointer; display:flex; align-items:center; justify-content:center;">
          <i class="fa-solid fa-chevron-right" style="color:#64748b;"></i>
        </button></div>`;
        document.getElementById('paginacao-pendentes').innerHTML = htmlPaginacao;
      }
    } catch (e) { 
      console.error(e);
      document.getElementById('lista-pendentes-unificada').innerHTML = "<p style='padding:10px; color:red;'>Erro ao carregar a lista.</p>"; 
    }
  };

  // CARREGAR ATIVOS
  window.carregarListaAtivos = async () => {
    const container = document.getElementById('lista-ativos-unificada');
    if(!container) return;
    
    try {
      const q = query(collection(db, "codigos_acesso"), where("status", "==", "ativo"));
      const snap = await getDocs(q);
      
      codigosAtivosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      codigosAtivosCache.sort((a, b) => (b.dataUso?.seconds || 0) - (a.dataUso?.seconds || 0));

      if (codigosAtivosCache.length === 0) { 
        document.getElementById('lista-ativos-unificada').innerHTML = `
            <div style="text-align:center; padding:40px; background:#fff; border-radius:12px; border:1px dashed #cbd5e1; color:#64748b; font-weight:600;">
                Nenhum concurseiro ativo encontrado.
            </div>`; 
        return; 
      }

      if (window.paginaAtualAtivos === undefined) window.paginaAtualAtivos = 1;
      
      const itensPorPagina = 10;
      const totalPaginas = Math.ceil(codigosAtivosCache.length / itensPorPagina);
      const inicio = (window.paginaAtualAtivos - 1) * itensPorPagina;
      const itensPagina = codigosAtivosCache.slice(inicio, inicio + itensPorPagina);

      document.getElementById('lista-ativos-unificada').innerHTML = `<div class="lista-turmas-vertical" id="grid-ativos-dinamico"></div><div id="paginacao-ativos"></div>`;
      const grid = document.getElementById('grid-ativos-dinamico');

      for (const inf of itensPagina) {
        const card = document.createElement('div');
        card.className = "card-premium-list";
        card.style.cssText = "margin-bottom:10.5px; padding:0 15px; border-left:4px solid #10b981; background:#fff; border-radius:8px; display:flex; align-items:center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); height: 45px; box-sizing: border-box;";
        
        card.innerHTML = `
          <div style="flex: 1.5; display: flex; align-items: center; overflow: hidden; gap: 10px;">
            <div style="width: 28px; height: 28px; background: #10b981; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; font-size: 12px;">
                <i class="fa-solid fa-user"></i>
            </div>
            <div style="display:flex; flex-direction:column; line-height:1.2;">
                <span style="font-weight: 900; color: #0f172a; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase;">${inf.alunoNome || 'Sem Nome'}</span>
                <span style="font-weight: 700; color: #64748b; font-size: 10px; text-transform: uppercase;">VIA: ${inf.influenciadorNome}</span>
            </div>
          </div>
          <div style="flex: 2; display: flex; justify-content: center; align-items: center; overflow: hidden; padding: 0 10px; flex-direction:column;">
            <h3 style="margin:0; color:#0f172a; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align: center; font-weight: 800; text-transform: uppercase;">${inf.concursoNome}</h3>
          </div>
          <div style="flex: 1.5; display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
            <code style="padding: 4px 10px; border-radius: 6px; background: #f1f5f9; color: #0f172a; font-weight: 800; font-size: 11px; display: inline-flex; align-items: center;">
               ${inf.codigo}
            </code>
            <button id="btn-desvincular-${inf.id}" style="background:#e0f2fe; color:#0369a1; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; height:30px; font-weight:800; font-size:10px;" title="Resetar Bloqueio de Aparelho">
              RESETAR APARELHO
            </button>
            <button id="btn-excluir-ativo-${inf.id}" style="background:#fee2e2; color:#ef4444; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; height:30px;" title="Excluir Definitivamente">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>`;
        grid.appendChild(card);

        document.getElementById(`btn-desvincular-${inf.id}`).onclick = (e) => window.resetarAparelho(inf.alunoId, inf.alunoNome, e);
        document.getElementById(`btn-excluir-ativo-${inf.id}`).onclick = (e) => window.excluirCodigo(inf.id, inf.codigo, 'ativo', e);
      }

      if (totalPaginas > 1) {
        let htmlPaginacao = `<div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:20px; margin-bottom:20px;">
          <button onclick="if(window.paginaAtualAtivos > 1) { window.paginaAtualAtivos--; window.carregarListaAtivos(); }" 
            style="width:40px; height:40px; border-radius:10px; border:1px solid #e2e8f0; background:white; cursor:pointer; display:flex; align-items:center; justify-content:center;">
            <i class="fa-solid fa-chevron-left" style="color:#64748b;"></i>
          </button>`;
        
        for (let i = 1; i <= totalPaginas; i++) {
          const ativa = i === window.paginaAtualAtivos;
          htmlPaginacao += `<button onclick="window.paginaAtualAtivos=${i}; window.carregarListaAtivos();" style="width:40px; height:40px; border-radius:10px; border:1px solid ${ativa ? '#0f172a' : '#e2e8f0'}; background:${ativa ? '#0f172a' : 'white'}; color:${ativa ? 'white' : '#64748b'}; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .2s;">${i}</button>`;
        }

        htmlPaginacao += `<button onclick="if(window.paginaAtualAtivos < ${totalPaginas}) { window.paginaAtualAtivos++; window.carregarListaAtivos(); }" 
          style="width:40px; height:40px; border-radius:10px; border:1px solid #e2e8f0; background:white; cursor:pointer; display:flex; align-items:center; justify-content:center;">
          <i class="fa-solid fa-chevron-right" style="color:#64748b;"></i>
        </button></div>`;
        document.getElementById('paginacao-ativos').innerHTML = htmlPaginacao;
      }
    } catch (e) { 
      console.error(e);
      document.getElementById('lista-ativos-unificada').innerHTML = "<p style='padding:10px; color:red;'>Erro ao carregar a lista.</p>"; 
    }
  };

  // RESET DE APARELHO
  window.resetarAparelho = async (alunoId, alunoNome, event) => {
    if (event) event.stopPropagation();
    
    window.showConfirmConcurseiro("Resetar Aparelho?", `Isto vai permitir que o aluno ${alunoNome} faça login num dispositivo novo. Continuar?`, async () => {
        try {
            await updateDoc(doc(db, "usuarios", alunoId), { sessaoAtiva: "" });
            window.mostrarToastSucessoConcurseiro("Aparelho resetado com sucesso!");
        } catch (e) { 
            console.error("Erro ao resetar:", e);
            window.showAlertConcurseiro("Erro", "Erro ao resetar aparelho.", "error");
        }
    });
  };

  // EXCLUSÃO DE CÓDIGO
  window.excluirCodigo = async (idDocumento, codigo, tipo, event) => {
    if (event) event.stopPropagation();
    
    window.showConfirmConcurseiro("Excluir Código?", `Tem a certeza que deseja excluir o código ${codigo}? Isso revoga o acesso gerado.`, async () => {
        try {
            await deleteDoc(doc(db, "codigos_acesso", idDocumento));
            window.mostrarToastSucessoConcurseiro("Código excluído!");
            if(tipo === 'pendente') window.carregarListaPendentes();
            else window.carregarListaAtivos();
        } catch (e) { 
            console.error("Erro ao excluir:", e);
            window.showAlertConcurseiro("Erro", "Erro ao excluir o código.", "error");
        }
    });
  };

  // UTILITÁRIO DE CÓPIA
  window.copiarCodigoDireto = (codigo) => {
    navigator.clipboard.writeText(codigo).then(() => {
      window.mostrarToastSucessoConcurseiro(`Código ${codigo} copiado!`);
    }).catch(err => {
      console.error('Erro ao copiar: ', err);
    });
  };

  setTimeout(() => { window.switchTabConcurseiros('cadastro'); }, 100);

  return `
    <style>
      .header-master { margin-top: 0px; margin-bottom: 10px; }
      .header-master h1 { font-size: 1.8rem; margin-bottom: 2px; color: #0f172a; text-transform: uppercase; font-weight: 900;}
      .header-master p { font-size: 0.85rem; color: #64748b; }
      
      .tabs-nav { display: flex; gap: 30px; border-bottom: 1px solid #e2e8f0; padding-left: 10px; margin-top: 12px; }
      .tab-btn { padding: 12px 0px; border: none; background: none; cursor: pointer; font-weight: 700; color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; position: relative; transition: color 0.2s;}
      .tab-active { color: #0f172a !important; }
      .tab-active::after { content: ""; position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background-color: #0f172a; }
      
      .form-grid-concurseiros { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
      .form-group { display: flex; flex-direction: column; margin-bottom: 8px; }
      .form-group.full { grid-column: span 2; }
      .form-group label { font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 4px; text-transform: uppercase; }
      .form-group input, .form-group select { padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; width: 100%; box-sizing: border-box; background: #f8fafc; outline: none; }
      .form-group input:focus, .form-group select:focus { border-color: #0f172a; background: #ffffff; }
      
      .card { padding: 25px !important; margin-bottom: 0 !important; background: white; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); }
      
      @media (max-width: 768px) {
        .form-grid-concurseiros { grid-template-columns: 1fr; }
        .form-group.full { grid-column: span 1; }
        .tabs-nav { gap: 15px; flex-wrap: wrap; }
        .tab-btn { font-size: 0.75rem; }
      }

      .modal-concurseiro { position:fixed; inset:0; background:rgba(15, 23, 42, 0.6); backdrop-filter:blur(4px); display:none; justify-content:center; align-items:center; z-index:9999; padding:20px; }
      .modal-concurseiro-content { background:#fff; width:100%; max-width:400px; border-radius:20px; padding:25px; text-align:center; }
      .btn-publish-concurseiro { background:#0f172a; color:#fff; border:none; padding:14px; width:100%; border-radius:10px; font-weight:800; font-size: 14px; cursor:pointer; margin-top:20px; transition: 0.2s;}
    </style>

    <!-- Modais Customizados -->
    <div id="modal-alert-concurseiro" class="modal-concurseiro"><div class="modal-concurseiro-content"><div id="alert-icon-concurseiro" style="margin-bottom:10px;"></div><h3 id="alert-title-concurseiro" style="color:#0f172a; margin-top:0;"></h3><div id="alert-msg-concurseiro" style="color:#64748b; margin-bottom:20px;"></div><button class="btn-publish-concurseiro" onclick="window.closeAlertConcurseiro()" style="margin-top:0;">OK</button></div></div>
    
    <div id="modal-confirm-concurseiro" class="modal-concurseiro"><div class="modal-concurseiro-content"><h3 id="confirm-title-concurseiro" style="color:#ef4444; margin-top:0;"></h3><p id="confirm-msg-concurseiro" style="color:#64748b; margin-bottom:20px;"></p><div style="display:flex; gap:10px;"><button class="btn-publish-concurseiro" style="background:#ef4444; margin-top:0;" onclick="window.pendingConfirmActionConcurseiro()">SIM</button><button class="btn-publish-concurseiro" style="background:#f1f5f9; color:#64748b; margin-top:0;" onclick="this.closest('.modal-concurseiro').style.display='none'">NÃO</button></div></div></div>

    <div style="padding: 20px;">
        <div class="header-master">
          <h1>Concurseiros</h1>
          <p>Gere e gerencie acessos de alunos (concurseiros) via parceiros.</p>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; margin-bottom:20px; flex-wrap: wrap; gap: 10px;">
            <div style="display:flex; gap:15px; overflow-x:auto;">
                <button id="btn-cadastro" class="tab-btn tab-active" onclick="window.switchTabConcurseiros('cadastro')">CRIAR CONCURSEIROS</button>
                <button id="btn-criados" class="tab-btn" onclick="window.switchTabConcurseiros('criados')">CÓDIGOS GERADOS</button>
                <button id="btn-ativos" class="tab-btn" onclick="window.switchTabConcurseiros('ativos')">CONCURSEIROS ATIVOS</button>
            </div>
        </div>

        <div id="content-cadastro" class="tab-content" style="margin-top: 25px;">
          <div class="card">
           <form onsubmit="window.salvarCodigosNoFirebase(event)" autocomplete="off" role="presentation">
              <div class="form-grid-concurseiros">
                
                <div class="form-group">
                  <label>Influenciador / Parceiro Origem:</label>
                  <select id="influenciadorVinculado" required>
                    <option value="" disabled selected>Carregando...</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label>Vincular ao Concurso:</label>
                  <select id="concursoVinculadoParaCodigo" required>
                    <option value="" disabled selected>Carregando...</option>
                  </select>
                </div>

                <div class="form-group full">
                  <label>Quantidade de códigos a gerar:</label>
                  <input type="number" id="quantidadeCodigos" placeholder="Ex: 10" min="1" max="100" required>
                </div>
              </div>
              <small style="color: #64748b; font-size: 0.75rem; display: block; margin-top: 10px;">Estes códigos serão enviados aos concurseiros para efetivarem o seu registro com trava de segurança de aparelho.</small>
              <button type="submit" id="btnGerarCodigos" class="btn-padrao" style="background:#0f172a; color:white; width:100%; margin-top:20px; padding:14px; cursor:pointer; border:none; border-radius:10px; font-weight:800; font-size:1rem;">Gerar Códigos de Acesso</button>
            </form>
          </div>
        </div>

        <div id="content-criados" class="tab-content" style="display:none; margin-top: 25px;">
          <div id="lista-pendentes-unificada"><div style="text-align:center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:30px; color:#0f172a;"></i></div></div>
        </div>

        <div id="content-ativos" class="tab-content" style="display:none; margin-top: 25px;">
          <div id="lista-ativos-unificada"><div style="text-align:center; padding: 40px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:30px; color:#0f172a;"></i></div></div>
        </div>
        
        <div id="toastConcurseirosCriado" style="position:fixed; top:25px; right:25px; background:#10b981; color:white; padding:14px 22px; border-radius:14px; font-weight:800; font-size:0.9rem; box-shadow:0 10px 20px rgba(0,0,0,0.15); opacity:0; transform:translateY(-20px); transition:transform 0.3s ease-out, opacity 0.3s; z-index:99999; pointer-events:none;">
          <i class="fa-solid fa-circle-check" style="margin-right:8px; color:#ffffff;"></i> Sucesso!
        </div>
    </div>
  `;
});