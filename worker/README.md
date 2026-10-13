# Worker de importação do catálogo (VPS)

Roda todo dia às **06:00 (Brasília)**: busca as ofertas na Shopee, grava no banco (Neon), arquiva o que saiu
da seleção, registra a execução em `sync_job_runs` (aparece em **Painel → Importações**) e avisa o site para
atualizar o cache (`POST /api/v1/cron/revalidate`). Substitui o cron da Vercel.

- Código: `worker/importer.ts` (usa `lib/providers/shopee/run.ts`, o mesmo da importação manual do painel).
- Imagem: `garimpo-importer:<tag>`, ~150 MB. Sem porta publicada: o worker não recebe conexões, só faz saídas.
- Memória: `--memory=512m` é suficiente.

## Variáveis (arquivo `/opt/garimpo-importer/garimpo-importer.env`, `chmod 600`)

| Variável | Obrigatória | Para quê |
|---|---|---|
| `DATABASE_URL` | sim | Mesma conexão (pooled) usada pelo site |
| `SHOPEE_AFFILIATE_APP_ID` | sim | API de afiliados da Shopee |
| `SHOPEE_AFFILIATE_APP_SECRET` | sim | idem |
| `SITE_URL` | recomendada | Endereço público do site, ex. `https://seu-dominio` |
| `CRON_SECRET` | recomendada | O **mesmo** valor definido na Vercel; autoriza o aviso ao site |
| `IMPORT_AT` | não | `HH:MM` no fuso do contêiner (padrão `06:00`) |
| `RUN_ON_START` | não | `1` roda uma importação ao subir o contêiner |
| `CONVERSIONS_EVERY_MIN` | não | Intervalo, em minutos, da sincronização de comissões (`conversionReport`); padrão `180`, `0` desliga |

Sem `SITE_URL`/`CRON_SECRET` o worker funciona igual; só que o site demora até 5 min para enxergar o catálogo novo.

## Build e execução

```bash
cd /opt/garimpo-importer/app
docker build -f worker/Dockerfile -t garimpo-importer:<tag> .
docker builder prune -af          # só o cache de build; nunca `system prune`

docker run -d --name garimpo-importer --restart unless-stopped \
  --memory=512m --stop-timeout 120 \
  --log-opt max-size=20m --log-opt max-file=5 \
  --env-file /opt/garimpo-importer/garimpo-importer.env \
  garimpo-importer:<tag>
```

Conferir sem importar nada: `docker run --rm --env-file ... garimpo-importer:<tag> node importer.mjs --check`
(valida variáveis e mostra em quantos minutos é a próxima execução).

Rodar uma importação agora e sair: `docker exec garimpo-importer node importer.mjs --once`.
Só as comissões, uma vez: `docker exec garimpo-importer node importer.mjs --conversions`.
Só a Engine, uma vez: `docker exec garimpo-importer node importer.mjs --engine` (depois de cada importação ela já roda sozinha).

## Logs e acompanhamento

`docker logs --tail 50 garimpo-importer` (uma linha JSON por evento: `worker_started`, `waiting`,
`import_started`, `import_finished`, `import_failed`, `retry_scheduled`, `site_notified`, `conversions_synced`, `conversions_failed`, `engine_ran`, `engine_failed`).
Se uma execução falha, o worker tenta de novo em 30 min e em 1 h; depois espera o dia seguinte.

## Reverter

```bash
docker stop garimpo-importer && docker rm garimpo-importer
docker run -d --name garimpo-importer ... garimpo-importer:<tag-anterior>   # mesmos parâmetros
```

Mantenha a tag anterior até a nova rodar uma importação com sucesso; só então remova a antiga
(`docker rmi garimpo-importer:<tag-antiga>`).
