# 🚀 First Run Tests (EN)

Ten progressive tests to verify Codex Father end‑to‑end.

## Checklist

- [ ] Test 1: Connectivity
- [ ] Test 2: List files
- [ ] Test 3: Read file
- [ ] Test 4: Code analysis
- [ ] Test 5: Create file
- [ ] Test 6: Async job
- [ ] Test 7: Job status
- [ ] Test 8: Logs
- [ ] Test 9: Concurrency
- [ ] Test 10: Error handling

---

## ✅ Test 1: Connectivity

Ask in your client:

```
Please confirm the Codex Father MCP server is connected.
```

Expect: a confirmation with server status and available tools.

---

## 📂 Test 2: List files

```
Please list all .md files in the project.
```

Expect: a list of Markdown files with correct paths.

---

## 📖 Test 3: Read file

```
Please read README.md and summarize the main points.
```

Expect: content read successfully with a brief summary.

---

## 🔍 Test 4: Code analysis

```
Please analyze package.json and tell me the key dependencies.
```

Expect: correct identification and short explanation of dependencies.

---

## ✏️ Test 5: Create file

```
Create test-hello.txt at repo root with content "Hello from Codex Father!"
```

Expect: file exists and content matches. Clean up after the test if desired.

---

## ⏱️ Test 6: Async job

```
Start an async job to run "ls -la" and return the jobId.
```

Expect: a jobId and background execution.

---

## 📊 Test 7: Job status

```
Query the status of the job (jobId: <ID>).
```

Expect: running or completed with details.

---

## 📜 Test 8: Logs

```
Show execution logs for jobId <ID>.
```

Expect: logs displayed clearly.

---

## 🔀 Test 9: Concurrency

```
Start three async jobs simultaneously:
1) list *.ts  2) list *.js  3) list *.json
```

Expect: three distinct jobIds and concurrent execution.

---

## ❌ Test 10: Error handling

```
Run a non-existing command: invalid-command-xyz
```

Expect: clear error message; server should remain healthy.

---

## Interpreting results

- Pass 10/10: great — proceed to [Use Cases](use-cases/README.en.md) and [Advanced Config](configuration.en.md#advanced-configuration).
- Pass 7–9/10: basic functionality OK — check [Troubleshooting](troubleshooting.en.md) for failures.
- Pass <7/10: revisit [Configuration](configuration.en.md), verify [Installation](installation.en.md#system-requirements), then re‑run.

---

## Next steps

- [Use Cases](use-cases/README.en.md)
- [Troubleshooting](troubleshooting.en.md)
- [Advanced Config](configuration.en.md#advanced-configuration)
