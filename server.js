// EnqueteNuvem — um mini-SaaS de enquetes ao vivo, multi-inquilino (multi-tenant).
// Feito para a demonstração do seminário sobre SaaS. Sem dependências: só Node.js.
//
// Ideia central: UM único sistema, rodando em UMA instância na nuvem, atende VÁRIOS
// clientes ("inquilinos"). Cada cliente só enxerga os próprios dados, separados pela
// chave do espaço (slug). É assim que Google Workspace, Salesforce, RD Station etc.
// funcionam por baixo — em escala muito maior.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORTA = process.env.PORT || 3000;          // a nuvem (Render) informa a porta
const PASTA_PUBLICA = path.join(__dirname, 'public');
const LIMITE_PLANO_GRATIS = 200;                  // votos por enquete no plano grátis
const INICIO = Date.now();

// "Banco de dados" em memória: um Map com TODOS os inquilinos.
// chave = slug do espaço  |  valor = dados daquele cliente
const inquilinos = new Map();

function gerarSlug(nome) {
  let base = nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'espaco';
  let slug = base;
  let n = 2;
  while (inquilinos.has(slug)) slug = `${base}-${n++}`;
  return slug;
}

function criarInquilino({ nome, pergunta, opcoes }, slugFixo) {
  const slug = slugFixo || gerarSlug(nome);
  inquilinos.set(slug, {
    slug,
    nome,
    pergunta,
    opcoes: opcoes.map((texto) => ({ texto, votos: 0 })),
    plano: 'Grátis',
    criadoEm: new Date().toISOString(),
  });
  return inquilinos.get(slug);
}

// Dois clientes de exemplo, para mostrar o isolamento logo de cara
criarInquilino({
  nome: 'Faculdade Nova Roma',
  pergunta: 'Qual destes SaaS você usa com mais frequência?',
  opcoes: ['Google Drive / Docs', 'Canva', 'Spotify', 'Microsoft 365 (Teams, Word…)'],
}, 'nova-roma');
criarInquilino({
  nome: 'Padaria do Zé',
  pergunta: 'Qual pão a gente deve fazer em dobro amanhã?',
  opcoes: ['Pão francês', 'Pão de queijo', 'Sonho', 'Pão doce'],
}, 'padaria-do-ze');

// ---------- utilitários HTTP ----------
function json(res, status, dados) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(dados));
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let corpo = '';
    req.on('data', (parte) => {
      corpo += parte;
      if (corpo.length > 10_000) { reject(new Error('Corpo grande demais')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(corpo ? JSON.parse(corpo) : {}); } catch { reject(new Error('JSON inválido')); }
    });
  });
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function enviarArquivo(res, arquivo, status = 200) {
  const caminho = path.join(PASTA_PUBLICA, arquivo);
  if (!caminho.startsWith(PASTA_PUBLICA)) return json(res, 403, { erro: 'Proibido' });
  fs.readFile(caminho, (erro, conteudo) => {
    if (erro) return json(res, 404, { erro: 'Não encontrado' });
    res.writeHead(status, { 'Content-Type': TIPOS[path.extname(caminho)] || 'application/octet-stream' });
    res.end(conteudo);
  });
}

function resumo(inq) {
  const total = inq.opcoes.reduce((s, o) => s + o.votos, 0);
  return {
    slug: inq.slug,
    nome: inq.nome,
    pergunta: inq.pergunta,
    opcoes: inq.opcoes,
    total,
    plano: inq.plano,
    limite: LIMITE_PLANO_GRATIS,
  };
}

function texto(v, min, max) {
  return typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
}

// ---------- rotas ----------
const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const partes = url.pathname.split('/').filter(Boolean);

  try {
    // Status da instância: prova de que é UM servidor atendendo VÁRIOS clientes
    if (req.method === 'GET' && url.pathname === '/api/status') {
      const host = req.headers.host || '';
      const naNuvem = Boolean(process.env.RENDER) || host.endsWith('.onrender.com');
      let votos = 0;
      for (const inq of inquilinos.values()) votos += inq.opcoes.reduce((s, o) => s + o.votos, 0);
      return json(res, 200, {
        clientes: inquilinos.size,
        votos,
        ambiente: naNuvem ? 'Nuvem (Render)' : 'Computador local',
        servidor: os.hostname(),
        node: process.version,
        no_ar_ha_segundos: Math.round((Date.now() - INICIO) / 1000),
      });
    }

    // Criar um novo cliente (inquilino) = "assinar" o SaaS
    if (req.method === 'POST' && url.pathname === '/api/espacos') {
      const { nome, pergunta, opcoes } = await lerCorpo(req);
      const lista = Array.isArray(opcoes) ? opcoes.map((o) => String(o).trim()).filter(Boolean) : [];
      if (!texto(nome, 2, 60)) return json(res, 400, { erro: 'Nome deve ter de 2 a 60 caracteres.' });
      if (!texto(pergunta, 3, 140)) return json(res, 400, { erro: 'Pergunta deve ter de 3 a 140 caracteres.' });
      if (lista.length < 2 || lista.length > 6) return json(res, 400, { erro: 'Informe de 2 a 6 opções.' });
      if (lista.some((o) => o.length > 60)) return json(res, 400, { erro: 'Cada opção pode ter até 60 caracteres.' });
      if (inquilinos.size >= 500) return json(res, 503, { erro: 'Limite de espaços da demo atingido.' });
      const inq = criarInquilino({ nome: nome.trim(), pergunta: pergunta.trim(), opcoes: lista });
      return json(res, 201, resumo(inq));
    }

    // Dados de UM cliente: só devolve o que pertence àquele slug
    if (partes[0] === 'api' && partes[1] === 'espacos' && partes[2]) {
      const inq = inquilinos.get(partes[2]);
      if (!inq) return json(res, 404, { erro: 'Espaço não encontrado.' });

      if (req.method === 'GET' && partes.length === 3) return json(res, 200, resumo(inq));

      if (req.method === 'POST' && partes[3] === 'votos') {
        const { indice } = await lerCorpo(req);
        const i = Number(indice);
        if (!Number.isInteger(i) || i < 0 || i >= inq.opcoes.length) {
          return json(res, 400, { erro: 'Opção inválida.' });
        }
        if (resumo(inq).total >= LIMITE_PLANO_GRATIS) {
          return json(res, 402, { erro: `Limite do plano Grátis (${LIMITE_PLANO_GRATIS} votos) atingido.` });
        }
        inq.opcoes[i].votos += 1;
        return json(res, 200, resumo(inq));
      }
    }

    // Páginas
    if (req.method === 'GET') {
      if (url.pathname === '/') return enviarArquivo(res, 'index.html');
      if (partes[0] === 't' && partes[1] && partes.length === 2) return enviarArquivo(res, 'votar.html');
      if (partes[0] === 't' && partes[1] && partes[2] === 'painel') return enviarArquivo(res, 'painel.html');
      if (partes.length === 1 && TIPOS[path.extname(partes[0])]) return enviarArquivo(res, partes[0]);
    }

    return json(res, 404, { erro: 'Rota não encontrada.' });
  } catch (erro) {
    return json(res, 400, { erro: erro.message });
  }
});

servidor.listen(PORTA, () => {
  console.log(`EnqueteNuvem no ar na porta ${PORTA} — ${inquilinos.size} clientes carregados`);
});
