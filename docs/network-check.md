# 网络连通性测试报告

- 时间：2025-10-05T06:08:52+00:00（UTC）
- 结论：外网可用（已成功通过 HTTPS 访问 example.com）

## 测试详情

使用 `curl` 发起 HTTPS 请求并输出关键时延与状态码：

```
http=https://example.com
http_code=200
namelookup=0.002536
connect=19.802411
appconnect=19.987018
starttransfer=20.343969
total=20.980377
remote_ip=23.192.228.84
```

## 复现步骤

- 命令：
  - `curl -sS -o /dev/null -w "http=https://example.com\nhttp_code=%{http_code}\nnamelookup=%{time_namelookup}\nconnect=%{time_connect}\nappconnect=%{time_appconnect}\nstarttransfer=%{time_starttransfer}\ntotal=%{time_total}\nremote_ip=%{remote_ip}\n" https://example.com`

- 说明：
  - 若 `http_code=200` 且能得到 `remote_ip`，可判断外网连通性正常。
  - 单次耗时受网络环境波动影响，建议多次取平均。
