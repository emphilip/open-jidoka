#!/usr/bin/env bash
# End-to-end check against a running stack (docker compose up + seed). Uses ADMIN_API_TOKEN from .env.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
API="http://localhost:${API_HOST_PORT:-3000}/api"
auth=(-H "authorization: Bearer ${ADMIN_API_TOKEN}" -H "x-openjidoka-actor: smoke-test" -H "content-type: application/json")
call() { curl -sS --fail-with-body "${auth[@]}" "$@"; }
json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=JSON.parse(s);console.log($1)})"; }
wait_status() {
  for _ in $(seq 1 60); do
    status=$(call "$API/runs/$1" | json 'v.run.status')
    [[ "$status" != running && "$status" != pending ]] && { echo "$status"; return; }
    sleep 1
  done
  echo timeout
}

echo "1) invoice-approval with placeholder connections should fail on the missing Teams secret"
wf=$(call "$API/workflows" | json "v.find(w=>w.key==='invoice-approval').id")
run=$(call -X POST "$API/workflows/$wf/runs" -d '{"input":{"document":{"text":"Invoice INV-1 from Acme, total 1250.00 CAD"}}}' | json v.id)
echo "   run $run -> $(wait_status "$run")"
call "$API/runs/$run" | json 'v.run.error'

echo "2) smoke workflow: decide -> approval task -> HTTP connector"
call -X POST "$API/connections" -d '{"name":"internal-api","type":"http","config":{"baseUrl":"http://api:3000/"}}' >/dev/null 2>&1 || true
xml=$(node -e 'process.stdout.write(JSON.stringify(require("fs").readFileSync("examples/smoke.bpmn","utf8")))')
id=$(call "$API/workflows" | json "(v.find(w=>w.key==='smoke')||{}).id||''")
[[ -z "$id" ]] && id=$(call -X POST "$API/workflows" -d "{\"key\":\"smoke\",\"name\":\"Smoke test\",\"bpmnXml\":$xml}" | json v.id)
call -X POST "$API/workflows/$id/publish" -d "{\"xml\":$xml}" | json '"   published v"+v.version'
run=$(call -X POST "$API/workflows/$id/runs" -d '{"input":{"request":"Order 5 laptops"}}' | json v.id)
for _ in $(seq 1 30); do
  task=$(call "$API/tasks" | json "(v.find(t=>t.runId==='$run')||{}).id||''")
  [[ -n "$task" ]] && break; sleep 1
done
echo "   task $task open, approving"
call -X POST "$API/tasks/$task/complete" -d '{"approved":true,"result":{"comment":"ok"}}' >/dev/null
echo "   run $run -> $(wait_status "$run")"
call "$API/runs/$run" | json 'JSON.stringify({output:v.run.output,steps:v.steps.map(s=>s.nodeId+":"+s.status)})'
