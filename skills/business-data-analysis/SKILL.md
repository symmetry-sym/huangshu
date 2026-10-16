---
name: business-data-analysis
description: Collect and analyze the user's own Xiaohongshu creator-note or Doulaoban order data from JSON/CSV exports. Use for setting up the bundled local collector, importing exports, calculating operating metrics, finding trends, and turning results into practical business recommendations.
---

# 商业数据分析

Use this skill for two related jobs: analyze existing exports, or help the user collect data from accounts they are authorized to access. Prefer analysis of files already provided; do not start a collector or change a browser unless the user asks.

## Analyze data

1. Inspect the supplied JSON/CSV fields and determine whether the data is Xiaohongshu notes, Doulaoban orders, or another compatible operating export.
2. Validate row counts, date ranges, missing values, duplicates, units, and obvious outliers before calculating metrics. State important data limitations.
3. For Xiaohongshu, prioritize exposure, reads, cover click-through rate, interactions, average view time, follower gains, content type, topic, and publishing time. Use safe denominators and label inferred metrics such as interaction rate or follow conversion rate.
4. For orders, prioritize order count, revenue fields present in the export, customer/product concentration, status mix, time trends, refunds or cancellations when available, and any platform-specific business dimensions. Do not invent missing monetary definitions.
5. Separate observations from hypotheses. Finish with a short prioritized action list and the next data worth collecting.
6. Use spreadsheet or document tooling when the requested output needs a workbook, charts, or a formatted report.

## Set up collection

The bundled collector consists of a dependency-free local server plus two browser user scripts. It stores data locally and listens on loopback only.

1. Confirm Node.js is available.
2. Start [scripts/start-server.sh](scripts/start-server.sh). To choose a different output folder or port, set `BUSINESS_DATA_DIR` or `BUSINESS_DATA_PORT` for that invocation. Do not repurpose generic environment variables such as `HOME`.
3. Verify `http://127.0.0.1:3000/health` before collection.
4. Ask the user to install Tampermonkey from their browser's official extension store if it is not already installed. Browser-extension installation and platform login remain user-controlled unless the user directly asks for browser interaction.
5. Import only the script for the requested source:
   - Xiaohongshu creator notes: [assets/xiaohongshu.user.js](assets/xiaohongshu.user.js)
   - Doulaoban orders: [assets/doulaoban.user.js](assets/doulaoban.user.js)
6. Have the user log into the relevant platform, navigate to the list/data page, collect only their own authorized data, then export or sync it to the local server.

The server writes both JSON and CSV into `data/` inside this skill by default. Treat platform UI selectors and private endpoints as changeable; if collection fails, diagnose the current page and API shape instead of repeatedly retrying. Respect platform terms and stop if the user lacks authorization.

## Safety and privacy

- Never request, record, or expose account passwords, cookies, access tokens, or unrelated personal data.
- Do not upload collected data to third parties without the user's explicit request.
- Before sharing a report, check whether names, contact details, order identifiers, or URLs should be redacted.
- The local server accepts requests only from the bundled platforms or local tools and binds to `127.0.0.1` by default.
