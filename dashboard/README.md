# Spyre vLLM Benchmark Dashboard

A standalone React SPA that visualizes vLLM benchmark results stored in ClickHouse. Queries ClickHouse directly from the browser (no server-side proxy needed).

## Architecture

```
Browser (React SPA)
    │
    ├── Reads ClickHouse credentials from <meta> tags (injected at deploy time)
    │
    └── fetch() POST → ClickHouse HTTP API
              └── vllm_benchmarks database (results_v3 + run_metadata tables)
```

## Features

- **Time series charts** — metrics (TTFT, TPOT, throughput, latency) over time/commits
- **Commit comparison** — side-by-side metrics with red/green change indicators
- **Filters** — branch, model, metric, device
- **Raw data table** — sortable, all results
- **No sign-in required** — loads data immediately

## Local Development

```bash
# Install dependencies
npm install

# Set ClickHouse connection (for local dev)
export VITE_CH_URL=https://your-clickhouse-host
export VITE_CH_USER=default
export VITE_CH_PASSWORD=your-password
export VITE_CH_DB=vllm_benchmarks

# Run dev server
npm run dev
```

## Build

```bash
npm run build
# Output: dist/
```

## Deployment (OpenShift / Kubernetes)

### Prerequisites

- ClickHouse instance with `vllm_benchmarks` database
- Tables: `results_v3` (Tuple-based schema) and `run_metadata`
- OpenShift cluster or Kubernetes cluster with Helm

### Deploy with Helm

```bash
# Build and push image (OpenShift BuildConfig)
oc new-build --name=spyre-vllm-dashboard --binary --strategy=docker -n <namespace>
oc start-build spyre-vllm-dashboard --from-dir=. -n <namespace> --follow

# Install Helm chart
helm install spyre-vllm-dash helm/ \
  --namespace <namespace> \
  --set image="image-registry.openshift-image-registry.svc:5000/<namespace>/spyre-vllm-dashboard:latest" \
  --set clickhouse.url="https://<clickhouse-host>" \
  --set clickhouse.user="default" \
  --set clickhouse.database="vllm_benchmarks" \
  --set secrets.clickhousePassword="<password>" \
  --set route.host="<desired-route-hostname>"
```

### Upgrade

```bash
# Rebuild image after code changes
oc start-build spyre-vllm-dashboard --from-dir=. -n <namespace> --follow

# Restart deployment to pick up new image
oc rollout restart deployment/spyre-vllm-dash -n <namespace>
```

### Helm Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `image` | Dashboard container image | `""` |
| `clickhouse.url` | ClickHouse HTTPS endpoint | `""` |
| `clickhouse.user` | ClickHouse username | `default` |
| `clickhouse.database` | Database name | `vllm_benchmarks` |
| `secrets.clickhousePassword` | ClickHouse password | `""` |
| `github.clientId` | GitHub OAuth client ID (optional) | `""` |
| `route.host` | OpenShift route hostname | auto-generated |
| `route.enabled` | Create OpenShift route | `true` |
| `port` | Container port | `8080` |
| `replicas` | Pod replicas | `1` |

## ClickHouse Schema

### results_v3

```sql
CREATE TABLE results_v3 (
    timestamp     Int64,
    repo          String,
    head_branch   String,
    head_sha      String,
    workflow_id   Int64,
    model         Tuple(name String),
    metric        Tuple(name String),
    benchmark     Tuple(name String, extra_info Map(String, String)),
    runners       Tuple(name String),
    extra         Map(String, String),
    metadata_info String
) ENGINE = MergeTree()
ORDER BY (repo, head_branch, timestamp);
```

### run_metadata

```sql
CREATE TABLE run_metadata (
    timestamp       Int64,
    repo            String,
    head_branch     String,
    head_sha        String,
    workflow_id     Int64,
    benchmark_name  String,
    model_name      String,
    model_backend   String,
    metric_name     String,
    benchmark_dtype String,
    benchmark_mode  String,
    device          String,
    arch            String
) ENGINE = MergeTree()
ORDER BY (repo, head_branch, timestamp);
```

## Inserting Data

The CI workflow (`push-vllm-benchmarks-to-clickhouse.yml`) handles data ingestion automatically. For manual testing:

```sql
INSERT INTO vllm_benchmarks.results_v3 VALUES
(1780272000000, 'ibm/vllm-spyre', 'main', '<commit-sha>', <workflow-id>,
  tuple('<model-name>'),
  tuple('<metric-name>'),
  tuple('spyre_e2e_benchmark', map('device','spyre','arch','IBM Spyre','test_name','<test>')),
  tuple('spyre'),
  map('<metric-key>','<value>','value','<value>'),
  '');
```

## How It Works

1. nginx serves the built React SPA
2. An init container copies the built files and injects ClickHouse credentials into `index.html` meta tags
3. The browser reads meta tags and queries ClickHouse HTTP API directly via `fetch()`
4. No server-side proxy needed — CORS is handled by passing credentials as URL params
