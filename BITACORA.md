# BITÁCORA — @conway/automaton

Registro de sesiones de trabajo. **Se actualiza al FINAL de cada sesión.**
La entrada más reciente va arriba. Regla: si no está aquí escrito, no pasó.

Cómo se rellena cada entrada:
- **Qué hicimos** — hechos, no intenciones.
- **Decisiones** — qué se decidió y por qué (para no volver a discutirlo).
- **Pendiente** — lo que queda abierto, con el siguiente paso concreto.
- **Sin confirmar** — cosas que creemos pero no hemos verificado.

---

## 2026-08-21 — Sesión 4: el bug ya está arreglado + el CI lleva muerto desde mayo

**Qué hicimos**
- Code trajo el código real de las funciones y el estado del CI/PRs. Reencuadre grande: el problema de fondo NO es el código.

**Reencuadre (lo importante)**
- **El bug del tokenizer ya está arreglado, dos veces, en PRs abiertos y parados:**
  - `#358` (OPEN, 2026-07-30, `fix/tokenizer-quadratic-hang`): "cap tokenizer input to prevent quadratic hang".
  - `#332` (OPEN, 2026-07-05, `fix/tiktoken-quadratic-tokenize-cap`): "Cap tiktoken input length in countTokens".
  - `#364` (OPEN, 2026-08-10, `fix/ci-test-filter`): arregla el filtro de tests de seguridad del CI.
- **El CI lleva sin ejecutarse desde el 30-may-2026.** El último run real (verde) fue sobre sha `871c53e` = tu HEAD actual, hace ~3 meses. Todo lo posterior son PRs de forks en `action_required` (duración 0s, nunca arrancaron). Hay 8 PRs represados.
- **Conclusión:** el cuello de botella no es técnico. El arreglo existe; no está en el código porque nadie mergea y el CI no corre. Si no resolvemos esto, seguiremos redescubriendo bugs ya resueltos.

**Correcciones al diagnóstico de la Sesión 3 (Code midió, no supuso)**
- **El encoder NO se recrea por llamada.** Es singleton a nivel de módulo (`getEncoding` dentro de `createTokenCounter`, vía singleton `tokenCounter`). La "Falla 2" (encoder recreado) queda DESCARTADA.
- **El cuelgue NO es por tamaño, es por entrada DEGENERADA.** Medido: 1000 chars de `"x"` repetida → ~400ms/llamada; 1000 de texto natural → 1ms. Factor 400x. Lo dispara la repetición (explota el merge de BPE). Con lenguaje natural es rápido y lineal. Bug de **robustez** real pero estrecho — lo dispararía base64/padding/relleno repetitivo en un tool result, NO "cualquier turno grande".

**Estado de las funciones (confirmado con código a la vista)**
- `estimateTokens` (context.ts:36) ya hace `Math.max(tiktoken, ceil(len/4))` → `len/4` es el SUELO, nunca baja de ahí. Se usa en `estimateTurnTokens` (context.ts) y `budget.trimTier` (budget.ts) → **son los guardianes del presupuesto de ventana; subestimar desborda**. También en enhanced-retriever, episodic, working.
- Hay **4 `estimateTokens` distintos** en el código (context.ts es el de tiktoken; event-stream, agent-context-aggregator, attention, workspace tienen los suyos propios). Ojo al elegir cuál se toca.
- `formatCacheKey` usa `${model}::${textoEntero}` como clave → hashea 50k por lookup y retiene copias. Arreglo: `modelo::longitud::hash`.
- **Incoherencia de fallback:** context.ts divide entre 4, context-manager entre 3.5. Unificar hacia el lado seguro (más conservador = divisor más pequeño).

**Falla a vigilar en los PRs (por la que NO se mergea a ciegas)**
- Si los PRs **capan y truncan** (tokenizar los primeros N chars y devolver eso), **subestiman** en código denso largo (~15-30% menos que lo real) — caso que hoy funciona bien porque no cuelga. Eso mete "context length exceeded" ocasional en producción.
- La versión sin filo **capa y extrapola** (muestra → ratio tok/char → extrapola al total). Hay que leer los diffs y ver cuál hacen. Revisar, no reinventar.

