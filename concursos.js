window.Router.register('concursos', async () => {
  // 1. NAVEGAÇÃO
  window.switchTabConcurso = (tabId) => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    
    const btnTab = document.getElementById('btn-' + tabId);
    const contentTab = document.getElementById('content-' + tabId);
    
    if (btnTab) btnTab.classList.add('tab-active');
    if (contentTab) contentTab.style.display = 'block';
    
    if(tabId === 'lista') {
        window.paginaAtualConcursos = 1;
        window.carregarListaConcursos();
    }
  };

  // 2. GERAÇÃO DE CÓDIGO
  window.gerarCodigoConcurso = () => {
    const input = document.getElementById('codigoConcurso');
    const btn = document.querySelector('.btn-gen-key');
    const caracteresValidos = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
    let pass = '';
    for (let i = 0; i < 6; i++) {
      pass += caracteresValidos.charAt(Math.floor(Math.random() * caracteresValidos.length));
    }
    input.value = pass;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-lock"></i>';
  };

  // ADICIONAR E REMOVER DISCIPLINAS (CADASTRO)
  window.adicionarDisciplina = () => {
    const container = document.getElementById('disciplinas-container');
    const wrappers = container.querySelectorAll('.disciplina-wrapper');
    if (wrappers.length >= 15) {
      alert("Você pode adicionar no máximo 15 disciplinas.");
      return;
    }
    const div = document.createElement('div');
    div.className = 'disciplina-wrapper';
    div.style.cssText = 'display:flex; gap:10px; margin-bottom: 8px;';
    div.innerHTML = `
      <input type="text" class="input-disciplina" placeholder="Nova Disciplina" autocomplete="off" required oninput="this.value = this.value.toUpperCase()">
      <button type="button" onclick="this.parentElement.remove()" style="background:#ef4444; color:white; border:none; width:44px; border-radius:8px; cursor:pointer; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-minus"></i></button>
    `;
    container.appendChild(div);
  };

  // 3. SALVAR CONCURSO NO FIREBASE
  window.salvarConcursoNoFirebase = async (e) => {
    e.preventDefault();

    const inputsDisc = document.querySelectorAll('.input-disciplina');
    const disciplinasArray = [];
    inputsDisc.forEach(inp => {
      if (inp.value.trim()) disciplinasArray.push(inp.value.trim().toUpperCase());
    });

    const campos = {
      titulo: document.getElementById('nomeConcurso').value.trim().toUpperCase(),
      banca: document.getElementById('bancaConcurso').value.trim(),
      ano: document.getElementById('anoConcurso').value.trim(),
      codigo: document.getElementById('codigoConcurso').value.trim(),
      disciplinas: disciplinasArray
    };

    if (!campos.titulo || !campos.banca || !campos.ano || !campos.codigo || campos.codigo.includes("Gere o código") || campos.disciplinas.length === 0) {
      alert("⚠️ Atenção: Preencha todos os campos, adicione pelo menos uma disciplina e gere o código do concurso!");
      return;
    }

    const btnSalvar = document.getElementById('btnSalvarConcurso');
    const textoOriginal = btnSalvar.innerHTML;
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    try {
      const userAtual = window.authMethods.getAuth().currentUser;

      const dadosParaSalvar = {
        titulo: campos.titulo,
        banca: campos.banca,
        ano: campos.ano,
        codigo: campos.codigo,
        disciplinas: campos.disciplinas,
        status: "Ativo",
        dataCriacao: window.fsMethods.serverTimestamp(),
        criadoPor: userAtual.uid
      };

      await window.fsMethods.addDoc(window.fsMethods.collection(window.db, "concursos"), dadosParaSalvar);
      
      window.mostrarToastConcursoCriado();
      e.target.reset();
      
      // Reseta os campos de disciplina para ficar apenas 1
      const containerDisc = document.getElementById('disciplinas-container');
      const wrappers = containerDisc.querySelectorAll('.disciplina-wrapper');
      for (let i = 1; i < wrappers.length; i++) {
        wrappers[i].remove();
      }

      document.querySelector('.btn-gen-key').disabled = false;
      document.querySelector('.btn-gen-key').innerHTML = '<i class="fa-solid fa-key"></i>';
      window.switchTabConcurso('lista');
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar concurso."); 
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = textoOriginal;
    }
  };

  // 4. CARREGAR LISTA DE CONCURSOS
  window.carregarListaConcursos = async () => {
    const container = document.getElementById('lista-concursos-unificada');
    
    container.innerHTML = `
      <div class="lista-turmas-vertical">
        ${Array(3).fill(0).map(() => `
          <div class="card-turma-item" style="border-left-color: #e2e8f0; background: #fff;">
            <div class="card-info-linha" style="gap: 15px;">
              <div style="flex:1; height: 15px; background: #f1f5f9; border-radius: 4px; animation: pulse 1.5s infinite ease-in-out;"></div>
              <div style="flex:1; height: 15px; background: #f1f5f9; border-radius: 4px; animation: pulse 1.5s infinite ease-in-out;"></div>
              <div style="flex:0.5; height: 15px; background: #f1f5f9; border-radius: 4px; animation: pulse 1.5s infinite ease-in-out;"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    try {
      const q = window.fsMethods.query(
        window.fsMethods.collection(window.db, "concursos"), 
        window.fsMethods.orderBy("dataCriacao", "desc")
      );

      const snap = await window.fsMethods.getDocs(q);
      
      if (snap.empty) { 
        container.innerHTML = `
            <div style="text-align:center; padding:40px; background:#fff; border-radius:12px; border:1px dashed #cbd5e1; color:#64748b; font-weight:600;">
                Nenhum concurso criado ainda.
            </div>`; 
        return; 
      }

      if (window.paginaAtualConcursos === undefined) window.paginaAtualConcursos = 1;
      const concursosData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const itensPorPagina = 8;
      const totalPaginas = Math.ceil(concursosData.length / itensPorPagina);
      const inicio = (window.paginaAtualConcursos - 1) * itensPorPagina;
      const itensPagina = concursosData.slice(inicio, inicio + itensPorPagina);

      container.innerHTML = `<div class="lista-turmas-vertical" id="grid-concursos-dinamico"></div><div id="paginacao-concursos"></div>`;
      const grid = document.getElementById('grid-concursos-dinamico');

      for (const t of itensPagina) {
        const numDisciplinas = t.disciplinas ? t.disciplinas.length : 0;
        
        const card = document.createElement('div');
        card.className = "card-turma-item";
        card.innerHTML = `
          <div class="card-info-linha">
            <div id="nome-concurso-text-${t.id}" class="info-item" style="flex:1.5; font-weight:800; color:#1e293b; font-size:0.9rem;">${t.titulo}</div>
            <div class="info-item" style="flex:1; font-weight:600; color:#475569; font-size:0.85rem;"><i class="fa-solid fa-building-columns"></i> ${t.banca || 'N/A'}</div>
            <div class="info-item" style="flex:0.8; color:#64748b; font-size:0.85rem;"><i class="fa-solid fa-book"></i> ${numDisciplinas} Disc.</div>
            <div class="info-item" style="flex:0.8; color:#64748b; font-size:0.85rem;"><i class="fa-regular fa-calendar"></i> ${t.ano || 'N/A'}</div>
            <div class="info-item" style="flex:1;">
              <code class="codigo-box" onclick="window.mostrarCodigoConcurso('${t.titulo}', '${t.codigo}')" title="Clique para ver o código" style="cursor: pointer; border: 1px dashed #0f172a; padding: 4px 8px; border-radius: 6px; background: #f1f5f9; color: #0f172a; font-weight: bold; font-size: 0.8rem;">
                 <i class="fa-solid fa-key" style="margin-right: 4px;"></i> ${t.codigo || 'GERAR'}
              </code>
            </div>
          </div>
          <div class="card-acoes">
            <button id="btn-editar-concurso-${t.id}" style="background:#e2e8f0; color:#0f172a; border:none; padding:8px 12px; border-radius:8px; cursor:pointer;" title="Editar Concurso">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-excluir-red-icon" id="btn-excluir-concurso-${t.id}" style="font-size:1rem; background:none; border:none; color:#ef4444; cursor:pointer; margin-left:6px;" title="Excluir Concurso">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>`;
        grid.appendChild(card);

        document.getElementById(`btn-editar-concurso-${t.id}`).onclick = () => window.abrirEdicaoConcurso(t.id, t.titulo, t.banca, t.ano, t.disciplinas);
        document.getElementById(`btn-excluir-concurso-${t.id}`).onclick = (e) => window.excluirConcurso(t.id, t.titulo, e);
      }

      // Paginação
      if (totalPaginas > 1) {
        let htmlPaginacao = `<div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:20px; margin-bottom:20px;">
          <button onclick="if(window.paginaAtualConcursos > 1) { window.paginaAtualConcursos--; window.carregarListaConcursos(); }" 
            style="width:40px; height:40px; border-radius:10px; border:1px solid #e2e8f0; background:white; cursor:pointer; display:flex; align-items:center; justify-content:center;">
            <i class="fa-solid fa-chevron-left" style="color:#64748b;"></i>
          </button>`;
        
        for (let i = 1; i <= totalPaginas; i++) {
          const ativa = i === window.paginaAtualConcursos;
          htmlPaginacao += `<button onclick="window.paginaAtualConcursos=${i}; window.carregarListaConcursos();" style="width:40px; height:40px; border-radius:10px; border:1px solid ${ativa ? '#0f172a' : '#e2e8f0'}; background:${ativa ? '#0f172a' : 'white'}; color:${ativa ? 'white' : '#64748b'}; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center;">${i}</button>`;
        }

        htmlPaginacao += `<button onclick="if(window.paginaAtualConcursos < ${totalPaginas}) { window.paginaAtualConcursos++; window.carregarListaConcursos(); }" 
          style="width:40px; height:40px; border-radius:10px; border:1px solid #e2e8f0; background:white; cursor:pointer; display:flex; align-items:center; justify-content:center;">
          <i class="fa-solid fa-chevron-right" style="color:#64748b;"></i>
        </button></div>`;
        document.getElementById('paginacao-concursos').innerHTML = htmlPaginacao;
      }
    } catch (e) { 
      console.error("Erro ao carregar concursos:", e);
      container.innerHTML = "<p style='padding:10px; color:red;'>Erro ao carregar os concursos.</p>"; 
    }
  };

  // ADICIONAR DISCIPLINAS (EDIÇÃO)
  window.adicionarDisciplinaEdicao = () => {
    const container = document.getElementById('editar-disciplinas-container');
    const wrappers = container.querySelectorAll('.disciplina-wrapper-edicao');
    if (wrappers.length >= 15) {
      alert("Você pode adicionar no máximo 15 disciplinas.");
      return;
    }
    const div = document.createElement('div');
    div.className = 'disciplina-wrapper-edicao';
    div.style.cssText = 'display:flex; gap:10px; margin-bottom: 8px;';
    div.innerHTML = `
      <input type="text" class="input-disciplina-edicao" placeholder="Nova Disciplina" autocomplete="off" required oninput="this.value = this.value.toUpperCase()">
      <button type="button" onclick="this.parentElement.remove()" style="background:#ef4444; color:white; border:none; width:44px; border-radius:8px; cursor:pointer; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-minus"></i></button>
    `;
    container.appendChild(div);
  };

  // 5. EDIÇÃO DE CONCURSO
  window.abrirEdicaoConcurso = (idConcurso, nomeAtual, bancaAtual, anoAtual, disciplinasAtual = []) => {
    const modal = document.getElementById('modalEditarConcurso');
    const inputNome = document.getElementById('inputEditarNomeConcurso');
    const inputBanca = document.getElementById('inputEditarBancaConcurso');
    const inputAno = document.getElementById('inputEditarAnoConcurso');
    const containerDisciplinas = document.getElementById('editar-disciplinas-container');
    const btnSalvar = document.getElementById('btnSalvarEdicaoConcurso');
    
    inputNome.value = nomeAtual;
    inputBanca.value = bancaAtual || '';
    inputAno.value = anoAtual || '';
    
    // Renderiza as disciplinas atuais
    containerDisciplinas.innerHTML = '<label style="font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 4px; text-transform: uppercase; display: block;">Disciplinas (Até 15):</label>';
    const listaParaRenderizar = disciplinasAtual.length > 0 ? disciplinasAtual : [''];
    
    listaParaRenderizar.forEach((disc, index) => {
        const div = document.createElement('div');
        div.className = 'disciplina-wrapper-edicao';
        div.style.cssText = 'display:flex; gap:10px; margin-bottom: 8px;';
        
        let btnHtml = index === 0 
            ? `<button type="button" onclick="window.adicionarDisciplinaEdicao()" style="background:#0f172a; color:white; border:none; width:44px; border-radius:8px; cursor:pointer; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-plus"></i></button>`
            : `<button type="button" onclick="this.parentElement.remove()" style="background:#ef4444; color:white; border:none; width:44px; border-radius:8px; cursor:pointer; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-minus"></i></button>`;
            
        div.innerHTML = `
          <input type="text" class="input-disciplina-edicao" value="${disc}" placeholder="Ex: PORTUGUÊS" autocomplete="off" required oninput="this.value = this.value.toUpperCase()">
          ${btnHtml}
        `;
        containerDisciplinas.appendChild(div);
    });

    modal.style.display = 'flex';
    
    btnSalvar.onclick = async () => {
      const novoNome = inputNome.value.trim().toUpperCase();
      const novaBanca = inputBanca.value.trim();
      const novoAno = inputAno.value.trim();
      
      const inputsDiscEdicao = document.querySelectorAll('.input-disciplina-edicao');
      const novasDisciplinas = [];
      inputsDiscEdicao.forEach(inp => {
        if (inp.value.trim()) novasDisciplinas.push(inp.value.trim().toUpperCase());
      });
      
      if (!novoNome || !novaBanca || !novoAno || novasDisciplinas.length === 0) {
        alert("Preencha todos os campos e pelo menos uma disciplina.");
        return;
      }
      
      btnSalvar.disabled = true;
      btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
      
      try {
        const refDoc = window.fsMethods.doc(window.db, "concursos", idConcurso);
        await window.fsMethods.updateDoc(refDoc, {
          titulo: novoNome,
          banca: novaBanca,
          ano: novoAno,
          disciplinas: novasDisciplinas
        });
        
        window.fecharEdicaoConcurso();
        window.carregarListaConcursos();
      } catch(e) {
        console.error("Erro ao editar concurso:", e);
        alert("Falha ao salvar edição.");
      } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = 'Salvar';
      }
    };
  };

  window.fecharEdicaoConcurso = () => {
    document.getElementById('modalEditarConcurso').style.display = 'none';
  };

  // 6. EXCLUSÃO DE CONCURSO
  window.excluirConcurso = async (idDocumento, titulo, event) => {
    if (event) event.stopPropagation();
    
    const textoConfirmacao = document.getElementById('modalConfirmacaoTexto');
    const btnExcluir = document.getElementById('btnConfirmarExclusao');
    
    textoConfirmacao.innerHTML = `
      <p>Esta ação apagará o concurso e poderá afetar as questões vinculadas. Para confirmar, digite <strong>${titulo}</strong> abaixo:</p>
      <input type="text" id="inputConfirmarNomeConcurso" placeholder="Nome do concurso" 
             style="width:100%; padding:10px; margin-top:15px; border:1px solid #e2e8f0; border-radius:8px; text-align:center; font-weight:bold;"
             autocomplete="off">
    `;

    btnExcluir.disabled = true;
    btnExcluir.style.opacity = '0.5';
    btnExcluir.style.cursor = 'not-allowed';

    const inputVerifica = document.getElementById('inputConfirmarNomeConcurso');
    inputVerifica.oninput = () => {
      if (inputVerifica.value.trim().toUpperCase() === titulo.trim().toUpperCase()) {
        btnExcluir.disabled = false;
        btnExcluir.style.opacity = '1';
        btnExcluir.style.cursor = 'pointer';
      } else {
        btnExcluir.disabled = true;
        btnExcluir.style.opacity = '0.5';
        btnExcluir.style.cursor = 'not-allowed';
      }
    };

    btnExcluir.onclick = async () => {
      try {
        const refDoc = window.fsMethods.doc(window.db, "concursos", idDocumento);
        await window.fsMethods.deleteDoc(refDoc);
        window.fecharConfirmacaoExclusao();
        window.carregarListaConcursos();
      } catch (e) { 
        console.error("Erro ao excluir concurso:", e);
        alert("Erro ao excluir o concurso.");
      }
    };
    
    document.getElementById('modalConfirmacaoConcurso').style.display = 'flex';
  };

  window.fecharConfirmacaoExclusao = () => {
    document.getElementById('modalConfirmacaoConcurso').style.display = 'none';
    if (document.getElementById('inputConfirmarNomeConcurso')) {
        document.getElementById('inputConfirmarNomeConcurso').value = '';
    }
  };

  // 7. MODAIS DE CÓDIGO E TOASTS
  window.mostrarCodigoConcurso = (titulo, codigo) => {
    const modalTitulo = document.getElementById('modalTituloCodigo');
    const modalCodigo = document.getElementById('modalCodigoValue');
    if (modalTitulo) modalTitulo.innerText = titulo;
    if (modalCodigo) modalCodigo.innerText = codigo;
    document.getElementById('modalVerCodigo').style.display = 'flex';
  };

  window.fecharModalCodigo = () => {
    document.getElementById('modalVerCodigo').style.display = 'none';
  };

  window.copiarCodigoModal = () => {
    const codigo = document.getElementById('modalCodigoValue').innerText;
    const btn = document.getElementById('btnCopiarCodigo');
    if (!codigo) return;

    navigator.clipboard.writeText(codigo).then(() => {
      const textoOriginal = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
      btn.style.backgroundColor = "#0284c7";
      setTimeout(() => {
        btn.innerHTML = textoOriginal;
        btn.style.backgroundColor = "#0f172a";
      }, 2000);
    }).catch(err => {
      console.error('Erro ao copiar: ', err);
      const areaTexto = document.createElement("textarea");
      areaTexto.value = codigo;
      document.body.appendChild(areaTexto);
      areaTexto.select();
      document.execCommand("copy");
      document.body.removeChild(areaTexto);
      
      const textoOriginal = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
      setTimeout(() => { btn.innerHTML = textoOriginal; }, 2000);
    });
  };

  window.mostrarToastConcursoCriado = () => {
    const toast = document.getElementById('toastConcursoCriado');
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
    }, 2000);
  };

  setTimeout(() => { window.switchTabConcurso('cadastro'); }, 0);

  return `
    <style>
      .header-master { margin-top: 0px; margin-bottom: 10px; }
      .header-master h1 { font-size: 1.8rem; margin-bottom: 2px; color: #0f172a; text-transform: uppercase; font-weight: 900;}
      .header-master p { font-size: 0.85rem; color: #64748b; }
      
      .tabs-nav { display: flex; gap: 30px; border-bottom: 1px solid #e2e8f0; padding-left: 10px; margin-top: 12px; }
      .tab-btn { padding: 12px 0px; border: none; background: none; cursor: pointer; font-weight: 700; color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; position: relative; transition: color 0.2s;}
      .tab-active { color: #0f172a !important; }
      .tab-active::after { content: ""; position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background-color: #0f172a; }
      
      .form-grid-concursos { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
      .form-group { display: flex; flex-direction: column; margin-bottom: 8px; }
      .form-group.full { grid-column: span 2; }
      .form-group label { font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 4px; text-transform: uppercase; }
      .form-group input, .form-group select { padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; width: 100%; box-sizing: border-box; background: #f8fafc; outline: none; }
      .form-group input:focus { border-color: #0f172a; background: #ffffff; }
      
      .pass-wrapper { position: relative; width: 100%; display: flex; align-items: center; }
      .btn-gen-key { position: absolute; right: 4px; background: #0f172a; color: white; border: none; width: 34px; height: 34px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
      
      .card { padding: 25px !important; margin-bottom: 0 !important; background: white; border-radius: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); }
      .card-turma-item { background: white; padding: 12px 18px; border-radius: 12px; border: 1px solid #e2e8f0; border-left: 5px solid #0f172a; display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; min-height: 50px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
      .card-info-linha { display: flex; align-items: center; flex: 1; gap: 15px; }
      .btn-excluir-red-icon { background: none; color: #ef4444; border: none; cursor: pointer; margin-left: 10px; }

      @media (max-width: 768px) {
        .form-grid-concursos { grid-template-columns: 1fr; }
        .form-group.full { grid-column: span 1; }
        .card-turma-item { flex-direction: column; align-items: flex-start; padding: 15px; gap: 12px; }
        .card-info-linha { flex-direction: column; align-items: flex-start; width: 100%; gap: 8px; }
        .info-item { width: 100%; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }
        .card-acoes { width: 100%; display: flex; justify-content: flex-end; margin-top: 5px; }
        .tabs-nav { gap: 15px; }
        .tab-btn { font-size: 0.75rem; }
      }

      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.4; }
        100% { opacity: 1; }
      }
    </style>

    <div style="padding: 20px;">
        <div class="header-master">
          <h1>Concursos</h1>
          <p>Crie e faça a gestão dos concursos disponíveis na plataforma.</p>
        </div>

        <div class="tabs-nav">
            <button id="btn-cadastro" class="tab-btn tab-active" onclick="window.switchTabConcurso('cadastro')">CRIAR CONCURSO</button>
            <button id="btn-lista" class="tab-btn" onclick="window.switchTabConcurso('lista')">CONCURSOS CRIADOS</button>
        </div>

        <div id="content-cadastro" class="tab-content" style="margin-top: 25px;">
          <div class="card">
           <form onsubmit="window.salvarConcursoNoFirebase(event)" autocomplete="off" role="presentation">
              <div class="form-grid-concursos">
                <div class="form-group full">
                  <label>Título do Concurso:</label>
                  <input type="text" id="nomeConcurso" placeholder="Ex: POLÍCIA FEDERAL (PF) 2026" required autocomplete="off" oninput="this.value = this.value.toUpperCase()">
                </div>
                <div class="form-group">
                  <label>Banca Organizadora:</label>
                  <input type="text" id="bancaConcurso" placeholder="Ex: CEBRASPE" required autocomplete="off">
                </div>
                <div class="form-group">
                  <label>Ano do Concurso:</label>
                  <input type="number" id="anoConcurso" placeholder="Ex: 2026" required min="2000" max="2100" autocomplete="off">
                </div>
                
                <!-- NOVO CAMPO DE DISCIPLINAS -->
                <div class="form-group full" id="disciplinas-container">
                  <label>Disciplinas (Até 15):</label>
                  <div class="disciplina-wrapper" style="display:flex; gap:10px; margin-bottom: 8px;">
                    <input type="text" class="input-disciplina" placeholder="Ex: PORTUGUÊS" autocomplete="off" required oninput="this.value = this.value.toUpperCase()">
                    <button type="button" class="btn-add-disc" onclick="window.adicionarDisciplina()" style="background:#0f172a; color:white; border:none; width:44px; border-radius:8px; cursor:pointer; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-plus"></i></button>
                  </div>
                </div>

                <div class="form-group full">
                  <label>Código de Acesso do Concurso:</label>
                  <div class="pass-wrapper">
                    <input type="text" id="codigoConcurso" placeholder="Gere o código aqui ----> " readonly required autocomplete="off" style="background: #e0f2fe; font-weight: bold; padding-right: 40px; color: #0284c7;">
                    <button type="button" class="btn-gen-key" onclick="window.gerarCodigoConcurso()"><i class="fa-solid fa-key"></i></button>
                  </div>
                </div>
              </div>
              <button type="submit" id="btnSalvarConcurso" class="btn-padrao" style="background:#0f172a; color:white; width:100%; margin-top:15px; padding:14px; cursor:pointer; border:none; border-radius:10px; font-weight:800; font-size:1rem;">Finalizar Cadastro</button>
            </form>
          </div>
        </div>

        <div id="content-lista" class="tab-content" style="display:none; margin-top: 25px;">
          <div id="lista-concursos-unificada"></div>
        </div>

        <!-- MODAL DE VISUALIZAR E COPIAR CÓDIGO -->
        <div id="modalVerCodigo" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; align-items:center; justify-content:center; backdrop-filter: blur(2px);">
          <div style="background:white; width:90%; max-width:400px; padding:25px; border-radius:20px; box-shadow: 0 20px 25px rgba(0,0,0,0.1); text-align:center;">
            <div style="background:#f8fafc; border-radius:15px; padding:15px; margin-bottom:20px;">
                <h3 id="modalTituloCodigo" style="color:#0f172a; margin:0; font-size:1.1rem; text-transform:UPPERCASE; font-weight:800;"></h3>
                <p style="font-size:0.8rem; color:#64748b; margin-top:5px;">Código de Acesso do Concurso</p>
            </div>
            <div id="modalCodigoValue" style="font-family:monospace; font-size:2.5rem; font-weight:900; color:#0f172a; margin:20px 0; letter-spacing:8px;"></div>
            <div style="display:flex; flex-direction:column; gap:10px;">
              <button onclick="window.copiarCodigoModal()" id="btnCopiarCodigo" style="width:100%; background:#0f172a; color:white; border:none; padding:12px; border-radius:50px; font-weight:700; cursor:pointer;">
                <i class="fa-solid fa-copy"></i> Copiar Código
              </button>
              <button onclick="window.fecharModalCodigo()" style="width:100%; background:white; color:#0f172a; border:2px solid #0f172a; padding:12px; border-radius:50px; font-weight:800; cursor:pointer; margin-top:5px;">SAIR</button>
            </div>
          </div>
        </div>

        <!-- MODAL DE CONFIRMAÇÃO DE EXCLUSÃO -->
        <div id="modalConfirmacaoConcurso" style="display:none; position:fixed; inset:0; background:rgba(15, 23, 42, 0.7); z-index:9999; align-items:center; justify-content:center; backdrop-filter: blur(4px);">
          <div style="background:white; width:90%; max-width:420px; padding:30px; border-radius:20px; text-align:center;">
            <div style="background:#fef2f2; width:60px; height:60px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin: 0 auto 15px;"><i class="fa-solid fa-triangle-exclamation" style="color:#ef4444; font-size:1.5rem;"></i></div>
            <h3 style="color:#0f172a; margin-bottom:10px; font-size:1.3rem; font-weight:800;">Excluir Concurso?</h3>
            <div id="modalConfirmacaoTexto" style="color:#64748b; font-size:0.95rem; margin-bottom:20px; line-height: 1.5;"></div>
            <div style="display:flex; gap:10px;">
              <button onclick="window.fecharConfirmacaoExclusao()" style="flex:1; padding:12px; border-radius:12px; border:2px solid #cbd5e1; background:white; color:#475569; font-weight:700; cursor: pointer;">Cancelar</button>
              <button id="btnConfirmarExclusao" style="flex:1; padding:12px; border-radius:12px; border:none; background:#ef4444; color:white; font-weight:800; cursor: pointer;">Excluir</button>
            </div>
          </div>
        </div>

        <!-- MODAL DE EDIÇÃO -->
        <div id="modalEditarConcurso" style="display:none; position:fixed; inset:0; background:rgba(15, 23, 42, 0.7); z-index:10005; align-items:center; justify-content:center; backdrop-filter: blur(4px);">
          <div style="background:white; width:90%; max-width:420px; padding:30px; border-radius:20px; max-height: 90vh; overflow-y: auto;">
            <h3 style="color:#0f172a; margin-bottom:20px; font-weight: 900; font-size:1.3rem; text-align:center;"><i class="fa-solid fa-pen" style="color:#38bdf8; margin-right:8px;"></i> Editar Concurso</h3>
            
            <div class="form-group" style="margin-bottom: 12px;">
                <label>Título do Concurso:</label>
                <input type="text" id="inputEditarNomeConcurso" autocomplete="off" oninput="this.value = this.value.toUpperCase()">
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
                <label>Banca:</label>
                <input type="text" id="inputEditarBancaConcurso" autocomplete="off">
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
                <label>Ano:</label>
                <input type="number" id="inputEditarAnoConcurso" autocomplete="off">
            </div>

            <!-- CONTAINER PARA EDITAR DISCIPLINAS -->
            <div class="form-group" id="editar-disciplinas-container" style="margin-bottom: 25px;">
                <!-- Preenchido via JS dinamicamente -->
            </div>

            <div style="display:flex; gap:10px;">
              <button onclick="window.fecharEdicaoConcurso()" style="flex:1; padding:12px; border-radius:12px; border:2px solid #cbd5e1; background:white; color:#475569; font-weight:700; cursor:pointer;">Cancelar</button>
              <button id="btnSalvarEdicaoConcurso" style="flex:1; padding:12px; border-radius:12px; border:none; background:#0f172a; color:white; font-weight:800; cursor:pointer;">Salvar</button>
            </div>
          </div>
        </div>
        
        <!-- TOAST DE SUCESSO -->
        <div id="toastConcursoCriado" style="position:fixed; top:25px; right:25px; background:#10b981; color:white; padding:14px 22px; border-radius:14px; font-weight:800; font-size:0.9rem; box-shadow:0 10px 20px rgba(0,0,0,0.15); opacity:0; transform:translateY(-20px); transition:transform 0.3s ease-out, opacity 0.3s; z-index:99999; pointer-events:none;">
          <i class="fa-solid fa-circle-check" style="margin-right:8px; color:#ffffff;"></i> Concurso criado/atualizado com sucesso!
        </div>
    </div>
  `;
});