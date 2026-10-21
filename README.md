# Fatto News

Portal de notícias (React + TypeScript + Vite) com função serverless na Vercel que lê um feed RSS público e normaliza os dados.

## Rodar localmente
```
npm install
npm run build      # confere tipos e compila
npm test
npx vercel dev     # frontend + /api/news juntos (o `npm run dev` sozinho não serve /api)
```

## Publicar (GitHub + Vercel)
1. Suba a pasta para um repositório no GitHub (o lockfile é gerado no seu `npm install`; faça commit dele).
2. Na Vercel: Import Project, framework Vite, raiz do repositório, build `npm run build`, saída `dist`.
3. Variáveis (opcionais): ver `.env.example`.

## Fontes de notícias
A API busca dois feeds da Agência Brasil (EBC) em paralelo e junta o resultado:
- Geral: `https://agenciabrasil.ebc.com.br/feed/ultimasnoticias/feed.xml` — confirmado, está no ar.
- Esportes: `https://agenciabrasil.ebc.com.br/rss/esportes/feed.xml` — **NÃO VERIFICADO**. Segue o mesmo padrão de outros feeds confirmados da EBC (`.../rss/<editoria>/feed.xml`, visto para saúde e política), mas eu não consegui abrir essa URL específica neste ambiente sem internet. Teste com `curl -I` antes de publicar; se não existir, a função ignora esse feed sozinha (não derruba o site) e você pode trocar a URL em `api/news.ts`.
- Se quiser forçar um único feed (ex.: para testar), defina `NEWS_FEED_URL` no `.env`.

Editorias são derivadas das tags `<category>` de cada item (heurística em `src/lib/news.ts`); sem tag correspondente, a editoria fica vazia. Dentro de Esportes, itens cujo título/resumo/categoria batem com um time ou competição de futebol brasileiro ganham a tag extra "Futebol" e aparecem também na editoria `/categoria/futebol`.

"Urgente" só quando a própria fonte marca com a categoria "urgente". Imagem: só a informada pelo feed; crédito não é fornecido (campo `null`).

**Notícias populares**: não implementado. Exigiria contar acessos reais no seu próprio site (com consentimento), e isso não existe ainda — colocar um ranking sem dado real violaria a regra de não inventar métricas. Se quiser, a próxima etapa pode adicionar uma contagem simples de cliques salva no servidor.

## Não verificado / pendências
Nada foi instalado, compilado ou testado (ambiente sem internet). Pendências: rodar build/testes, gerar lockfile, ícones PNG 192/512 (o manifest usa SVG), sitemap.xml e canonical (dependem do domínio), Playwright, ESLint, "Mais lidas" (exige métricas com consentimento; seção omitida), textos legais (provisórios), pré-renderização para SEO.