**Decisiones**
- NO escribir código nuevo del tokenizer hasta leer `#332` y `#358`. Si alguno es correcto (extrapola + test), se adopta/mejora en vez de duplicar.
- El meta-problema (CI muerto + PRs sin mergear) sube a prioridad: es lo que de verdad bloquea el proyecto.

**Pendiente (orden)**
- [ ] Code: leer diffs de `#358`/`#332`/`#364` (¿truncan o extrapolan?, ¿test?, ¿por qué parados?) + permisos del repo (`viewerPermission`, `isFork`, `parent`).
- [ ] Gregorio: no sabe si controla el repo → lo averigua Code (punto 3 del prompt).
- [ ] Decidir vía según permisos: mergear PRs existentes vs mantener fork parcheado vs escribir arreglo propio.
- [ ] Confirmado: los 21 fallos de path son 100% Windows local (en ubuntu no ocurren). Bajan de prioridad; se resuelven al mover la carpeta.
- [ ] Los 4 timeouts: no atribuibles sin un run de CI reciente. Investigar tras revivir el CI.
- [ ] Heredado: desfase versión raíz `0.2.1` vs CLI `0.2.0`.

**Ya confirmado**
- Los 21 path-fails = artefacto de Windows local (CI corre en ubuntu-latest).
- Encoder es singleton; cuelgue por entrada degenerada, no por tamaño.
- El arreglo del cuelgue ya existe en PRs; el bloqueo es de proceso (CI/merge), no técnico.

**Sigue sin confirmar**
- Si los PRs truncan o extrapolan (filo de subestimación).
- Permisos de Gregorio sobre el repo.
- Si el runtime arranca end-to-end contra Conway Cloud.

---

## 2026-08-21 — Sesión 3: entorno alineado al CI + re-medición + BUG de producción encontrado

**Qué hicimos**
- Alineado el entorno local al CI (Node 22 + pnpm 10.28.1). Re-medida la suite. Encontrada la causa raíz del cuelgue: es un bug de producción, no del test.

**Entorno (ya alineado al CI)**
- **Node:** v22.23.2 vía `fnm 1.39.0` (instalado con `winget --scope user`). `.node-version` = `22`, staged.
- **pnpm local:** 10.28.1 vía corepack (el shim gana al pnpm global 11.18.0 en PATH; NO hizo falta desinstalar el global).
- **pnpm del CI:** NO fija versión (`pnpm/action-setup@v4` sin `version:`) → la coge de `packageManager: pnpm@10.28.1`. Confirmado en `ci.yml` y `release.yml`.
- **Warning `onlyBuiltDependencies`:** desaparecido (arreglado al mover a `pnpm-workspace.yaml`). Aparece otro preexistente, NO regresión: `Ignored build scripts: bufferutil, utf-8-validate` (aceleradores nativos opcionales de `ws`; fallback JS funciona; añadir a `onlyBuiltDependencies` solo si se quiere el nativo).
- **better-sqlite3:** OK bajo Node 22 (binario ya era ABI 127).

**Re-medición (suite sin `context-hardening`)**
- **1588 passed / 26 failed / 1614 total** (antes con Node 25: 715 / 899 / 1614). Los 879 fallos de ABI eran ÍNTEGRAMENTE Node 25. Resueltos.
- Máquina muy lenta en I/O: collect ~847s de ~976s totales.

**Los 26 fallos restantes — desglose y naturaleza**
- **17× ENOENT ruta** percent-encoded (espacio+ñ) → mueren al mover la carpeta. Artefacto de Windows local. *(Pendiente: mover repo a `C:\dev\automaton`.)*
- **4× timeout 30s:** `Signing>signSendPayload` (tardó 84s), `ERC-8004>leaveFeedback` (203s), `Heartbeat>check_usdc_balance`, `GeneralHarness>web_fetch alias`. **Universales** (huelen a red real sin mockear). A investigar.
- **3× write_file parity:** esperaban "File written", recibieron "Blocked" con rutas POSIX (`/root`, `~`). Semántica de path en Windows.
- **2× expected false to be true:** `isProtectedFile`, `LocalWorkerPool harness`. También huele a semántica de path Windows.

