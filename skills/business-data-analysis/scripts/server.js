'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = process.env.BUSINESS_DATA_HOST || '127.0.0.1';
const PORT = Number.parseInt(process.env.BUSINESS_DATA_PORT || '3000', 10);
const DATA_DIR = path.resolve(
  process.env.BUSINESS_DATA_DIR || path.join(__dirname, '..', 'data')
);
const MAX_BODY_BYTES = 50 * 1024 * 1024;

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('BUSINESS_DATA_PORT must be an integer between 1 and 65535');
}

fs.mkdirSync(DATA_DIR, { recursive: true });

function isAllowedOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && (
      url.hostname === 'creator.xiaohongshu.com' ||
      url.hostname === 'doulaoban.com' ||
      url.hostname.endsWith('.doulaoban.com')
    );
  } catch {
    return false;
  }
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body is too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function csvCell(value) {
  let normalized = value;
  if (normalized === null || normalized === undefined) normalized = '';
  if (typeof normalized === 'object') normalized = JSON.stringify(normalized);
  return `"${String(normalized).replace(/"/g, '""')}"`;
}

function xiaohongshuCsv(notes) {
  const columns = [
    ['笔记ID', 'id'], ['标题', 'title'], ['类型', 'type'], ['发布时间', 'post_time'],
    ['阅读量', 'read_count'], ['点赞数', 'like_count'], ['收藏数', 'fav_count'],
    ['评论数', 'comment_count'], ['分享数', 'share_count'], ['曝光量', 'imp_count'],
    ['平均观看时长', 'view_time_avg'], ['涨粉数', 'increase_fans_count'],
    ['封面点击率', 'coverClickRate'], ['封面URL', 'cover_url'], ['审核状态', 'audit_status'],
  ];
  const rows = notes.map((note) => columns.map(([, key]) => {
    if (key === 'type') return note[key] === 2 ? '视频' : note[key] === 1 ? '图文' : note[key];
    if (key === 'post_time' && note[key]) return new Date(note[key]).toISOString();
    return note[key];
  }));
  return toCsv(columns.map(([label]) => label), rows);
}

function genericCsv(records) {
  const headers = [...new Set(records.flatMap((record) =>
    record && typeof record === 'object' && !Array.isArray(record) ? Object.keys(record) : []
  ))];
  return toCsv(headers, records.map((record) => headers.map((key) => record[key])));
}

function toCsv(headers, rows) {
  return '\ufeff' + [
    headers.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ].join('\n');
}

function safeTimestamp(value) {
  const text = String(value ?? '');
  return /^\d{10,17}$/.test(text) ? text : String(Date.now());
}

function saveDataset(prefix, records, timestamp, csvBuilder) {
  const stamp = safeTimestamp(timestamp);
  const base = `${prefix}_${stamp}`;
  const jsonName = `${base}.json`;
  const csvName = `${base}.csv`;
  fs.writeFileSync(path.join(DATA_DIR, jsonName), JSON.stringify(records, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, csvName), csvBuilder(records));
  return { json: jsonName, csv: csvName };
}

function listFiles() {
  return fs.readdirSync(DATA_DIR)
    .filter((filename) => filename.endsWith('.json') || filename.endsWith('.csv'))
    .map((filename) => {
      const stats = fs.statSync(path.join(DATA_DIR, filename));
      return { filename, size: stats.size, created: stats.birthtime, modified: stats.mtime };
    })
    .sort((a, b) => new Date(b.modified) - new Date(a.modified));
}

async function handle(req, res) {
  setCors(req, res);

  if (req.headers.origin && !isAllowedOrigin(req.headers.origin)) {
    sendJson(res, 403, { success: false, message: 'Origin not allowed' });
    return;
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { success: true, message: '服务运行正常', dataDir: DATA_DIR });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/files') {
    sendJson(res, 200, { success: true, files: listFiles() });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/script/version') {
    sendJson(res, 200, { success: true, version: '0.1', description: '当前内置版本' });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/script/doulaoban.user.js') {
    const scriptPath = path.join(__dirname, '..', 'assets', 'doulaoban.user.js');
    const script = fs.readFileSync(scriptPath);
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Content-Length': script.length,
      'Content-Disposition': 'inline; filename="doulaoban.user.js"',
    });
    res.end(script);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/sync/xiaohongshu/notes') {
    const body = await readJson(req);
    if (!Array.isArray(body.notes)) {
      sendJson(res, 400, { success: false, message: 'notes must be an array' });
      return;
    }
    const files = saveDataset('xiaohongshu_notes', body.notes, body.timestamp, xiaohongshuCsv);
    sendJson(res, 200, { success: true, message: `成功保存 ${body.notes.length} 条数据`, files });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/sync/doulaoban/orders') {
    const body = await readJson(req);
    if (!Array.isArray(body.orders)) {
      sendJson(res, 400, { success: false, message: 'orders must be an array' });
      return;
    }
    const files = saveDataset('doulaoban_orders', body.orders, body.timestamp, genericCsv);
    sendJson(res, 200, { success: true, message: `成功保存 ${body.orders.length} 条数据`, files });
    return;
  }

  sendJson(res, 404, { success: false, message: 'Not found' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error('请求处理失败:', error);
    if (!res.headersSent) {
      sendJson(res, error.statusCode || 500, { success: false, message: error.message });
    } else {
      res.end();
    }
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用，请设置 BUSINESS_DATA_PORT 后重试。`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`商业数据采集服务已启动: http://${HOST}:${PORT}`);
  console.log(`数据目录: ${DATA_DIR}`);
});
