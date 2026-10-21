// Funções compartilhadas pelas páginas do EnqueteNuvem

function slugDaUrl() {
  // /t/<slug> ou /t/<slug>/painel
  return location.pathname.split('/').filter(Boolean)[1];
}

async function buscarEspaco(slug) {
  const r = await fetch(`/api/espacos/${encodeURIComponent(slug)}`, { cache: 'no-store' });
  if (!r.ok) throw new Error((await r.json()).erro || 'Erro');
  return r.json();
}

function desenharResultados(container, dados) {
  const maior = Math.max(...dados.opcoes.map((o) => o.votos));
  // reaproveita as barras existentes para a animação ficar suave
  if (container.children.length !== dados.opcoes.length) {
    container.innerHTML = '';
    dados.opcoes.forEach(() => {
      const barra = document.createElement('div');
      barra.className = 'barra';
      barra.innerHTML = '<div class="barra-topo"><span class="t"></span><span class="v"></span></div>' +
        '<div class="barra-fundo"><div class="barra-cheia"></div></div>';
      container.appendChild(barra);
    });
  }
  dados.opcoes.forEach((o, i) => {
    const barra = container.children[i];
    const pct = dados.total ? Math.round((o.votos / dados.total) * 100) : 0;
    barra.classList.toggle('lider', dados.total > 0 && o.votos === maior);
    barra.querySelector('.t').textContent = o.texto;
    barra.querySelector('.v').textContent = `${o.votos} voto${o.votos === 1 ? '' : 's'} · ${pct}%`;
    barra.querySelector('.barra-cheia').style.width = pct + '%';
  });
}

async function desenharStatus(el) {
  try {
    const s = await (await fetch('/api/status', { cache: 'no-store' })).json();
    el.innerHTML = '';
    const itens = [
      ['', s.ambiente, true],
      ['Clientes nesta mesma instância: ', s.clientes],
      ['Votos no sistema todo: ', s.votos],
      ['Servidor: ', s.servidor],
    ];
    for (const [rotulo, valor, ponto] of itens) {
      const span = document.createElement('span');
      if (ponto) { const p = document.createElement('i'); p.className = 'ponto'; span.appendChild(p); }
      span.appendChild(document.createTextNode(rotulo));
      const b = document.createElement('b');
      b.textContent = valor;
      span.appendChild(b);
      el.appendChild(span);
    }
  } catch { /* status é só informativo */ }
}