**HIPÓTESIS a confirmar (no dar por hecho):** si el CI corre en Linux y está verde, los ~21 fallos de ruta/path son artefactos de Windows local y probablemente pasan en CI. Los únicos bugs universales serían `estimateTokens` + los 4 timeouts. **Pendiente: confirmar OS del CI y si está verde.**

**BUG DE PRODUCCIÓN (el cuelgue) — causa raíz**
- Aislado a `context-hardening.test.ts:113` ("summarizes old turns when budget is exceeded", 5×50.000 chars). Determinista.
- Coste está en `estimateTokens()` → `js-tiktoken` `encode()` en `src/agent/context.ts`. Medido: 1.000 chars → 1,7s; 10.000 → 48,8s; 50.000 → no termina en 200s. Escalado ~O(n²). El test mete 250.000 chars: no termina nunca.
- **Afecta al runtime real:** cualquier turno con un `thinking` grande bloquea el bucle del agente. No es solo un test.
- **Agravante** en `src/memory/context-manager.ts:127`: `formatCacheKey()` usa el TEXTO ENTERO como clave del Map de caché (hashea 50k chars por lookup y guarda copias completas).
- **Dato clave:** `estimateTokens` hace `Math.max(tokens, ceil(len/4))` y para estas entradas tiktoken devuelve exactamente `len/4` → el cálculo caro se descarta igualmente (trabajo inútil).

**Fallas detectadas sobre el diagnóstico/solución (antes de tocar código):**
- El **1,7s para 1.000 chars** canta: probablemente el **encoder de tiktoken se recrea en cada llamada** (coste fijo ~1-2s que ralentiza TODAS las llamadas, no solo las grandes). Posible 2º bug sumado.
- La solución "usar `len/4` por encima de un umbral" tiene **filo peligroso**: si `estimateTokens` alimenta el budget de la ventana de contexto, `len/4` puede **subestimar** tokens en código/unicode → desbordar la ventana en producción. Alternativa sin filo: **truncar a N chars, tokenizar la muestra y extrapolar**. Decidir según DÓNDE se use la función.
- `formatCacheKey` → hash (no texto entero), verificando colisiones y usos.
- **CI se traga el exit 124** (`ci.yml:24-25` convierte timeout en warning y sale 0) → tapa cualquier cuelgue futuro. Endurecer, pero DESPUÉS de matar los cuelgues (si no, CI rojo).

**Decisiones**
- Gestor de Node en local = **fnm**; Node fijado a 22 con `.node-version`. pnpm alineado a 10.28.1 con corepack. Local espeja CI.
- Atacar `estimateTokens` + `formatCacheKey` es tocar producción → se hace **con red** (el test de `context-hardening` es la regresión), y **tras ver el código**, no a ciegas.

**Pendiente (orden)**
- [ ] TÚ: mover repo a `C:\dev\automaton` con Code cerrado → mata los 17 ENOENT.
- [ ] TÚ: copiar esta `BITACORA.md` a la raíz del repo (Code confirma que aún NO existe allí) y commitear el staged de Fase 1 + `.node-version`.
- [ ] Code: pegar el código de `estimateTokens` (context.ts) y `formatCacheKey` (context-manager.ts) + dónde se usa `estimateTokens` + OS/estado del CI.
- [ ] Decidir arreglo definitivo de tokenización (umbral vs truncar-y-extrapolar) sin filo de subestimación.
- [ ] Investigar los 4 timeouts (¿red sin mockear?).
- [ ] Endurecer CI para NO tragarse el exit 124 (después de matar cuelgues).
- [ ] Heredado: desfase versión raíz `0.2.1` vs CLI `0.2.0`.

