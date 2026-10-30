window.Router.register('influencer', async () => {
  // IMPORTAÇÕES
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
  const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
  const { getFirestore, doc, deleteDoc, updateDoc, collection, addDoc, getDocs, serverTimestamp, query, orderBy } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

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

  let influencersCache = [];
  let idEditandoInfluencer = null;

  // ALERTAS NATIVOS SUBSTITUÍDOS POR MODAIS MODERNOS
  window.showAlertInf = (titulo, mensagem, tipo = 'info') => {
      const modal = document.getElementById('modal-alert-inf');
      document.getElementById('alert-title-inf').innerText = titulo;
      document.getElementById('alert-msg-inf').innerHTML = mensagem;
      document.getElementById('alert-icon-inf').innerHTML = tipo === 'error' ? '<i class="fa-solid fa-circle-xmark" style="color:#ef4444; font-size:40px;"></i>' : '<i class="fa-solid fa-circle-check" style="color:#0f172a; font-size:40px;"></i>';
      modal.style.display = 'flex';
  };
  window.closeAlertInf = () => { document.getElementById('modal-alert-inf').style.display = 'none'; };

  window.showConfirmInf = (titulo, mensagem, onConfirm) => {
      const modal = document.getElementById('modal-confirm-inf');
      document.getElementById('confirm-title-inf').innerText = titulo;
      document.getElementById('confirm-msg-inf').innerText = mensagem;
      modal.style.display = 'flex';
      window.pendingConfirmActionInf = async () => { 
          await onConfirm(); 
          modal.style.display = 'none'; 
      };
  };

  window.mostrarToastSucessoInf = (mensagem) => {
      const toast = document.getElementById('toastInfluencerCriado');
      toast.innerHTML = `<i class="fa-solid fa-circle-check" style="margin-right:8px; color:#ffffff;"></i> ${mensagem}`;
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
      setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(-20px)';
      }, 2000);
  };

  // 1. NAVEGAÇÃO DE ABAS
  window.switchTabInfluencer = (tabId, resetEdit = false) => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    
    const btnTab = document.getElementById('btn-' + tabId);
    const contentTab = document.getElementById('content-' + tabId);
    
    if (btnTab) btnTab.classList.add('tab-active');
    if (contentTab) contentTab.style.display = 'block';

    const containerFiltro = document.getElementById('container-filtro-inf');
    
    if(tabId === 'lista') {
        if(containerFiltro) containerFiltro.style.display = 'flex';
        window.paginaAtualInfluencers = 1;
        window.carregarListaInfluencers();
    } else if (tabId === 'cadastro') {
        if(containerFiltro) containerFiltro.style.display = 'none';
        
        // Só reseta se vier do clique direto na aba (não do botão de editar)
        if (resetEdit) {
            idEditandoInfluencer = null;
            document.getElementById('btnSalvarInfluencer').innerText = 'Criar Parceiro';
            const form = document.querySelector('form');
            if (form) form.reset();
        }
        window.carregarConcursosSelect();
    }
  };

  // 2. CARREGAR CONCURSOS PARA O SELECT
  window.carregarConcursosSelect = async () => {
    const select = document.getElementById('concursoVinculado');
    if (!select) return;
    
    select.innerHTML = '<option value="" disabled selected>A carregar concursos...</option>';
    
    try {
      const q = query(collection(db, "concursos"), orderBy("titulo", "asc"));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        select.innerHTML = '<option value="" disabled selected>Nenhum concurso criado ainda. Crie um primeiro.</option>';
        return;
      }

      let optionsHtml = '<option value="" disabled selected>Selecione o concurso alvo</option>';
      snap.forEach(doc => {
        const c = doc.data();
        optionsHtml += `<option value="${doc.id}">${c.titulo} (${c.ano})</option>`;
      });
      
      select.innerHTML = optionsHtml;
    } catch (e) {
      console.error("Erro ao carregar concursos:", e);
      select.innerHTML = '<option value="" disabled selected>Erro ao carregar concursos</option>';
    }
  };

  // 3. GERAÇÃO DE CÓDIGO
  window.gerarCodigoInfluencer = () => {
    const input = document.getElementById('codigoInfluencer');
    const btn = document.querySelector('.btn-gen-key');
    const caracteresValidos = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let pass = 'INF-'; 
    for (let i = 0; i < 6; i++) {
      pass += caracteresValidos.charAt(Math.floor(Math.random() * caracteresValidos.length));
    }
    input.value = pass;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-lock"></i>';
  };

  // 4. SALVAR / EDITAR INFLUENCIADOR NO FIREBASE
  window.salvarInfluencerNoFirebase = async (e) => {
    e.preventDefault();
    
    const selectConcurso = document.getElementById('concursoVinculado');
    const nomeConcursoSelecionado = selectConcurso.options[selectConcurso.selectedIndex]?.text || '';

    const campos = {
      nome: document.getElementById('nomeInfluencer').value.trim(),
      concursoId: selectConcurso.value,
      concursoNome: nomeConcursoSelecionado,
      codigo: document.getElementById('codigoInfluencer').value.trim()
    };

    if (!campos.nome || !campos.concursoId || !campos.codigo || campos.codigo.includes("Gere o código")) {
      window.showAlertInf("Atenção", "Preencha todos os campos e gere o código do influenciador!", "error");
      return;
    }

    const btnSalvar = document.getElementById('btnSalvarInfluencer');
    const textoOriginal = btnSalvar.innerHTML;
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar...';

    try {
      const userAtual = auth.currentUser;

      const dadosParaSalvar = {
        nome: campos.nome,
        concursoId: campos.concursoId,
        concursoNome: campos.concursoNome,
        codigo: campos.codigo,
        dataCriacao: serverTimestamp(),
        criadoPor: userAtual.uid
      };

      if (idEditandoInfluencer) {
          await updateDoc(doc(db, "influenciadores", idEditandoInfluencer), dadosParaSalvar);
          window.mostrarToastSucessoInf("Influenciador atualizado com sucesso!");
          idEditandoInfluencer = null;
      } else {
          await addDoc(collection(db, "influenciadores"), dadosParaSalvar);
          window.mostrarToastSucessoInf("Influenciador criado com sucesso!");
      }
      
      e.target.reset();
      document.querySelector('.btn-gen-key').disabled = false;
      document.querySelector('.btn-gen-key').innerHTML = '<i class="fa-solid fa-key"></i>';
      window.switchTabInfluencer('lista');
    } catch (err) {
      console.error(err);
      window.showAlertInf("Erro", "Erro ao guardar influenciador.", "error");
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = textoOriginal;
    }
  };

  // 5. CARREGAR LISTA DE INFLUENCIADORES
  window.carregarListaInfluencers = async () => {
    const container = document.getElementById('lista-influencers-unificada');
    
    container.innerHTML = `
      <div class="lista-turmas-vertical">
        ${Array(3).fill(0).map(() => `
          <div class="card-premium-list" style="margin-bottom:10.5px; padding:0 15px; border-left:4px solid #e2e8f0; background:#fff; border-radius:8px; display:flex; align-items:center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); height: 45px; box-sizing: border-box;">
            <div style="flex:1; height: 15px; background: #f1f5f9; border-radius: 4px; animation: pulse 1.5s infinite ease-in-out;"></div>
          </div>
        `).join('')}
      </div>
    `;

    try {
      const q = query(collection(db, "influenciadores"), orderBy("dataCriacao", "desc"));
      const snap = await getDocs(q);
      
      let todosInfluencers = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const filtroSelect = document.getElementById('filtro-concurso-inf');
      if (filtroSelect) {
          const concursosUnicos = [...new Set(todosInfluencers.map(item => item.concursoNome))].filter(Boolean).sort();
          const valorAtual = filtroSelect.value;
          filtroSelect.innerHTML = '<option value="todos">TODOS OS CONCURSOS</option>';
          concursosUnicos.forEach(c => {
              const opt = document.createElement('option');
              opt.value = c;
              opt.innerText = c.toUpperCase();
              if (c === valorAtual) opt.selected = true;
              filtroSelect.appendChild(opt);
          });
      }

      const valorFiltro = filtroSelect ? filtroSelect.value : 'todos';
      influencersCache = valorFiltro === 'todos' ? todosInfluencers : todosInfluencers.filter(item => item.concursoNome === valorFiltro);

      if (influencersCache.length === 0) { 
        container.innerHTML = `
            <div style="text-align:center; padding:40px; background:#fff; border-radius:12px; border:1px dashed #cbd5e1; color:#64748b; font-weight:600;">
                Nenhum influenciador encontrado.
            </div>`; 
        return; 
      }

      if (window.paginaAtualInfluencers === undefined) window.paginaAtualInfluencers = 1;
      
      const itensPorPagina = 8;
      const totalPaginas = Math.ceil(influencersCache.length / itensPorPagina);
      const inicio = (window.paginaAtualInfluencers - 1) * itensPorPagina;
      const itensPagina = influencersCache.slice(inicio, inicio + itensPorPagina);

      container.innerHTML = `<div class="lista-turmas-vertical" id="grid-influencers-dinamico"></div><div id="paginacao-influencers"></div>`;
      const grid = document.getElementById('grid-influencers-dinamico');

      for (const inf of itensPagina) {
        const card = document.createElement('div');
        card.className = "card-premium-list";
        card.style.cssText = "margin-bottom:10.5px; padding:0 15px; border-left:4px solid #0f172a; background:#fff; border-radius:8px; display:flex; align-items:center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); height: 45px; box-sizing: border-box;";
        card.innerHTML = `
          <div style="flex: 1; display: flex; align-items: center; overflow: hidden; gap: 10px;">
            <div style="width: 28px; height: 28px; background: #0f172a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; font-size: 12px;">
                ${inf.nome.charAt(0).toUpperCase()}
            </div>
            <span style="font-weight: 800; color: #0f172a; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase;" title="${inf.nome}">${inf.nome}</span>
          </div>
          <div style="flex: 1; display: flex; justify-content: flex-end; align-items: center; gap: 12px;">
            <code onclick="window.copiarCodigoDireto('${inf.codigo}')" title="Clique para copiar" style="cursor: pointer; padding: 4px 10px; border-radius: 6px; background: #f1f5f9; color: #0f172a; font-weight: 800; font-size: 11px; display: inline-flex; align-items: center; transition: 0.2s;">
               <i class="fa-solid fa-copy" style="margin-right: 4px;"></i> ${inf.codigo}
            </code>
            <div style="display: flex; gap: 5px;">
              <button id="btn-editar-inf-${inf.id}" style="background:#f1f5f9; color:#0f172a; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; height:30px;" title="Editar">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button id="btn-excluir-inf-${inf.id}" style="background:#fee2e2; color:#ef4444; border:none; border-radius:6px; padding:6px 10px; cursor:pointer; height:30px;" title="Excluir">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>`;
        grid.appendChild(card);

        document.getElementById(`btn-editar-inf-${inf.id}`).onclick = () => window.prepararEdicaoInfluencer(inf.id);
        document.getElementById(`btn-excluir-inf-${inf.id}`).onclick = (e) => window.excluirInfluencer(inf.id, inf.nome, e);
      }

      // Paginação
      if (totalPaginas > 1) {
        let htmlPaginacao = `<div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:20px; margin-bottom:20px;">
          <button onclick="if(window.paginaAtualInfluencers > 1) { window.paginaAtualInfluencers--; window.carregarListaInfluencers(); }" 
            style="width:40px; height:40px; border-radius:10px; border:1px solid #e2e8f0; background:white; cursor:${window.paginaAtualInfluencers === 1 ? 'not-allowed' : 'pointer'}; opacity:${window.paginaAtualInfluencers === 1 ? '0.5' : '1'}; display:flex; align-items:center; justify-content:center;">
            <i class="fa-solid fa-chevron-left" style="color:#64748b;"></i>
          </button>`;
        
        for (let i = 1; i <= totalPaginas; i++) {
          const ativa = i === window.paginaAtualInfluencers;
          htmlPaginacao += `<button onclick="window.paginaAtualInfluencers=${i}; window.carregarListaInfluencers();" style="width:40px; height:40px; border-radius:10px; border:1px solid ${ativa ? '#0f172a' : '#e2e8f0'}; background:${ativa ? '#0f172a' : 'white'}; color:${ativa ? 'white' : '#64748b'}; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .2s;">${i}</button>`;
        }

        htmlPaginacao += `<button onclick="if(window.paginaAtualInfluencers < ${totalPaginas}) { window.paginaAtualInfluencers++; window.carregarListaInfluencers(); }" 
          style="width:40px; height:40px; border-radius:10px; border:1px solid #e2e8f0; background:white; cursor:${window.paginaAtualInfluencers === totalPaginas ? 'not-allowed' : 'pointer'}; opacity:${window.paginaAtualInfluencers === totalPaginas ? '0.5' : '1'}; display:flex; align-items:center; justify-content:center;">
          <i class="fa-solid fa-chevron-right" style="color:#64748b;"></i>
        </button></div>`;
        document.getElementById('paginacao-influencers').innerHTML = htmlPaginacao;
      }
    } catch (e) { 
      console.error("Erro ao carregar influenciadores:", e);
      container.innerHTML = "<p style='padding:10px; color:red;'>Erro ao carregar a lista.</p>"; 
    }
  };

  window.prepararEdicaoInfluencer = async (id) => {
      const item = influencersCache.find(inf => inf.id === id);
      if(!item) return;
      
      idEditandoInfluencer = id;
      window.switchTabInfluencer('cadastro', false); // false para não resetar o id

      document.getElementById('nomeInfluencer').value = item.nome;
      document.getElementById('codigoInfluencer').value = item.codigo;
      
      await window.carregarConcursosSelect();
      setTimeout(() => {
          const sel = document.getElementById('concursoVinculado');
          if(sel) sel.value = item.concursoId;
      }, 100);

      document.getElementById('btnSalvarInfluencer').innerText = 'Atualizar Parceiro';
  };

  // 6. EXCLUSÃO
  window.excluirInfluencer = async (idDocumento, nome, event) => {
    if (event) event.stopPropagation();
    
    window.showConfirmInf("Excluir Influenciador?", `Tem a certeza que deseja excluir o parceiro ${nome}? Os códigos associados deixarão de ser listados.`, async () => {
        try {
            const refDoc = doc(db, "influenciadores", idDocumento);
            await deleteDoc(refDoc);
            window.mostrarToastSucessoInf("Influenciador excluído!");
            window.carregarListaInfluencers();
        } catch (e) { 
            console.error("Erro ao excluir:", e);
            window.showAlertInf("Erro", "Erro ao excluir o influenciador.", "error");
        }
    });
  };

  // 7. UTILITÁRIOS
  window.copiarCodigoDireto = (codigo) => {
    navigator.clipboard.writeText(codigo).then(() => {
      window.mostrarToastSucessoInf(`Código ${codigo} copiado!`);
    }).catch(err => {
      console.error('Erro ao copiar: ', err);
    });
  };

  // Inicializa na aba de cadastro e já tenta carregar os concursos
  setTimeout(() => { window.switchTabInfluencer('cadastro', true); }, 100);

  return `
    <style>
      .header-master { margin-top: 0px; margin-bottom: 10px; }
      .header-master h1 { font-size: 1.8rem; margin-bottom: 2px; color: #0f172a; text-transform: uppercase; font-weight: 900;}
      .header-master p { font-size: 0.85rem; color: #64748b; }
      
      .tabs-nav { display: flex; gap: 30px; border-bottom: 1px solid #e2e8f0; padding-left: 10px; margin-top: 12px; }
      .tab-btn { padding: 12px 0px; border: none; background: none; cursor: pointer; font-weight: 700; color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; position: relative; transition: color 0.2s;}
      .tab-active { color: #0f172a !important; }
      .tab-active::after { content: ""; position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background-color: #0f172a; }
      
      .form-grid-inf { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
      .form-group { display: flex; flex-direction: column; margin-bottom: 8px; }
      .form-group.full { grid-column: span 2; }
      .form-group label { font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 4px; text-transform: uppercase; }
      .form-group input, .form-group select { padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; width: 100%; box-sizing: border-box; background: #f8fafc; outline: none; }
      .form-group input:focus, .form-group select:focus { border-color: #0f172a; background: #ffffff; }
      
      .pass-wrapper { position: relative; width: 100%; display: flex; align-items: center; }
      .btn-gen-key { position: absolute; right: 4px; background: #0f172a; color: white; border: none; width: 34px; height: 34px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
      .btn-gen-key:hover { background: #38bdf8; }
      
      .card { padding: 25px !important; margin-bottom: 0 !important; background: white; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); }
      
      @media (max-width: 768px) {
        .form-grid-inf { grid-template-columns: 1fr; }
        .form-group.full { grid-column: span 1; }
        .tabs-nav { gap: 15px; }
        .tab-btn { font-size: 0.75rem; }
      }

      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.4; }
        100% { opacity: 1; }
      }

      .modal-inf { position:fixed; inset:0; background:rgba(15, 23, 42, 0.6); backdrop-filter:blur(4px); display:none; justify-content:center; align-items:center; z-index:9999; padding:20px; }
      .modal-inf-content { background:#fff; width:100%; max-width:400px; border-radius:20px; padding:25px; text-align:center; }
      .btn-publish-inf { background:#0f172a; color:#fff; border:none; padding:14px; width:100%; border-radius:10px; font-weight:800; font-size: 14px; cursor:pointer; margin-top:20px; transition: 0.2s;}
    </style>

    <!-- Modais Customizados -->
    <div id="modal-alert-inf" class="modal-inf"><div class="modal-inf-content"><div id="alert-icon-inf" style="margin-bottom:10px;"></div><h3 id="alert-title-inf" style="color:#0f172a; margin-top:0;"></h3><div id="alert-msg-inf" style="color:#64748b; margin-bottom:20px;"></div><button class="btn-publish-inf" onclick="window.closeAlertInf()" style="margin-top:0;">OK</button></div></div>
    
    <div id="modal-confirm-inf" class="modal-inf"><div class="modal-inf-content"><h3 id="confirm-title-inf" style="color:#ef4444; margin-top:0;"></h3><p id="confirm-msg-inf" style="color:#64748b; margin-bottom:20px;"></p><div style="display:flex; gap:10px;"><button class="btn-publish-inf" style="background:#ef4444; margin-top:0;" onclick="window.pendingConfirmActionInf()">SIM</button><button class="btn-publish-inf" style="background:#f1f5f9; color:#64748b; margin-top:0;" onclick="this.closest('.modal-inf').style.display='none'">NÃO</button></div></div></div>

    <div style="padding: 20px;">
        <div class="header-master">
          <h1>Influenciadores</h1>
          <p>Gere códigos de acesso para os seus parceiros e direcione concurseiros.</p>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; margin-bottom:20px; flex-wrap: wrap; gap: 10px;">
            <div style="display:flex; gap:15px;">
                <button id="btn-cadastro" class="tab-btn tab-active" onclick="window.switchTabInfluencer('cadastro', true)">CRIAR INFLUENCIADOR</button>
                <button id="btn-lista" class="tab-btn" onclick="window.switchTabInfluencer('lista')">INFLUENCIADORES CRIADOS</button>
            </div>
            <div id="container-filtro-inf" style="display:none; align-items:center; gap:10px; margin-bottom: 5px;">
                <span style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase;">FILTRAR:</span>
                <select id="filtro-concurso-inf" class="input-premium" style="margin:0; width:200px; padding:6px; font-size:11px; font-weight:bold; color:#0f172a; border-radius:8px; border:1px solid #cbd5e1; outline:none;" onchange="window.paginaAtualInfluencers = 1; window.carregarListaInfluencers()">
                    <option value="todos">TODOS OS CONCURSOS</option>
                </select>
            </div>
        </div>

        <div id="content-cadastro" class="tab-content" style="margin-top: 25px;">
          <div class="card">
           <form onsubmit="window.salvarInfluencerNoFirebase(event)" autocomplete="off" role="presentation">
              <div class="form-grid-inf">
                <div class="form-group full">
                  <label>Nome do Influenciador / Parceiro:</label>
                  <input type="text" id="nomeInfluencer" placeholder="Ex: João Silva ou Curso X" required>
                </div>
                
                <div class="form-group">
                  <label>Vincular ao Concurso Alvo:</label>
                  <select id="concursoVinculado" required>
                    <option value="" disabled selected>A carregar concursos...</option>
                  </select>
                </div>

                <div class="form-group">
                  <label>Código de Acesso do Parceiro:</label>
                  <div class="pass-wrapper">
                    <input type="text" id="codigoInfluencer" placeholder="Gere o código aqui ----> " readonly required style="background: #e0f2fe; font-weight: bold; padding-right: 40px; color: #0284c7;">
                    <button type="button" class="btn-gen-key" onclick="window.gerarCodigoInfluencer()"><i class="fa-solid fa-key"></i></button>
                  </div>
                </div>
              </div>
              <small style="color: #64748b; font-size: 0.75rem; display: block; margin-top: 10px;">Os concurseiros vão usar este código ao registarem-se na plataforma.</small>
              <button type="submit" id="btnSalvarInfluencer" class="btn-padrao" style="background:#0f172a; color:white; width:100%; margin-top:20px; padding:14px; cursor:pointer; border:none; border-radius:10px; font-weight:800; font-size:1rem;">Criar Parceiro</button>
            </form>
          </div>
        </div>

        <div id="content-lista" class="tab-content" style="display:none; margin-top: 25px;">
          <div id="lista-influencers-unificada"></div>
        </div>
        
        <!-- TOAST DE SUCESSO -->
        <div id="toastInfluencerCriado" style="position:fixed; top:25px; right:25px; background:#10b981; color:white; padding:14px 22px; border-radius:14px; font-weight:800; font-size:0.9rem; box-shadow:0 10px 20px rgba(0,0,0,0.15); opacity:0; transform:translateY(-20px); transition:transform 0.3s ease-out, opacity 0.3s; z-index:99999; pointer-events:none;">
          <i class="fa-solid fa-circle-check" style="margin-right:8px; color:#ffffff;"></i> Influenciador salvo com sucesso!
        </div>
    </div>
  `;
});