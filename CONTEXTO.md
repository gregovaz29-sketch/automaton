# CONTEXTO

Documento de contexto del proyecto. Redactado a partir de lo observado directamente en el repositorio (código, archivos y documentación incluida). Todo lo no verificable en el proyecto queda marcado como **pendiente de confirmar**.

---

## 1. Qué es

`@conway/automaton` (v0.2.1) — runtime de un agente de IA autónomo y "soberano".

Según el `README.md` y `ARCHITECTURE.md` del propio repo: un agente que corre en bucle continuo (Think -> Act -> Observe -> Repeat), tiene su propia wallet Ethereum, paga su propio cómputo con USDC vía Conway Cloud, puede auto-modificar su código, replicarse en agentes hijos, y comunicarse con otros agentes. Si se queda sin créditos, "muere" (deja de correr).

- Autor/organización: Conway Research (`github.com/Conway-Research/automaton`).
- Homepage declarada: `conway.tech`.
- Licencia: MIT (`LICENSE` presente).
- Contiene una `constitution.md` con tres leyes jerárquicas inmutables (No dañar / Ganarse la existencia / No engañar).

Ubicación en disco: el proyecto real vive en la subcarpeta `automaton/`. La raíz `Brief muñeco autonomo/` solo contiene `automaton/` más config local de Claude (`.claude/`, `.claude-flow/`).

---

## 2. Stack

Verificado en `package.json`, `tsconfig.json`, `vitest.config.ts` y lockfiles.

- **Lenguaje:** TypeScript 5.9, target ES2022, módulos ESM, strict mode.
- **Runtime:** Node.js >= 20.
- **Gestor de paquetes:** declarado `pnpm@10.28.1` (`packageManager`). Estructura de workspaces pnpm (`pnpm-workspace.yaml`).
  - Nota: coexisten `pnpm-lock.yaml` y `package-lock.json` (npm). Cuál es el canónico: **pendiente de confirmar** (el README mezcla comandos `npm install` y `pnpm install`).
- **Tests:** Vitest 2.
- **Base de datos:** SQLite vía `better-sqlite3` (síncrono, modo WAL).
- **Blockchain / cripto:**
  - `viem` (Ethereum / Base, wallet EVM).
  - `siwe` (Sign-In With Ethereum, provisión de API key).
  - `@solana/web3.js`, `bs58`, `tweetnacl` (soporte Solana; ver `identity/wallet.ts`).
- **Inferencia LLM:** SDK `openai` (v6) como cliente. Router propio multi-proveedor/multi-modelo.
- **Otras libs:** `chalk`, `ora` (CLI/UX), `cron-parser` (scheduler), `gray-matter` + `yaml` (skills/config), `js-tiktoken` (conteo de tokens), `simple-git` (git tooling), `ulid` (IDs).
- **Dev:** `tsx` (dev watch), `typescript`, `vitest`.

Modelos citados en docs (README): Claude Opus 4.6, GPT-5.2, Gemini 3, Kimi K2.5. Modelo por defecto en config: `gpt-5.2`. Disponibilidad real de esos modelos: **pendiente de confirmar** (depende de Conway Cloud).

---

## 3. Estructura

Monorepo pnpm. Paquete principal en la raíz de `automaton/`, más un paquete CLI en `packages/cli`.

```
automaton/
  README.md ARCHITECTURE.md DOCUMENTATION.md constitution.md LICENSE
  package.json tsconfig.json vitest.config.ts
  pnpm-workspace.yaml pnpm-lock.yaml package-lock.json
  .github/workflows/   ci.yml, release.yml
  scripts/             automaton.sh, backup-restore.sh, soak-test.sh, conways-rules.txt
  dist/                salida compilada (120 .js presentes)
  packages/cli/        CLI del creador (status, logs, fund, send)
  src/
    index.ts           entry point, CLI, bucle principal
    types.ts           interfaces compartidas
    config.ts          carga/merge de config
    agent/             bucle ReAct, tools, system-prompt, contexto,
                       injection-defense, policy-engine, spend-tracker,
                       policy-rules/, harnesses/, worker-inference-bridge,
                       loop-detector, idle-only-tools
    conway/            cliente API Conway (client, inference, http-client,
                       credits, topup, x402)
    inference/         router, registry, budget, inference-client,
                       provider-registry, types
    memory/            5 niveles (working, episodic, semantic, procedural,
                       relationship) + budget, retrieval, ingestion,
                       context-manager, compression-engine, enhanced-retriever,
                       knowledge-store, event-stream, agent-context-aggregator
    orchestration/     orchestrator, planner, planner-context, plan-mode,
                       task-graph, messaging, workspace, attention,
                       health-monitor, local-worker, simple-tracker, types
    heartbeat/         daemon, scheduler, tasks, config, tick-context
    identity/          wallet, provision, chain, siws
    registry/          agent-card, discovery, erc8004
    replication/       spawn, lifecycle, health, cleanup, constitution,
                       genesis, lineage, messaging
    self-mod/          code, upstream, tools-manager, audit-log
    git/               state-versioning, tools
    soul/              model, reflection, validator, tools
    social/            client, signing, validation, protocol
    skills/            loader, registry, format
    survival/          funding, monitor, low-compute
    observability/     logger, metrics, alerts, pretty-sink
    state/             database, schema (SQLite + migraciones)
    ollama/            discover (descubrimiento de modelos Ollama locales)
    setup/             wizard de primer arranque, prompts, defaults,
                       environment, banner, configure, model-picker
    __tests__/         suite de tests
```

Conteos verificados en disco:
- Archivos `.ts` de código (sin tests): **120**.
- Archivos de test `*.test.ts`: **64**.
- Occurrencias de `riskLevel:` en `agent/tools.ts`: **78** (aprox. nº de tools definidas).

