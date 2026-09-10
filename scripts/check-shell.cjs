#!/usr/bin/env node
/**
 * FE-01 小程序空壳静态校验。
 *
 * 只依赖 Node 内置模块，校验：
 *   1. 仓库内全部 .json 可被严格解析；
 *   2. 五个 Tab 页各具备 .js/.json/.wxml/.wxss 四件套（共 20 个文件）；
 *   3. tabBar 五项的数量、顺序、文案与页面路径；
 *   4. 启动页为 pages/home/home；
 *   5. 代码与配置中无 pages/index、pages/logs、utils/util 残留引用。
 *
 * 残留引用扫描跳过 .git、构建目录与 Markdown 文档——文档允许在说明中提及
 * 已删除的旧路由，这不是缺陷。
 *
 * 用法：node scripts/check-shell.cjs
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'miniprogram_npm', 'dist', 'build', 'target']);

// 旧路由只在代码与配置中有害；Markdown 里出现属于正常说明。
const STALE_ROUTE_PATTERNS = [
  { label: 'pages/index', regex: /pages\/index/g },
  { label: 'pages/logs', regex: /pages\/logs/g },
  { label: 'utils/util', regex: /utils\/util/g }
];
const TEXT_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.json', '.wxml', '.wxss', '.wxs', '.ts']);

const EXPECTED_TABS = [
  { pagePath: 'pages/home/home', text: '首页' },
  { pagePath: 'pages/category/category', text: '分类' },
  { pagePath: 'pages/publish/publish', text: '发布' },
  { pagePath: 'pages/messages/messages', text: '消息' },
  { pagePath: 'pages/profile/profile', text: '我的' }
];
const PAGE_EXTENSIONS = ['.js', '.json', '.wxml', '.wxss'];
const START_PAGE = 'pages/home/home';

const failures = [];
let checks = 0;

function check(label, run) {
  checks += 1;
  try {
    const detail = run();
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } catch (failure) {
    failures.push(label);
    console.log(`FAIL  ${label} — ${failure.message}`);
  }
}

function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), visit);
    } else if (entry.isFile()) {
      visit(path.join(dir, entry.name));
    }
  }
}

function relative(absolute) {
  return path.relative(ROOT, absolute).split(path.sep).join('/');
}

function readJson(absolute) {
  const raw = fs.readFileSync(absolute, 'utf8').replace(/^﻿/, '');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${relative(absolute)} 不是合法 JSON：${error.message}`);
  }
}

const app = readJson(path.join(ROOT, 'app.json'));

check('全部 .json 严格解析', () => {
  const files = [];
  walk(ROOT, (file) => {
    if (path.extname(file) === '.json') files.push(file);
  });
  for (const file of files) readJson(file);
  return `${files.length} 个文件`;
});

check('五个 Tab 页四件套（20 个文件）', () => {
  const pages = app.pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error('app.json 的 pages 缺失或为空');
  }
  const missing = [];
  for (const page of pages) {
    for (const extension of PAGE_EXTENSIONS) {
      const candidate = path.join(ROOT, `${page}${extension}`);
      if (!fs.existsSync(candidate)) missing.push(`${page}${extension}`);
    }
  }
  if (missing.length > 0) throw new Error(`缺少页面文件：${missing.join(', ')}`);
  const created = pages.length * PAGE_EXTENSIONS.length;
  if (created !== 20) throw new Error(`页面文件总数为 ${created}，预期 20（五个页面 × 四件套）`);
  return `${pages.length} 个页面 × 4 = ${created}`;
});

check('tabBar 数量、顺序与文案', () => {
  const list = app.tabBar && app.tabBar.list;
  if (!Array.isArray(list)) throw new Error('app.json 缺少 tabBar.list');
  if (list.length !== EXPECTED_TABS.length) {
    throw new Error(`tabBar 项数为 ${list.length}，预期 ${EXPECTED_TABS.length}`);
  }
  EXPECTED_TABS.forEach((expected, index) => {
    const actual = list[index];
    if (actual.pagePath !== expected.pagePath || actual.text !== expected.text) {
      throw new Error(
        `第 ${index + 1} 项为 ${actual.pagePath}/${actual.text}，预期 ${expected.pagePath}/${expected.text}`
      );
    }
  });
  return EXPECTED_TABS.map((tab) => tab.text).join(' / ');
});

check('启动页为首页 Tab', () => {
  if (app.pages[0] !== START_PAGE) {
    throw new Error(`pages[0] 为 ${app.pages[0]}，预期 ${START_PAGE}`);
  }
  return START_PAGE;
});

check('tabBar 路径均已在 pages 中声明', () => {
  const declared = new Set(app.pages);
  const undeclared = app.tabBar.list
    .map((tab) => tab.pagePath)
    .filter((pagePath) => !declared.has(pagePath));
  if (undeclared.length > 0) throw new Error(`未在 pages 中声明：${undeclared.join(', ')}`);
  return '全部命中';
});

check('无旧路由残留引用', () => {
  const self = relative(__filename);
  const hits = [];
  walk(ROOT, (file) => {
    const extension = path.extname(file);
    if (!TEXT_EXTENSIONS.has(extension)) return;
    if (relative(file) === self) return;
    const content = fs.readFileSync(file, 'utf8');
    for (const { label, regex } of STALE_ROUTE_PATTERNS) {
      const matches = content.match(regex);
      if (matches) hits.push(`${relative(file)} → ${label} ×${matches.length}`);
    }
  });
  if (hits.length > 0) throw new Error(`发现 ${hits.length} 处：${hits.join('; ')}`);
  return '0 处';
});

console.log('');
if (failures.length > 0) {
  console.error(`${failures.length}/${checks} 项失败：${failures.join('、')}`);
  process.exit(1);
}
console.log(`${checks}/${checks} 项通过`);
