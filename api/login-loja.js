// api/login-loja.js
// Valida a senha de acesso a uma "loja" restrita (hoje só a Aeroporto GRU).
// Isso NÃO é um sistema de contas por usuário — é uma senha única
// compartilhada da loja, guardada em variável de ambiente. Serve pra evitar
// acesso casual à tabela de preço do Aeroporto, não é uma camada de
// segurança de nível bancário.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const { loja, senha } = body || {};

  if (loja !== "aeroporto") {
    return res.status(400).json({ error: "Loja inválida." });
  }

  if (!process.env.AEROPORTO_SENHA) {
    return res.status(500).json({
      error: "AEROPORTO_SENHA não configurada no ambiente. Adicione essa variável no Vercel.",
    });
  }

  if (!senha || senha !== process.env.AEROPORTO_SENHA) {
    return res.status(401).json({ error: "Senha incorreta." });
  }

  return res.status(200).json({ ok: true });
}