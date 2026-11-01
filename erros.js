window.Router.register('erros', async () => {
    const { collection, getDocs, doc, deleteDoc, setDoc } = window.fsMethods;
    const db = window.db;

    setTimeout(async () => {
        await window.carregarReportes();
    }, 100);

    window.carregarReportes = async () => {
        const container = document.getElementById('lista-erros-master');
        if(!container) return;
        
        container.innerHTML = '<div style="padding:40px 0; text-align:center;"><div class="spinner-q" style="margin: 0 auto;"></div><p style="margin-top:15px; color:#64748b;">Buscando reportes pendentes...</p></div>';
        
        try {
            const snap = await getDocs(collection(db, "reportes_questoes"));
            let reportes = [];
            snap.forEach(d => reportes.push({ id: d.id, ...d.data() }));

            if (reportes.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding:50px 20px; background:#fff; border-radius:16px; border:1px dashed #cbd5e1;">
                        <i class="fa-solid fa-face-smile" style="font-size:40px; color:#10b981; margin-bottom:15px;"></i>
                        <h3 style="color:#0f172a; margin-bottom:5px;">Nenhum erro reportado!</h3>
                        <p style="color:#64748b; font-size:14px;">Os alunos não reportaram nenhum problema no momento.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = reportes.map(r => `
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:25px; margin-bottom:20px; box-shadow:0 4px 15px rgba(0,0,0,0.02);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <span style="font-size:11px; font-weight:800; color:#3b82f6; text-transform:uppercase; background:#eff6ff; padding:4px 10px; border-radius:6px;">Disciplina: ${r.disciplina || 'Desconhecida'}</span>
                        <span style="font-size:11px; color:#94a3b8; font-weight:700;">ID Questão: ${r.questaoId.split('_')[1] || 'N/A'}</span>
                    </div>
                    <p style="color:#1e293b; font-size:14px; margin-bottom:20px; font-weight:600; line-height:1.5;">"${r.descricao}"</p>
                    
                    <textarea id="resposta-${r.id}" rows="3" placeholder="Escreva o feedback para o aluno (ex: Gabarito corrigido, valeu!)..." style="width: 100%; padding: 15px; border-radius: 12px; border: 1px solid #cbd5e1; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px; margin-bottom: 15px; resize:none; outline:none;"></textarea>
                    
                    <div style="display:flex; justify-content:flex-end;">
                        <button onclick="window.resolverReporte('${r.id}', '${r.usuarioId}', '${r.questaoId}')" style="background:#0f172a; color:#fff; border:none; padding:12px 25px; border-radius:10px; font-weight:800; cursor:pointer; font-size:14px; transition:0.2s;">ENVIAR E RESOLVER</button>
                    </div>
                </div>
            `).join('');

            window.dadosReportesAtuais = reportes;

        } catch (e) {
            console.error(e);
            container.innerHTML = '<p style="color:#ef4444; text-align:center;">Erro ao carregar os reportes. Tente novamente mais tarde.</p>';
        }
    };

    window.resolverReporte = async (reporteId, usuarioId, questaoId) => {
        const textArea = document.getElementById(`resposta-${reporteId}`);
        let resposta = textArea.value;
        if (!resposta.trim()) resposta = "Seu reporte foi analisado e resolvido pela equipe. Bons estudos!";

        const btn = textArea.nextElementSibling.querySelector('button');
        btn.innerText = "ENVIANDO...";
        btn.disabled = true;

        const repObj = window.dadosReportesAtuais.find(r => r.id === reporteId);
        const descOriginal = repObj ? repObj.descricao : "Sem descrição";

        try {
            const feedbackId = `${usuarioId}_${Date.now()}`;
            await setDoc(doc(collection(db, "feedbacks_questoes"), feedbackId), {
                usuarioId: usuarioId,
                questaoId: questaoId,
                descricaoOriginal: descOriginal,
                respostaEquipe: resposta,
                lido: false,
                data: Date.now()
            });

            await deleteDoc(doc(db, "reportes_questoes", reporteId));
            await window.carregarReportes();

        } catch (e) {
            console.error(e);
            alert("Erro ao enviar o feedback. Verifique a conexão.");
            btn.innerText = "ENVIAR E RESOLVER";
            btn.disabled = false;
        }
    };

    return `
        <style>
            .admin-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:25px; }
            .admin-title { font-size:24px; font-weight:900; color:#0f172a; }
            .spinner-q { width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top: 4px solid #0f172a; border-radius: 50%; animation: spinQ 0.8s linear infinite; }
            @keyframes spinQ { to { transform: rotate(360deg); } }
        </style>
        <div>
            <div class="admin-header">
                <div class="admin-title"><i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> Erros Reportados</div>
            </div>
            <p style="color:#64748b; font-size:14px; margin-bottom:25px;">Avalie as questões reportadas pelos alunos e envie o feedback direto para a conta deles. O aviso chegará como notificação.</p>
            <div id="lista-erros-master"></div>
        </div>
    `;
});