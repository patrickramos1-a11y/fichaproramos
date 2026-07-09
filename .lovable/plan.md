# Diagnóstico e Plano de Estabilização

## Diagnóstico dos 3 sintomas relatados

Investiguei `src/lib/store.ts`, `src/routes/__root.tsx`, `src/lib/error-capture.ts`, `src/lib/offlineSnapshot.ts` e o console. As três queixas têm causas técnicas identificadas e conectadas:

### 1) "Ao abrir, os dados somem / preciso recarregar várias vezes"
- `bindAuth()` roda no import do módulo (`src/lib/store.ts:752`), em paralelo com o mount dos componentes. Enquanto `initForUser` não termina, `store.db = EMPTY_DB` e telas renderizam vazio.
- Se `fetchAll` falha por token expirado/rede, o `catch` marca `hydrated: true` mesmo sem dados e mostra "Falha ao carregar dados do servidor." (visto no session replay).
- Não há gate de "auth pronta" por página — cada refresh compete com a hidratação.

### 2) "Ao digitar, ele me joga em outra tela escura e recarrega, perdendo tudo"
- Loop infinito em `useDBSelector` (`src/lib/store.ts:892-920`): o `useEffect` depende de `selector`, e componentes passam selectors inline (nova referência a cada render). Cada render dispara o effect → `setSelected` (com novo array/objeto) → novo render → loop. É exatamente o erro `Maximum update depth exceeded ... store.ts:771` que aparece repetidas vezes no console.
- Quando o loop estoura, o `errorComponent` do `__root.tsx` aparece (tela escura de erro) e o botão "Recarregar" / auto-reload de chunk-error recarrega a página, descartando o que foi digitado. `tryRecoverFromChunkError` também é chamado em todo `error`/`unhandledrejection`; embora só recarregue em chunk-error, contribui para a sensação de "recarrega sozinho".
- `persist()` é chamado a cada keystroke (ex.: `updateClient`) e emite para todos os subscribers → amplifica o loop acima.

### 3) "Salvei, mas depois de ~2h o dado sumiu"
- Token do Supabase expira ~1h. `authHeaders()` faz `getSession()` mas se o refresh silencioso falhar (aba em background, rede oscilando), a próxima `flushSync` retorna 401 e os `upsert`s falham. Como a UI mostra "salvo" (estado local), o usuário não percebe.
- Pior: no reopen, `initForUser` chama `fetchAll` autenticado; se o refresh falhar, cai no `catch` e usa o **snapshot local**. Mas o snapshot local só contém o que já foi carregado uma vez — mudanças recentes que ficaram na `sync_queue` do IndexedDB **não são reaplicadas ao `store.db` na inicialização** (o código dá `enqueueSyncOperations` mas nunca reidrata `store.db` a partir dela). Resultado: dados criados offline/em token-expirado somem visualmente até a próxima sync bem-sucedida — e se o servidor nunca recebeu, somem de vez.
- O canal realtime também cai quando o token expira e não é reassinado, então mudanças de outro dispositivo/aba não chegam.

### Observações adicionais
- `store.status.hydrated: typeof window === "undefined"` inicia `true` no servidor mas `false` no cliente — OK, mas nenhum componente espera `hydrated` antes de renderizar listas.
- `getServerSnapshot` retorna sempre `EMPTY_DB`, então SSR sempre mostra vazio → possível mismatch de hidratação em alguns lugares.
- Login "picker" usa senha fixa sintética; se algum usuário for recriado externamente, o token deixa de bater.

---

## Plano em 4 fases (uma fase por rodada)

Cada fase é auto-contida, deixa o app funcionando e não depende das próximas. Assim conseguimos parar/priorizar entre elas.

### Fase 1 — Parar o loop de render e o "escurece + recarrega" (impacto imediato na queixa #2)
Foco: eliminar as causas do `Maximum update depth` e do reload agressivo.

- Reescrever `useDBSelector` para usar `useSyncExternalStore` com um cache do último valor selecionado, dispensando `[selector]` como dependência de effect. Padrão: `useSyncExternalStoreWithSelector`-like manual.
- Adicionar `useShallowEqual` opcional e migrar chamadas conhecidas (listas de clientes/levantamentos) para o novo hook.
- Remover a chamada de `tryRecoverFromChunkError` no listener global de `error` para erros que **não** são chunk-error (mantém só em `errorComponent`). Evita reloads inesperados.
- Trocar o listener global para logar-e-suprimir apenas erros de chunk conhecidos; deixar React tratar o resto normalmente.

Critério de sucesso: digitar no formulário de cliente/levantamento por 60s sem tela de erro, sem reload, sem "Maximum update depth" no console.

