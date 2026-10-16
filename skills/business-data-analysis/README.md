# 商业数据分析助理（business-data-analysis）

用于分析自己提供的小红书笔记、订单等 JSON/CSV 经营数据。先检查字段和数据质量，再给出指标、趋势、异常、观察、假设及优先行动。

## 在 Codex 中安装

把下面一句发送给 Codex：

```text
请使用 skill-installer 安装这个 Skill：https://github.com/symmetry-sym/huangshu/tree/main/skills/business-data-analysis
```

安装完成后，在下一轮消息中发送：

```text
使用 $business-data-analysis 分析我提供的 JSON/CSV 文件。
先检查行数、日期、缺失、重复、单位和金额口径，再分析趋势和异常。
区分数据观察与解释假设，最后列出优先行动和需要补充的数据。
本轮只分析文件，不启动采集，不操作浏览器，不对外发送报告。
```

## 完整目录

- `SKILL.md`：分析和采集工作流程。
- `agents/openai.yaml`：Codex 显示名称和默认提示词。
- `scripts/server.js`、`scripts/start-server.sh`：可选本地采集服务。
- `assets/xiaohongshu.user.js`、`assets/doulaoban.user.js`：两个平台对应的浏览器用户脚本。
- [使用手册.md](使用手册.md)：详细字段、分析任务和采集说明。

默认优先分析已经提供的文件。只有使用者明确要求采集时，才检查 Node.js 并配置本地服务；浏览器扩展安装、平台登录和账户验证由使用者完成。

不要只下载 SKILL.md，安装时需保留整个目录。此目录不包含实际经营数据、Cookie 或账户凭据。平台采集页面可能变化，未将历史脚本可用性当成当前平台采集成功的证明。

