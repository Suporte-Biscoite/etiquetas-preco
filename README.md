# Etiquetas de Preço — Biscoitê

Página web simples para buscar produtos (por nome ou SKU) na pergunta **9294**
do Metabase (Relatório de Preços Ativos) e gerar uma etiqueta em PDF pronta
pra imprimir.

## Estrutura

```
etiquetas-preco/
├── index.html        → página com formulário de busca e geração do PDF
└── api/
    └── preco.js       → função serverless que consulta o Metabase com segurança
```

A API key do Metabase fica **só no backend** (variável de ambiente). O
navegador nunca vê essa chave — ele só fala com `/api/preco`.

## Passo 1 — Gerar a API Key no Metabase

1. Entre em `bi.nexaas.com` como admin (ou peça pra quem tiver acesso admin)
2. **Admin Settings → Autenticação → API Keys → Create API Key**
3. Copie a chave gerada (só aparece uma vez)

A key precisa ter permissão de visualização na coleção **[Biscoitê] [Matriz]**
(onde está a pergunta 9294).

## Passo 2 — Deploy no Vercel

```bash
npm install -g vercel   # se ainda não tiver
cd etiquetas-preco
vercel
```

Depois do primeiro deploy, configure a variável de ambiente:

```bash
vercel env add METABASE_API_KEY
```

Cole a API key gerada no Passo 1 quando solicitado, escolha o ambiente
(Production/Preview/Development), e faça o redeploy:

```bash
vercel --prod
```

## Passo 3 — Testar

Abra a URL gerada pelo Vercel. Busque por nome (ex: "biscoito amanteigado")
ou SKU, clique em **Gerar etiqueta PDF** no produto desejado — o PDF (100mm x
60mm) é baixado automaticamente, pronto pra impressão.

## Observações

- A busca por **tabela de preço** está fixada em `TABELA 1 - PROPRIAS E
  FRANQUIAS PADRAO` (a mesma do link original). Se precisar consultar outra
  tabela, é só passar `?tabela=NOME_DA_TABELA` na URL da API
  (`api/preco.js` já aceita esse parâmetro).
- Busca por nome usa `contains` (não precisa ser exato). Busca por SKU é
  exata.
- Se a API key expirar ou for revogada, o Metabase retorna erro 401 —
  a função `api/preco.js` repassa a mensagem de erro pra tela.
