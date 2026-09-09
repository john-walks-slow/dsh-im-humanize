# dsh web 会话列表/会话首次加载极慢 — 根因分析

日期：2026-09-09
现象：外网访问 dsh web（dsh.johnnren.qzz.io）能列目录，但会话列表加载极慢；每个会话首次打开也慢。

## 根因

**dsh 进程的一个泄漏的子进程组存活观察者，在用一个同步 `while(treeAlive()) await sleepTick(15ms)` 循环永久轮询一个“组长已死、孤儿仍活”的进程组，持续阻塞 JS 事件循环、占满约 80% CPU。**

具体对象：进程组 **pgrp 5918**，由一条 `pnpm preview --port 4322`（i-ve-learned 项目的 astro 预览服务器）从某个 dsh 会话的 bash 工具调用启动。启动器 `pnpm`（组长 pid 5918）早已退出，剩下：
- 5920 `node /usr/bin/pnpm preview --port 4322`（PPid 1）
- 5938 `sh -c astro preview --port 4322`（PPid 5920）
- 5939 `node .../astro/bin/astro.mjs preview --port 4322`（PPid 5938）

被 init 收养、长期存活。dsh 的观察者因此**永远等不到组消失**，循环不停。

## 代码定位

`@deepseek-ai/dsh-subprocess-local/lib/index.js`：

```js
const observeTreeExit = () => {
    treeExitObservation ??= (async () => {
        while (treeAlive()) await sleepTick();   // sleepTick = setTimeout(15)
        treeExitObserved = true;
        ...
    })();
};
```

`treeAlive()` 在主子进程 `settled`（已退出）后，调 `linuxProcessGroupHasLiveMembers(pid)`：

```js
function linuxProcessGroupHasLiveMembers(processGroupId, internals = DEFAULT_INTERNALS) {
    entries = internals.readDir("/proc");              // readdir 整个 /proc
    for (const entry of entries) {
        if (!/^\d+$/.test(entry)) continue;
        const stat = readLinuxStat(internals, Number(entry));   // readFileSync(`/proc/${pid}/stat`)
        if (stat?.pgrp !== processGroupId) continue;
        matched = true;
        if (!/^[ZXx]$/.test(stat.state)) return true;          // 找到活成员才提前退出
    }
    ...
}
```

本机 `/proc` 有 **~900 个进程**。每轮扫描同步读 ~670 个 `/proc/<pid>/stat`，单轮阻塞事件循环约 **470ms**；之后 `sleepTick(15ms)` 再来一轮 —— 实测 3 秒 3357 次 stat 读、4 秒 5591 次。CPU profile：60.8% inclusive 在这条调用栈，主线程 81.8% CPU 持续。

观察者是**泄漏的 async**：`cleanup()`（index.js:910）只清定时器和 abort 监听，**不取消 `treeExitObservation`**，也没有把它绑到会话/handle 的 AbortSignal 上。组长不灭、孤儿组就在，循环永不退出，即使发起它的会话早已结束。

## 现象关联

- **会话列表慢（本地直连也要 ~12s）**：`session.list` 的服务端工作（`persistence.listArtifacts` 磁盘扫描仅 ~400ms）被这条 470ms/轮的阻塞循环反复打断，事件循环被同步 I/O 卡死，HTTP 处理器只能挤在两轮之间运行。与外网链路无关（外网只是叠加 Cloudflare 延迟，所以更显慢）。
- **会话首次加载慢**：`session.history` 要读取并 zstd 解压、解析大的会话日志（最大 17MB 压缩），同样被这条阻塞循环切片成多个 470ms 段，1 秒的活变成好几秒。
- **“能列目录”正常**：工作区/项目目录列表是轻量元数据，单次完成快，没被阻塞循环切到那么明显。
- **持续 80% CPU、dsh 累计 CPU 时间异常高**：该循环 7×24 跑。

## 修复路径

### A. 立即缓解（不改代码，5 秒生效）
重启 dsh 清空所有进程内观察者：
```
supervisorctl restart dsh
```
astro 预览服务器（PPid 1，已脱钩）不受影响，继续服务 4322 端口。
**风险**：重启会中断当前所有活跃会话/对话（包括本次）。且只要之后再用 dsh bash 工具跑长驻后台命令（nohup/`&`/dev server/守护进程），泄漏会复发。

### B. 持久部署补丁（推荐，与现有 isLoopback 补丁同模式）
patch `@deepseek-ai/dsh-subprocess-local/lib/index.js`，二选一：

**B1（最小、最安全）——给 settled 后的孤儿轮询加退避：**
把 `while (treeAlive()) await sleepTick();` 改成：当主子进程已 `settled` 时，用更长的间隔（如 5s）轮询，而非 15ms。CPU 从 80% 降到 ~10%，每 5s 一次 470ms 抖动可接受。不改变正确性（组真死时仍能检测到，只是晚一点）。

**B2（更彻底）——bounded grace：**
主子进程 `settled` 后，孤儿清理交给 init；观察者在 settled 后再轮询一个有界 grace（如 `spec.graceMs` 或固定 30s）后即认为树已退出、停止轮询。彻底消除长驻后台命令的永久轮询，但改动语义面更大，需确认 `waitForExit()` 的调用方不依赖“树真死”的精确信号。

升级 dsh 会覆盖此补丁（与 isLoopback 补丁同命运，升级前需重打）。

### C. 运维层规避
对确实要长期运行的预览/守护进程，不要直接用 dsh bash 工具前台启动，改用 supervisord 托管（本机 mihomo/cloudflared 等已是此模式），避免把进程组留在 dsh 的观察范围内。

## 置信度
>95%。CPU profile（60.8% 落在该调用栈）+ strace 突发分析（8/9 轮扫描停在 pid 5920）+ 进程组拓扑（组长 5918 死、孤儿 5920/5938/5939 活、PPid 1）三方互证。

## 验收标准
1. dsh 主线程空闲 CPU 降回个位数（`top -H -p <dsh-pid>` 主线程 %CPU < 10% 且无持续 `R`）。
2. `time curl ... /api/session.list` 本地直连 < 2s。
3. 会话首次打开 < 1s（除超大日志外）。
4. 启动一个长驻后台进程（如 `pnpm preview`）后，dsh CPU 不再随时间爬升。