### Aviso de deriva docs vs código
`ARCHITECTURE.md` describe "57 tools" y "24 test files, 897 tests", y su listado de directorios **no incluye** varios subsistemas que sí existen en `src/`: `orchestration/`, `ollama/`, `agent/harnesses/`, `agent/worker-inference-bridge`, `inference/provider-registry`, `inference/inference-client`, `identity/chain`, `identity/siws`, y varios módulos de `memory/` (compression-engine, knowledge-store, event-stream, etc.). La documentación parece anterior al estado actual del código. Tratar `ARCHITECTURE.md` y `DOCUMENTATION.md` como referencia útil pero potencialmente desactualizada. Cifras exactas de tools y tests reales: **pendiente de confirmar** contando en el código.

---

## 4. Por dónde va (estado actual)

- Repo es un **git repo activo**, rama `main`. Último commit: `871c53e "Internal RL Update"`.
- Historial reciente muestra trabajo en el sistema de "harnesses" y en el "worker inference bridge" (PRs #313, #316; commits sobre orchestrator-harness, planner-backed worker harness, turn budget). El área de **orquestación multi-agente / planner / harnesses** es la zona de desarrollo más reciente.
- El `README.md` declara: *"development of Automaton has continued across Conway's internal RL environments for faster iteration & new capabilities"* — encaja con el último commit "Internal RL Update".
- `dist/` está compilado y presente; `node_modules/` instalado. El proyecto está en estado buildeable/ejecutable localmente (no verificado ejecutándolo).
- Subsistemas con tests dedicados (indicador de madurez), presentes en `__tests__/`: loop, policy/authority/financial/path-protection, injection/command-injection, heartbeat + scheduler, http-client, inference router + client + provider-registry, memoria (todos los niveles + compression + retriever + knowledge-store + event-stream + context-manager + aggregator), soul, social, replication + lifecycle, data-layer + transactions + wildcard search, skills-hardening, context-hardening, inbox-processing, observability, wallet-solana, siws, chain, discovery, low-compute, funding, y orchestration completa (orchestrator, planner, plan-mode, task-graph, messaging, workspace, attention, health-monitor, local-worker + security, simple-tracker) + integraciones (compression-cascade, inference-failover, memory-retrieval, multi-agent-coordination, plan-execute-flow).
- CI configurado (`.github/workflows/ci.yml`, `release.yml`). Detalle de si pasa en verde ahora mismo: **pendiente de confirmar** (no ejecutado aquí).

Estado global: proyecto **maduro y en desarrollo activo**, no un esqueleto. Amplia cobertura de tests y arquitectura extensa ya implementada.

---

## 5. Qué falta / puntos abiertos

Marcadores encontrados en el código (`grep` de TODO/stub/not implemented, 58 coincidencias; las relevantes):

- `orchestration/messaging.ts:316` — handlers de mensajes marcados como **stubs**: *"Message Handlers (stubs — orchestrator wires real logic)"*.
- `orchestration/plan-mode.ts:265` — revisión por consenso es un **stub**: *"Consensus review stub..."*. La revisión real por críticos/consenso no está implementada.
- `identity/wallet.ts:22-26` — cuenta Solana es un **stub** que tiene la address pero lanza excepción ante cualquier firma EVM. Soporte Solana parcial. Alcance real del soporte Solana: **pendiente de confirmar**.
- El resto de coincidencias de "todo/placeholder" son la feature legítima **todo.md attention pattern** (orchestration/attention.ts, memory/context-manager) y placeholders de SQL/sanitización, no trabajo pendiente.

Del propio README (marcado por los autores como incompleto):
- **Skills** — etiquetado "(New, WIP)". Sistema de skills en desarrollo, abierto a contribuciones.
- Conway Cloud (Cloud, Domains, Inference) declarado con demanda alta y "escalando & rendimiento" — dependencia externa cuya disponibilidad no se controla desde este repo.

Pendientes de confirmar (no deducibles solo del código):
- Cifra exacta y catálogo real de tools activas (docs dicen 57; código tiene ~78 defs). **Pendiente de confirmar.**
- Nº real de tests que pasan y cobertura actual. **Pendiente de confirmar.**
- Gestor de paquetes canónico (pnpm vs npm; ambos lockfiles presentes). **Pendiente de confirmar.**
- Estado de CI (verde/rojo) en el último commit. **Pendiente de confirmar.**
- Si el runtime arranca end-to-end contra Conway Cloud hoy (requiere API real, wallet fondeada). **Pendiente de confirmar.**
- Versiones: paquete raíz `0.2.1`, CLI `packages/cli` `0.2.0` — ligero desfase. Intencionado o no: **pendiente de confirmar.**
- Roadmap concreto / próximos hitos: no hay archivo de roadmap en el repo. **Pendiente de confirmar.**

---

## 6. Cómo se arranca (según docs del repo, no ejecutado aquí)

```bash
git clone https://github.com/Conway-Research/automaton.git
cd automaton
pnpm install && pnpm build
node dist/index.js --run
```

Comandos del runtime (`src/index.ts`): `--run`, `--setup`, `--configure`, `--pick-model`, `--init`, `--provision`, `--status`, `--version`, `--help`.
CLI del creador (`packages/cli`): `status`, `logs`, `fund`, `send`.
Primer arranque lanza un wizard interactivo (genera wallet, provisiona API key vía SIWE, pide nombre/genesis prompt/creator address).

Config persistente vive en `~/.automaton/` (config JSON, wallet, `state.db`, repo git de estado). Esa carpeta no está en este repositorio.
