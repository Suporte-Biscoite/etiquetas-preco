// api/preco.js
// Função serverless (Vercel) que consulta a pergunta 9294 do Metabase
// (Relatório de Preços Ativos) filtrando por SKU ou nome do produto.
//
// A API key do Metabase NUNCA fica no front-end — ela vive apenas
// na variável de ambiente METABASE_API_KEY, configurada no painel
// do Vercel (Settings > Environment Variables).

const METABASE_URL = "https://bi.nexaas.com/api/card/9294/query";
const TABELA_PRECO_PADRAO = "TABELA 1 - PROPRIAS E FRANQUIAS PADRAO";

export default async function handler(req, res) {
  // CORS básico (ajuste o domínio quando publicar em produção)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { tipo, valor, tabela } = req.query;

  if (!valor || !valor.trim()) {
    return res.status(400).json({ error: "Informe um SKU ou nome de produto para buscar." });
  }

  if (!process.env.METABASE_API_KEY) {
    return res.status(500).json({
      error: "METABASE_API_KEY não configurada no ambiente. Gere uma API Key no Metabase (Admin > API Keys) e adicione essa variável de ambiente.",
    });
  }

  const tabelaPreco = tabela && tabela.trim() ? tabela.trim() : TABELA_PRECO_PADRAO;

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
    const response = await fetch(METABASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.METABASE_API_KEY,
      },
      body: JSON.stringify({ parameters }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.message || "Erro ao consultar o Metabase.", details: data });
    }

    const cols = (data?.data?.cols || []).map((c) => c.display_name || c.name);
    const rows = data?.data?.rows || [];

    const produtos = rows.map((row) => {
      const obj = {};
      cols.forEach((col, i) => (obj[col] = row[i]));
      return obj;
    });

    return res.status(200).json({ produtos, total: produtos.length });
  } catch (err) {
    return res.status(500).json({ error: "Falha ao conectar com o Metabase.", details: String(err) });
  }
}
