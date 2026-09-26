/**
 * 快捷侧边栏 - 后台脚本
 * 1. 注册右键菜单「添加到侧边栏」
 * 2. 点击工具栏图标 → 通知当前页面完全显示 / 隐藏侧边栏把手
 */

const MENU_ID = 'quick-sidebar-add';

/* ---------- 存储层：sync 优先，local 兜底（与 content.js 保持一致） ----------
 * 换电脑后登录同一账号并开启同步，数据能自己回来。
 * sync 写失败（未登录 / 配额 / 写频率）时退回 local，绝不丢数据。
 */
const DATA_KEY = 'items';
const SYNC_SOFT_LIMIT = 7000; // chrome.storage.sync 单键硬上限 8192 字节

async function loadItems() {
  try {
    const s = await chrome.storage.sync.get(DATA_KEY);
    if (Array.isArray(s[DATA_KEY])) return s[DATA_KEY];
  } catch (e) { /* sync 不可用 */ }
  try {
    const l = await chrome.storage.local.get(DATA_KEY);
    if (Array.isArray(l[DATA_KEY])) return l[DATA_KEY];
  } catch (e) { /* 都不行 */ }
  return [];
}

async function saveItems(items) {
  let serialized = '';
  try { serialized = JSON.stringify({ [DATA_KEY]: items }); } catch (e) { serialized = ''; }

  if (serialized && serialized.length <= SYNC_SOFT_LIMIT) {
    try {
      await chrome.storage.sync.set({ [DATA_KEY]: items });
      try { await chrome.storage.local.set({ [DATA_KEY]: items }); } catch (e) { /* 镜像失败不影响主流程 */ }
      return { synced: true };
    } catch (e) {
      await chrome.storage.local.set({ [DATA_KEY]: items });
      return { synced: false, error: String((e && e.message) || e) };
    }
  }

  await chrome.storage.local.set({ [DATA_KEY]: items });
  try { await chrome.storage.sync.remove(DATA_KEY); } catch (e) { /* 忽略 */ }
  return { synced: false, error: '数据超过 sync 单键 8KB 上限，仅保存在本机' };
}

function newId() {
  try {
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch (e) { /* 降级 */ }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: '添加到侧边栏',
      contexts: ['page']
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || tab?.id == null) return;

  // 优先让内容脚本提供准确信息（标题 / favicon）
  let page = null;
  try {
    page = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' });
  } catch (e) {
    // 内容脚本未注入（扩展刚装好、页面未刷新）时降级用 activeTab 提供的信息
  }

  const url = (page && page.url) || info.pageUrl || tab.url;
  if (!url || !/^https?:/i.test(url)) {
    flashBadge('!');
    return;
  }

  const item = {
    url,
    title: (page && page.title) || tab.title || hostOf(url),
    favicon: (page && page.favicon) || tab.favIconUrl || originOf(url) + '/favicon.ico'
  };

  const items = await loadItems();
  const idx = items.findIndex((i) => i.url === item.url);
  if (idx >= 0) {
    // 已存在：仅更新标题与图标，不产生重复项
    items[idx] = { ...items[idx], ...item };
  } else {
    items.push({ id: newId(), ...item });
  }
  const saved = await saveItems(items);
  if (saved && !saved.synced && saved.error) {
    // 让用户知道数据只落在本机，别以为已经同步了
    flashBadge('!');
    console.warn('[快捷侧边栏] 同步不可用，已存本机：', saved.error);
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'SHOW_TOAST', text: idx >= 0 ? '已在侧边栏中更新' : '已添加到侧边栏' });
  } catch (e) {
    // 页面无内容脚本时仅用角标反馈
  }
  flashBadge(idx >= 0 ? '↑' : '✓');
});

// 工具栏图标：完全显示 / 隐藏侧边栏
chrome.action.onClicked.addListener((tab) => {
  if (tab?.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' }).catch(() => {});
  }
});

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function flashBadge(text) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500);
}
