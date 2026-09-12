# Demo local segura

Esta demo no inicia el agente. No crea wallets. No lee claves. No usa red. No ejecuta comandos. No escribe archivos. No mueve dinero. No crea hijos. No modifica código.

```bash
pnpm install --frozen-lockfile
pnpm build
node dist/index.js --safe-demo
node dist/index.js --safe-demo --task "comprobar mi configuración local"
```

El comando solo muestra un informe JSON de las capacidades bloqueadas.