### Fase 2 — Sessão persistente e refresh confiável (impacto na queixa #3, primeira metade)
Foco: garantir que o token não morra silenciosamente e que a UI reflita o estado real da sessão.

- Habilitar explicitamente `detectSessionInUrl`, `autoRefreshToken`, `persistSession`, `flowType: 'pkce'` no `createClient` (revisar `src/integrations/supabase/client.ts` — arquivo é gerado, então adicionar wrapper em `src/lib/authClient.ts` se necessário) e programar refresh proativo (a cada 45 min) via `setInterval` no root, com fallback para `visibilitychange`.
- Adicionar hook `useAuthReady()` (do padrão sugerido) e um `AuthReadyGate` no `AuthGate` do `__root.tsx` que só libera os children quando `authed === true && store.status.hydrated === true`. Enquanto isso, mostra skeleton — evita a "lista some ao abrir".
- Reassinar o canal realtime em `TOKEN_REFRESHED` e reconectar em `online` / `visibilitychange`.
- Sinalizar visualmente quando o token falha (banner "Sua sessão expirou, entre novamente") em vez de silenciosamente cair em modo offline.

Critério: deixar app aberto por 3h, voltar, ver dados carregados sem precisar recarregar; em outra aba, verificar que edições continuam sendo aceitas pelo servidor.

### Fase 3 — Persistência transacional resiliente (queixa #3, segunda metade, e perda ao recarregar)
Foco: nenhuma edição salva localmente pode sumir; toda sync tem confirmação.

- Ao inicializar (`initForUser`), **reaplicar a `sync_queue` do IndexedDB sobre o `store.db`** antes de renderizar, e só depois disparar `flushSync` para reenviar. Assim, mesmo sem servidor, o usuário vê o que digitou.
- Fazer `flushSync` retentar com backoff exponencial e marcar operações que falharem por 401 para retry após refresh (não descartar).
- Tornar `persist()` mais barato: agrupar mutações de digitação em um único `queueSync` debounced (já existe 700ms, mas aumentar para 1500ms enquanto o input tem foco) e emitir para React só quando de fato o slice mudou.
- Botão "Tentar novamente" já existe; adicionar contador visível de operações pendentes e log persistente das falhas (mostrar na aba Configurações).
- Escrever o snapshot IDB **antes** de tentar a rede, não só depois — garante que reload em qualquer instante recupere o que foi digitado.

Critério: digitar 20 campos com rede desligada, dar F5, ver tudo lá; religar rede, ver "sincronizado" sem intervenção.

### Fase 4 — Guardas de rota, foco e observabilidade (queixa #2 residual + prevenção)
Foco: eliminar redirecionamentos indesejados durante input e instrumentar para próximos bugs.

- Auditar todos os `navigate(...)` e `redirect` em `src/routes/**` — nenhum deve disparar dentro de `onChange`/`onBlur` de input. Onde houver, mover para `onSubmit`.
- Revisar `AuthGate` para não redirecionar quando `authed === undefined` (evita flash `/login`) e adicionar `replace: true` só quando necessário.
- Adicionar hook `useBlocker` (TanStack) em formulários de cliente/levantamento com dirty state, evitando navegação acidental.
- Logar eventos: `auth:signed_in`, `auth:token_refreshed`, `sync:success`, `sync:failed`, `nav:blocked-by-dirty` — imprimir em console com prefixo estruturado, para diagnóstico rápido no próximo relato.
- Escrever um smoke test manual documentado em `.lovable/QA-estabilidade.md` cobrindo os 3 sintomas.

Critério: 30 min de uso real (criar cliente → criar levantamento → preencher módulos → tirar foto) sem nenhum redirect, sem reload, com todos os dados visíveis após F5.

---

## Detalhes técnicos (para o time de engenharia)

- Arquivo principal a mexer nas fases 1 e 3: `src/lib/store.ts` (2115 linhas). Fase 2 toca `src/routes/__root.tsx` e adiciona `src/hooks/useAuthReady.ts`. Fase 4 toca `src/routes/**` e `src/components/OfflineIndicator.tsx`.
- Não alterar `src/integrations/supabase/client.ts`, `types.ts` (auto-gerados). Wrapper em `src/lib/authClient.ts` se precisar de opções extras.
- Não são necessárias novas migrations SQL — o schema atual está OK.
- Cada fase é ~1 rodada de implementação + verificação (build, console limpo, teste manual guiado).

Confirme se posso começar pela **Fase 1** (a que mata o loop e o "escurece + recarrega") — é a de maior impacto imediato e libera diagnóstico das demais.