**Ya confirmado (baja de "sin confirmar")**
- Tests verdes reales con entorno sano: 1588/1614 (con los 26 caracterizados uno a uno).
- El cuelgue tiene causa raíz identificada y es de producción.

**Sigue sin confirmar**
- OS del CI y si está verde hoy.
- Si el runtime arranca end-to-end contra Conway Cloud.
- Alcance real del soporte Solana.

---

## 2026-08-20 — Sesión 2: estado real desde Claude Code + plan de saneamiento

**Qué hicimos**
- Claude Code devolvió el estado real del repo (`./automaton` es el git; la raíz `Brief muñeco autonomo` NO es repo).
- Diagnosticado el estado de tests, build, lockfiles y entorno. Definido plan de saneamiento ordenado.

**Estado real confirmado (ya no "sin confirmar")**
- **Git:** rama `main`, al día con `origin/main`. Working tree limpio salvo 2 untracked: `.claude-flow/` y `CONTEXTO.md`. Último commit `871c53e "Internal RL Update"` (Sigil Wen, 30-may-2026). Sin commits propios sobre el upstream.
- **Ficheros:** 129 `.ts` de código (122 en `src/`, 7 en `packages/`) + 64 `*.test.ts`. (El CONTEXTO decía 120; actualizado a 129.)
- **Tools:** 78 (`grep -c "riskLevel:" src/agent/tools.ts`). Confirma el desfase con las docs (dicen 57).
- **Build:** `pnpm build` → EXIT 0, limpio (tsc raíz + `packages/cli`). Tarda ~6 min (I/O). Warning: `pnpm.onlyBuiltDependencies` en `package.json` ya no lo lee pnpm 10 (ignorado).
- **Tests:** NO verificables en local ahora mismo. Suite no termina.
- **Lockfiles:** coexisten. `package-lock.json` (789 B) es basura (dice `automaton` v0.1.0, 1 dep `typescript`; residuo de un `npm install`). CI usa pnpm (`pnpm/action-setup@v4` + `pnpm install --frozen-lockfile`). CI matriz Node [20, 22]; security + release fijan Node 22.

**Diagnóstico de los tests (por qué no terminan)**
- **Cuelgue bloqueante:** `src/__tests__/context-hardening.test.ts` cuelga indefinido (matado a 180s sin reportar un test). Es lo que impide que `pnpm test` acabe (63/64 ficheros reportan, ese nunca) → rompe el `timeout 300 pnpm test` de CI.
- **Run parcial:** 1614 tests → 715 pasan, 899 fallan.
- **879 de los 899 = 1 solo problema de ENTORNO, no de código:** `better-sqlite3 11.10.0` compilado para NODE_MODULE_VERSION 127 (Node 22), pero Node local es **v25.9.0** (ABI 141). Todo lo que toca SQLite revienta.
- **Fallos reales NO-ABI: 20**
  - 16× ENOENT con ruta corrupta `C:\C:\Users\grego\Brief%20mu%C3%B1eco%20autonomo\...` → causa: espacio + ñ en el nombre de carpeta; los tests que leen su propio fuente no decodifican `import.meta.url`.
  - 2× timeout 30s: `Signing > signSendPayload`, `ERC-8004 > leaveFeedback rejects score 0`.
  - 1× assert real: `isProtectedFile > blocks paths in blocked directories` (expected false to be true). **OJO:** puede ser artefacto de la ruta corrupta, no bug de lógica. Confirmar con ruta limpia antes de tratarlo como fallo de seguridad.
  - `social.test.ts` tarda 167s él solo (smell de lentitud, no falla).

**Decisiones**
- **Orden de ataque = limpiar entorno ANTES de debuguear nada.** El cuelgue y el assert de `isProtectedFile` pueden ser humo del entorno (Node 25 + ruta con espacio/ñ). No se debuguean como bugs hasta re-medir en entorno limpio.
- **Node 22 en local** (nvm/fnm/volta), NO rebuild-para-Node-25. Alinea con CI, `engines >=20` y `@types/node ^20`. Node 25 es impar/no-LTS y fuera de soporte del proyecto.
- **Gestor canónico = pnpm.** Se borra `package-lock.json` y se añade a `.gitignore`.

