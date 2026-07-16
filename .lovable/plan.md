## Diagnóstico

O problema-raiz do "tela branca ao digitar + dado que some" é o mesmo do timeout: **fotos estão salvas como base64 dentro do JSON do levantamento**. Os maiores levantamentos hoje têm 10–28 MB cada, tudo em `surveys.data`.

Consequências:

- Cada `save` reserializa 20+ MB → no celular a aba trava, o React reclama, o overlay de erro aparece (tela escura) e o navegador descarta a página.
- Cada sync manda o payload inteiro pro Supabase → falha silenciosa em rede fraca (Wi-Fi caindo) → o levantamento não persiste no servidor → some depois de ~2h quando o snapshot local é sobrescrito pelo servidor.
- Não dá pra "compartilhar entre todos" de forma confiável enquanto cada foto trafega embutida.

A solução real é tirar as fotos do JSON e colocar em **Storage** (bucket dedicado), guardando só a URL no levantamento.

## Plano por fases (todas as fases de uma vez usando o máximo de créditos)

### Fase A — Fotos no Storage (a que resolve tela branca + sumiço)

1. Criar bucket `survey-photos` (privado, com policy autenticada de leitura/escrita).
2. Reescrever `attachmentFromFile` (`src/lib/attachments.ts`) para:
  - Fazer upload direto no bucket via `supabase.storage`.
  - Retornar `Attachment` com `storagePath` (novo campo) em vez de `dataUrl`.
3. Reescrever `attachmentSrc` para gerar URL assinada quando o attachment tiver `storagePath`.
4. Fallback: se o upload falhar (offline), guarda `dataUrl` temporário e enfileira um job "promote-to-storage" que roda quando voltar a rede.
5. Migração one-shot: server function que varre `surveys` existentes, sobe cada `dataUrl` pro bucket, substitui pelo `storagePath` e regrava o `data` slim. Rodar em lote de 5 levantamentos.

Resultado esperado: `surveys.data` cai de MBs para KBs. Digitação para de travar, sync deixa de dar timeout, dado não some mais.

### Fase B — Sync confiável + "puxar levantamentos de todos"

1. Trocar o load inicial paginado por um `select` só das colunas leves (`id, client_id, project_id, updated_at, data`) — agora que `data` é pequeno, volta a caber num request.
2. Realtime na tabela `surveys` já está ligado; garantir que o merge respeita `updated_at` do servidor (last-writer-wins).
3. Botão "Sincronizar agora" no `OfflineIndicator` que força flush + reload.
4. Remover a lógica de compartilhamento via token público como caminho principal — passa a ser opcional. Todo usuário autenticado vê todos os levantamentos (RLS já permite).

### Fase C — Sessão persistente (o "sumiço depois de 2h")

1. Habilitar `autoRefreshToken` + listener `onAuthStateChange` para reemitir bearer ao expirar.
2. `AuthReadyGate` no `__root.tsx`: nenhuma query roda antes de `getSession()` resolver — evita RLS retornar vazio e "apagar" a tela.
3. Persistir fila de sync no IndexedDB e reaplicar no boot.

### Fase D — Observabilidade

Log estruturado de erros de sync (tabela `sync_errors`) pra você ver no painel o que falhou em campo, sem depender de relato.

## Ordem sugerida

Começar pela **Fase A** — é a que mata os três sintomas do relato (tela branca ao digitar, levantamento que some, upload que falha) de uma vez só. As demais ficam muito mais simples depois que o payload encolhe. E aí vc segue para as próximas fases

Confirma que posso seguir com a a execução de todas as fases, todas elas em ordem e sequencial?