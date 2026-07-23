// api/preco.js
// Função serverless (Vercel) que consulta a pergunta 9294 do Metabase
// (Relatório de Preços Ativos) filtrando por SKU ou nome do produto.
//
// A conta Biscoitê NÃO tem permissão de admin nessa instância do Metabase
// pra gerar uma API Key de verdade (confirmado com o suporte do Nexaas —
// mesma situação já documentada no Cloud Function do relatório 8164).
// Por isso a autenticação aqui é por SESSÃO (login/senha), no mesmo padrão
// já validado naquele pipeline: login do zero a cada execução, sem cache
// de token entre chamadas.
//
// Credenciais NUNCA ficam no front-end — vivem só nas variáveis de
// ambiente METABASE_EMAIL e METABASE_PASSWORD (Vercel > Settings >
// Environment Variables, marcadas como "Sensitive").

const METABASE_BASE_URL = "https://bi.nexaas.com";
const CARD_ID = 9294;

// Tabelas de preço por "loja". A loja "padrao" é de acesso livre; a
// "aeroporto" exige a senha em AEROPORTO_SENHA (ver checagem abaixo).
const TABELAS_POR_LOJA = {
  padrao: "TABELA 1 - PROPRIAS E FRANQUIAS PADRAO",
  aeroporto: "TABELA - AEROPORTO GRU",
};

async function loginMetabase(email, password) {
  const resp = await fetch(`${METABASE_BASE_URL}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, password }),
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Login no Metabase falhou (status ${resp.status}): ${text.slice(0, 300)}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Login retornou resposta não-JSON: ${text.slice(0, 300)}`);
  }

  if (!data.id) {
    throw new Error(`Login retornou 200 mas sem token de sessão: ${text.slice(0, 300)}`);
  }
  return data.id;
}

export default async function handler(req, res) {
  // CORS básico (ajuste o domínio quando publicar em produção)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { tipo, valor, tabela, loja, senha } = req.query;
  const lojaAtual = loja === "aeroporto" ? "aeroporto" : "padrao";

  if (!valor || !valor.trim()) {
    return res.status(400).json({ error: "Informe um SKU ou nome de produto para buscar." });
  }

  // A loja Aeroporto exige senha — validada aqui no backend também (não só
  // no front-end), pra ninguém conseguir consultar essa tabela só chamando
  // a API direto sem saber a senha.
  if (lojaAtual === "aeroporto") {
    if (!process.env.AEROPORTO_SENHA) {
      return res.status(500).json({ error: "AEROPORTO_SENHA não configurada no ambiente." });
    }
    if (!senha || senha !== process.env.AEROPORTO_SENHA) {
      return res.status(401).json({ error: "Senha da loja Aeroporto incorreta." });
    }
  }

  if (!process.env.METABASE_EMAIL || !process.env.METABASE_PASSWORD) {
    return res.status(500).json({
      error: "METABASE_EMAIL / METABASE_PASSWORD não configuradas no ambiente. Adicione essas variáveis no Vercel com as credenciais de login do Metabase.",
    });
  }

  let sessionToken;
  try {
    sessionToken = await loginMetabase(process.env.METABASE_EMAIL, process.env.METABASE_PASSWORD);
  } catch (err) {
    return res.status(401).json({ error: "Falha ao autenticar no Metabase.", details: String(err.message || err) });
  }

  const tabelaPreco = tabela && tabela.trim() ? tabela.trim() : TABELAS_POR_LOJA[lojaAtual];

  const parameters = [
    {
      type: "string/=",
      target: ["dimension", ["template-tag", "tabela_preco"]],
      value: [tabelaPreco],
    },
  ];

  if (tipo === "sku") {
    parameters.push({
      type: "string/=",
      target: ["dimension", ["template-tag", "sku"]],
      value: [valor.trim()],
    });
  } else {
    parameters.push({
      type: "string/contains",
      target: ["dimension", ["template-tag", "nome_produto"]],
      value: [valor.trim()],
      options: { "case-sensitive": false },
    });
  }

  try {
    const response = await fetch(`${METABASE_BASE_URL}/api/card/${CARD_ID}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Metabase-Session": sessionToken,
      },
      body: JSON.stringify({ parameters }),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: "Metabase retornou resposta não-JSON.", details: text.slice(0, 300) });
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.message || "Erro ao consultar o Metabase.", details: data });
    }

    const cols = (data?.data?.cols || []).map((c) => c.display_name || c.name);
    const rows = data?.data?.rows || [];

    const produtosBrutos = rows.map((row) => {
      const obj = {};
      cols.forEach((col, i) => (obj[col] = row[i]));
      return obj;
    });

    // Só mostramos SKUs com status "Ativo" — o relatório também traz
    // Rascunho/Inativo/Descontinuado, que não devem virar etiqueta.
    const produtos = produtosBrutos.filter(
      (p) => (p["Status"] || "").trim().toLowerCase() === "ativo"
    );

    return res.status(200).json({ produtos, total: produtos.length });
  } catch (err) {
    return res.status(500).json({ error: "Falha ao conectar com o Metabase.", details: String(err) });
  }
}