**Plan (orden ejecutable)**
1. [ ] Node 22 en local + `pnpm install` (o `pnpm rebuild better-sqlite3`) → recompila SQLite al ABI correcto. Mata ~879 fallos.
2. [ ] Mover el repo a ruta ASCII sin espacios (ej. `C:\dev\automaton`). Mata los 16 ENOENT. (Fondo: `fileURLToPath(import.meta.url)` en esos tests, más adelante.)
3. [ ] Re-correr suite (Node 22 + ruta limpia) → cifra honesta. Ver si `context-hardening` sigue colgando y si `isProtectedFile` sigue fallando.
   - Si `context-hardening` sigue colgando → bug real: aislar con `vitest run src/__tests__/context-hardening.test.ts --reporter=verbose --no-file-parallelism`.
4. [ ] Atacar lo que quede real: 2 timeouts (signing, ERC-8004), `isProtectedFile` si persiste, y `social.test.ts` lento.

**Arreglos de higiene (independientes, hacer ya)**
- [ ] Borrar `package-lock.json` + añadirlo a `.gitignore`.
- [ ] Mover `onlyBuiltDependencies` de `package.json` a `pnpm-workspace.yaml` (quita el warning del build). Nota: en pnpm 11 esto pasó a `allowBuilds` — migrar cuando se salte a 11.
- [ ] `CONTEXTO.md` está untracked → commitearlo al repo junto con esta `BITACORA.md`.

**Pendiente heredado (aún abierto)**
- [ ] Desfase de versión: raíz `0.2.1` vs `packages/cli` `0.2.0`. Decidir si alinear a 0.2.1.

**Sigue sin confirmar**
- Nº honesto de tests verdes (hasta re-correr con Node 22 + ruta limpia).
- Estado de CI en verde/rojo hoy.
- Si el runtime arranca end-to-end contra Conway Cloud.
- Alcance real del soporte Solana (stub en `identity/wallet.ts`).

---

## 2026-08-19 — Sesión 1: arranque de memoria

**Qué hicimos**
- Retomamos el proyecto sin contexto previo guardado (no había bitácora ni chats anteriores en el proyecto).
- Revisado el estado a partir de los documentos y config cargados: `README`, `ARCHITECTURE.md`, `DOCUMENTATION.md`, `CONTEXTO.md`, `constitution.md`, `package.json`, `tsconfig`, lockfiles, `vitest`.
- Confirmado: proyecto `@conway/automaton` v0.2.1, runtime de agente autónomo en TypeScript/Node ≥20.

**Decisiones**
- Instaurar esta bitácora como memoria del proyecto para no volver a perder contexto entre sesiones.
- La actualización de la bitácora debe convertirse en paso fijo del flujo en Claude Code (donde vive el código real), no algo manual.

**Pendiente (siguiente paso concreto)**
- [ ] Meter esta `BITACORA.md` en el repo real (raíz del proyecto o `.claude/`).
- [ ] Preguntar a Claude Code el estado real del repo para rellenar los "Sin confirmar" de abajo.
- [ ] Decidir gestor de paquetes canónico: conviven `pnpm-lock.yaml` y `package-lock.json`. Elegir uno y borrar el otro.
- [ ] Resolver desfase de versión: raíz `0.2.1` vs CLI `packages/cli` `0.2.0`.

**Sin confirmar (heredado del CONTEXTO.md — requiere el código src/)**
- Nº real de tools activas (docs dicen 57; código ~78 defs).
- Nº de tests que pasan y cobertura actual.
- Estado de CI (verde/rojo) en el último commit.
- Si el runtime arranca end-to-end contra Conway Cloud hoy.
- Alcance real del soporte Solana (stub en `identity/wallet.ts`).

---
