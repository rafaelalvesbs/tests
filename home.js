window.Router.register('home', async () => {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
  const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
  const { getFirestore, doc, getDoc, collection, query, where, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

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

  const carregarDadosDoPainel = async () => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, "usuarios", user.uid);
          const docSnap = await getDoc(docRef);
          
          const titleDesk = document.getElementById('titulo-nome-desk');
          const titleMob = document.getElementById('titulo-nome-mob');
          const avatarPic = document.getElementById('avatar-pic-mob');
          
          if (docSnap.exists()) {
            const dados = docSnap.data();
            const nomeStr = dados.nome || "Master";
            const partesNome = nomeStr.trim().split(/\s+/);
            const nickName = (partesNome.length > 1 ? partesNome[0] + " " + partesNome[1] : partesNome[0]).toUpperCase();
            
            if (titleDesk) titleDesk.innerText = `OLÁ, ${nickName}!`;
            if (titleMob) titleMob.innerText = `OLÁ, ${nickName}!`;
            if (avatarPic && dados.fotoUrl) {
                avatarPic.innerHTML = `<img src="${dados.fotoUrl}" style="width: 100%; height: 100%; object-fit: cover;">`;
            }
          }

          // Monitoramentos
          const monitorarContagem = (colecao, elementoId, queryConstraints = []) => {
            const q = query(collection(db, colecao), ...queryConstraints);
            onSnapshot(q, (snap) => {
              const el = document.getElementById(elementoId);
              if (el) el.innerText = snap.size;
            });
          };

          monitorarContagem("concursos", "contagem-concursos");
          monitorarContagem("disciplinas", "contagem-disciplinas");
          monitorarContagem("questoes", "contagem-questoes");
          monitorarContagem("usuarios", "contagem-concurseiros", [where("perfil", "==", "Concurseiro")]);

          const qMsg = query(collection(db, "mensagens"), where("destinatarioId", "==", user.uid));
          onSnapshot(qMsg, (snap) => {
            const containerPaiMsg = document.getElementById('wrapper-mensagens');
            const listaMsg = document.getElementById('lista-mensagens-home');
            if (containerPaiMsg && listaMsg) {
              containerPaiMsg.style.display = snap.empty ? 'none' : 'block';
              listaMsg.innerHTML = snap.docs.slice(0, 2).map(msgDoc => {
                const m = msgDoc.data();
                return `<div class="item-acao"><div><strong>${m.assunto || 'Aviso'}</strong><br><small>${m.remetente || 'Sistema'}</small></div><button class="btn-acao btn-read" onclick="window.location.hash='#home'">Ver</button></div>`;
              }).join('');
            }
          });
        } catch (erro) {
            console.error("Erro ao carregar dados do usuário:", erro);
        }
      }
    });
  };

  setTimeout(carregarDadosDoPainel, 200);

  return `
    <style>
      .painel-container-master { padding: 20px; font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box; width: 100%; overflow-x: hidden; }
      .header-prof-desk { width: 100%; margin-bottom: 25px; }
      .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 20px; width: 100%; }
      .stat-card { 
        background: #ffffff; padding: 20px; border-radius: 24px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); 
        display: flex; flex-direction: column; justify-content: center; align-items: flex-start;
        height: 150px; width: 100%; box-sizing: border-box; border-top: 6px solid #0f172a; transition: 0.3s; position: relative; overflow: hidden;
      }
      .stat-card:hover { transform: translateY(-5px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
      .stat-card i.card-icon-mobile { display: none; }
      .stat-card span { font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; display: block; flex: 1; }
      .stat-card strong { font-size: 1.8rem; color: #0f172a; font-weight: 800; margin: 0; display: block; line-height: 1.1; }
      .stat-card.clickable { cursor: pointer; }
      
      .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; width: 100%; box-sizing: border-box; }
      .card-dash { background: #fff; padding: 20px; border-radius: 18px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
      .card-dash h3 { color: #0f172a; font-size: 0.95rem; margin-bottom: 15px; border-bottom: 2px solid #f4f7f6; padding-bottom: 8px; text-transform: uppercase; font-weight: 800; margin-top:0; }
      .item-acao { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
      .btn-acao { border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.7rem; font-weight: 700; }
      .btn-read { background: #e0f2fe; color: #0369a1; }
      
      #perfil-header-mobile { display: none; }

      @media (max-width: 1024px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }

      @media (max-width: 768px) { 
        .painel-container-master { padding: 0 !important; }
        .header-prof-desk { display: none; }
        #perfil-header-mobile { margin: -70px -15px 25px -15px; padding: 85px 20px 40px 20px; background: linear-gradient(to bottom, #1e293b 0%, #0f172a 75%, #f4f7f6 100%); display: flex; align-items: center; gap: 15px; width: calc(100% + 30px); position: relative; }
        #perfil-header-mobile h2 { color: #ffffff; margin-bottom: 2px; }
        #perfil-header-mobile p { color: #ffffff; white-space: nowrap; font-size: 0.9rem; font-weight: 600; }
        #perfil-header-mobile .avatar-border { width: 128px; height: 128px; min-width: 128px; border: 4px solid #ffffff; box-shadow: 0 8px 24px rgba(0,0,0,0.2); margin-bottom: -45px; z-index: 10; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        #perfil-header-mobile .avatar-border i { font-size: 2.2rem; color: #cbd5e1; }
        
        .stats-grid { grid-template-columns: 1fr; gap: 12px; padding: 0 15px 20px 15px; margin-top: 10px; }
        .stat-card { height: auto; min-height: 60px; padding: 12px 18px; flex-direction: row; align-items: center; justify-content: flex-start; border-top: none; border-left: 5px solid #0f172a; border-radius: 12px; }
        .stat-card i.card-icon-mobile { display: block; font-size: 1.1rem; color: #0f172a; margin-right: 12px; width: 20px; text-align: center; }
        .stat-card span { font-size: 0.85rem; text-transform: none; color: #1e293b; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
        .stat-card strong { font-size: 1.1rem; margin: 0 0 0 10px; background: #f1f5f9; padding: 4px 10px; border-radius: 8px; min-width: 35px; text-align: center; display: inline-block; }
        .dashboard-grid { padding: 0 15px 20px 15px; }
      }
    </style>

    <div class="painel-container-master">
      <div class="header-prof-desk header-prof">
          <h1 id="titulo-nome-desk" style="color:#0f172a; font-weight:900; margin-bottom: 5px; text-transform: uppercase; margin:0;">OLÁ, MASTER!</h1>
          <p style="color:#64748b; font-weight: 500; font-size: 1.1rem; margin: 5px 0 30px 0;">Painel Master — Acompanhe o andamento da plataforma.</p>
      </div>

      <div id="perfil-header-mobile">
          <div class="avatar-border" id="avatar-pic-mob">
              <i class="fa-solid fa-shield-halved"></i>
          </div>
          <div style="flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
              <div style="min-width: 0;">
                  <h2 id="titulo-nome-mob" style="font-size: 1.4rem; font-weight: 800; line-height: 1.1;">OLÁ, MASTER!</h2>
                  <p style="font-weight: 600;">Painel Master</p>
              </div>
          </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card clickable" onclick="window.location.hash='#concursos'">
          <i class="fa-solid fa-landmark card-icon-mobile"></i>
          <span>Total de Concursos</span>
          <strong id="contagem-concursos">...</strong>
        </div>
        <div class="stat-card clickable" onclick="window.location.hash='#disciplinas'">
          <i class="fa-solid fa-book card-icon-mobile"></i>
          <span>Disciplinas Criadas</span>
          <strong id="contagem-disciplinas">...</strong>
        </div>
        <div class="stat-card clickable" onclick="window.location.hash='#banco'">
          <i class="fa-solid fa-circle-question card-icon-mobile"></i>
          <span>Questões no Banco</span>
          <strong id="contagem-questoes">...</strong>
        </div>
        <div class="stat-card clickable" onclick="window.location.hash='#faturamentodomaster'">
          <i class="fa-solid fa-users card-icon-mobile"></i>
          <span>Concurseiros Ativos</span>
          <strong id="contagem-concurseiros">...</strong>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card-dash" id="wrapper-mensagens" style="display:none;">
          <h3><i class="fa-solid fa-bullhorn"></i> Avisos Recentes</h3>
          <div id="lista-mensagens-home"></div>
        </div>
      </div>
    </div>
  `;
});