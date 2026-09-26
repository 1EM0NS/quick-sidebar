/**
 * 快捷侧边栏 - 内容脚本（自动收起版）
 * 三态：
 *   handle   平时：右侧边缘半透明小把手（约 22px 宽，几乎不挡内容）
 *   strip    悬停把手：滑出 48px 图标条（对应 Edge 收起态）
 *   expanded 点展开按钮：变 300px 详情面板（搜索 / 编辑 / 删除 / 拖拽排序）
 * 鼠标移开 0.6s 自动收回 handle；工具栏图标可完全隐藏整个侧边栏。
 * 样式经 Shadow DOM 隔离，不影响网页本身。
 */
(() => {
  if (window.__quickSidebarLoaded) return;
  window.__quickSidebarLoaded = true;

  // 无 favicon 时的占位图（地球线框 SVG）
  const FALLBACK_ICON =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18 14.5 14.5 0 0 1 0-18"/></svg>'
    );

  const CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; }

    /* 边缘把手 */
    .handle {
      position: fixed; right: 0; top: 50%; transform: translateY(-50%);
      width: 22px; height: 92px; padding: 0;
      border: none; border-radius: 10px 0 0 10px;
      background: rgba(17, 24, 39, 0.55); color: #fff;
      backdrop-filter: blur(6px);
      cursor: pointer; font-size: 14px; line-height: 1;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s, opacity 0.2s, transform 0.2s;
    }
    .handle:hover { background: rgba(37, 99, 235, 0.9); }
    .handle.hide { opacity: 0; pointer-events: none; transform: translate(100%, -50%); }

    /* 侧边栏主体 */
    .bar {
      position: fixed; top: 0; right: 0; height: 100%; width: 48px;
      background: rgba(255, 255, 255, 0.97);
      backdrop-filter: blur(10px);
      border-left: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow: -2px 0 14px rgba(0, 0, 0, 0.12);
      display: flex; flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.18s ease, width 0.18s ease;
      overflow: hidden;
    }
    .bar.open { transform: none; }
    .bar.expanded { width: 300px; }

    .header { display: flex; align-items: center; gap: 8px; padding: 10px; border-bottom: 1px solid rgba(0, 0, 0, 0.06); flex-shrink: 0; }
    .header.center { justify-content: center; padding: 10px 4px; }
    .title { font-size: 13px; font-weight: 600; color: #111827; white-space: nowrap; }
    .search {
      flex: 1; min-width: 0; height: 28px;
      border: 1px solid #d1d5db; border-radius: 6px;
      padding: 0 8px; font-size: 12px; outline: none; background: #fff; color: #111827;
    }
    .search:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15); }

    .btn {
      width: 30px; height: 30px; flex-shrink: 0;
      border: none; background: transparent; border-radius: 6px;
      cursor: pointer; font-size: 14px; line-height: 1; color: #374151;
      display: flex; align-items: center; justify-content: center;
    }
    .btn:hover { background: #e5e7eb; }

    /* 图标条（strip 态） */
    .strip {
      flex: 1; overflow-y: auto; overflow-x: hidden;
      padding: 8px 4px; display: flex; flex-direction: column; align-items: center; gap: 4px;
    }
    .strip::-webkit-scrollbar { width: 0; }
    .iconbtn {
      width: 40px; height: 40px; flex-shrink: 0;
      border: none; background: transparent; border-radius: 8px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .iconbtn:hover { background: #e5e7eb; }
    .iconbtn img { width: 20px; height: 20px; border-radius: 4px; }

    /* 详情列表（expanded 态） */
    .list { flex: 1; overflow-y: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
    .list::-webkit-scrollbar { width: 6px; }
    .list::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }

    .card {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px; border-radius: 8px; cursor: pointer;
      border: 1px solid transparent; flex-shrink: 0;
    }
    .card:hover { background: #f3f4f6; }
    .card.dragging { opacity: 0.4; }
    .card.dragover { border-color: #3b82f6; background: #eff6ff; }
    .card-icon { width: 20px; height: 20px; flex-shrink: 0; border-radius: 4px; }
    .card-info { flex: 1; min-width: 0; }
    .card-title { font-size: 13px; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-url { font-size: 11px; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
    .card-actions { display: none; gap: 2px; flex-shrink: 0; }
    .card:hover .card-actions { display: flex; }
    .act {
      width: 24px; height: 24px; border: none; background: transparent; border-radius: 5px;
      cursor: pointer; font-size: 12px; color: #6b7280;
      display: flex; align-items: center; justify-content: center;
    }
    .act:hover { background: #e5e7eb; color: #111827; }
    .act-del:hover { color: #dc2626; }
    .act-ok:hover { color: #16a34a; }

    .edit { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
    .input { width: 100%; height: 26px; border: 1px solid #d1d5db; border-radius: 6px; padding: 0 8px; font-size: 12px; outline: none; }
    .input:focus { border-color: #3b82f6; }
    .edit-btns { display: flex; gap: 4px; }

    .empty { padding: 28px 16px; font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.9; white-space: pre-line; }

    /* 展开态底栏：账号同步状态 + 导出 / 导入备份 */
    .footer {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 10px; border-top: 1px solid rgba(0, 0, 0, 0.06);
      flex-shrink: 0;
    }
    .status {
      flex: 1; min-width: 0; font-size: 11px; color: #9ca3af;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .status.ok { color: #16a34a; }
    .status.warn { color: #d97706; }

    /* 顶部提示气泡 */
    .toast {
      position: fixed; top: 20px; left: 50%;
      transform: translateX(-50%) translateY(-8px);
      background: rgba(17, 24, 39, 0.92); color: #fff;
      font-size: 13px; padding: 8px 16px; border-radius: 999px;
      opacity: 0; pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s ease;
    }
    .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  `;

  const state = {
    items: [], // { id, title, url, favicon }
    enabled: true, // 工具栏开关：完全显示 / 隐藏
    mode: 'handle', // 'handle' | 'strip' | 'expanded'
    dragActive: false
  };

  let hostEl = null;
  let shadow = null;
  let closeTimer = null;
  let hovering = false;
  let toastTimer = null;

  /* ---------- 基础工具 ---------- */

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  /* ---------- 生成稳定 id ----------
   * 注意：http:// 页面不是安全上下文，crypto.randomUUID 可能不存在，
   * 所以这里必须有降级实现，否则在普通 http 网站上会直接抛错。 */
  function newId() {
    try {
      if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    } catch (e) { /* 降级 */ }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  /* ---------- 存储层：sync 优先，local 兜底 ----------
   * 目标：换电脑后登录同一账号并开启同步，数据能自己回来。
   * 规则：
   *   1) 读：先读 sync，为空再读 local（自动兼容老版本留在本地的数据）
   *   2) 写：优先写 sync 并镜像一份到 local；sync 失败就只写 local，绝不丢数据
   *   3) 超过 sync 单键 8KB 上限时只留本地，并清掉 sync 里的旧副本避免两边不一致
   */
  const DATA_KEY = 'items';
  const SYNC_SOFT_LIMIT = 7000; // chrome.storage.sync 单键硬上限 8192 字节，留余量

  async function loadItems() {
    try {
      const s = await chrome.storage.sync.get(DATA_KEY);
      if (Array.isArray(s[DATA_KEY])) return s[DATA_KEY];
    } catch (e) { /* sync 不可用：未登录 / 被策略关闭 / 超配额 */ }
    try {
      const l = await chrome.storage.local.get(DATA_KEY);
      if (Array.isArray(l[DATA_KEY])) return l[DATA_KEY];
    } catch (e) { /* 都不行就返回空 */ }
    return [];
  }

  // 返回 { synced:boolean, error?:string }
  async function saveItems(items) {
    let serialized = '';
    try { serialized = JSON.stringify({ [DATA_KEY]: items }); } catch (e) { serialized = ''; }

    if (serialized && serialized.length <= SYNC_SOFT_LIMIT) {
      try {
        await chrome.storage.sync.set({ [DATA_KEY]: items });
        try { await chrome.storage.local.set({ [DATA_KEY]: items }); } catch (e) { /* 镜像失败不影响主流程 */ }
        return { synced: true };
      } catch (e) {
        // sync 写失败（配额 / 写频率 / 未登录）→ 绝不丢数据
        await chrome.storage.local.set({ [DATA_KEY]: items });
        return { synced: false, error: String((e && e.message) || e) };
      }
    }

    await chrome.storage.local.set({ [DATA_KEY]: items });
    try { await chrome.storage.sync.remove(DATA_KEY); } catch (e) { /* 忽略 */ }
    return { synced: false, error: '数据超过 sync 单键 8KB 上限，仅保存在本机' };
  }

  async function syncStatus() {
    try {
      const bytes = await chrome.storage.sync.getBytesInUse(null);
      return { ok: true, bytes };
    } catch (e) {
      return { ok: false, bytes: 0, error: String((e && e.message) || e) };
    }
  }

  /* 老版本把数据存在 local：升级后第一次运行把它搬到 sync 一次 */
  async function migrateLocalToSync() {
    try {
      const s = await chrome.storage.sync.get(DATA_KEY);
      if (Array.isArray(s[DATA_KEY]) && s[DATA_KEY].length) return;
      const l = await chrome.storage.local.get(DATA_KEY);
      if (Array.isArray(l[DATA_KEY]) && l[DATA_KEY].length) {
        await chrome.storage.sync.set({ [DATA_KEY]: l[DATA_KEY] });
      }
    } catch (e) { /* sync 不可用时下次再说 */ }
  }

  function openItem(item) {
    let u;
    try {
      u = new URL(item.url, location.href);
    } catch {
      showToast('网址无效');
      return;
    }
    // 仅允许 http/https，防止编辑出 javascript: 之类的危险链接
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      showToast('仅支持 http/https 网址');
      return;
    }
    const a = document.createElement('a');
    a.href = u.href;
    a.target = '_blank';
    a.rel = 'noopener';
    shadow.appendChild(a);
    a.click();
    a.remove();
  }

  function showToast(text) {
    let toast = shadow.querySelector('.toast');
    if (!toast) {
      toast = el('div', 'toast');
      shadow.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
  }

  /* ---------- 自动收起 ---------- */

  function setMode(mode) {
    state.mode = mode;
    render();
  }

  function cancelClose() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimer = setTimeout(closeIfIdle, 600);
  }

  function closeIfIdle() {
    closeTimer = null;
    if (hovering || state.dragActive) return;
    // 正在输入（搜索 / 编辑）时不收起，等输入框失焦后再判断
    const active = shadow.activeElement;
    if (active && active.tagName === 'INPUT') return;
    if (state.mode !== 'handle') setMode('handle');
  }

  /* ---------- 构建 ---------- */

  function buildUI() {
    hostEl = document.createElement('div');
    hostEl.style.cssText = 'position:fixed;top:0;right:0;height:100vh;z-index:2147483647;';
    shadow = hostEl.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);

    // 把手：悬停滑出图标条；点击作为触屏兜底
    const handle = el('button', 'handle', '‹');
    handle.title = '快捷侧边栏';
    handle.addEventListener('mouseenter', () => {
      hovering = true;
      cancelClose();
      if (state.mode === 'handle') setMode('strip');
    });
    handle.addEventListener('mouseleave', () => {
      hovering = false;
      scheduleClose();
    });
    handle.addEventListener('click', () => {
      if (state.mode === 'handle') setMode('strip');
      else setMode('handle');
    });
    shadow.appendChild(handle);

    // 侧边栏主体
    const bar = el('div', 'bar');
    bar.addEventListener('mouseenter', () => {
      hovering = true;
      cancelClose();
    });
    bar.addEventListener('mouseleave', () => {
      hovering = false;
      scheduleClose();
    });
    shadow.appendChild(bar);

    document.documentElement.appendChild(hostEl);
    render();
  }

  function render() {
    hostEl.style.display = state.enabled ? '' : 'none';
    const handle = shadow.querySelector('.handle');
    const bar = shadow.querySelector('.bar');
    handle.classList.toggle('hide', state.mode !== 'handle');
    bar.classList.toggle('open', state.mode !== 'handle');
    bar.classList.toggle('expanded', state.mode === 'expanded');
    renderBar(bar);
  }

  function renderBar(bar) {
    bar.textContent = '';

    // 头部
    const header = el('div', 'header' + (state.mode === 'expanded' ? '' : ' center'));
    if (state.mode === 'expanded') {
      header.appendChild(el('span', 'title', '快捷访问'));

      const search = el('input', 'search');
      search.type = 'search';
      search.placeholder = '搜索标题或网址…';
      search.addEventListener('input', () => applyFilter(search.value));
      search.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setMode('handle');
      });
      search.addEventListener('blur', () => scheduleClose());
      header.appendChild(search);

      // 侧边栏贴在屏幕右侧：收起 = 面板往右缩回去，所以箭头朝右
      const back = el('button', 'btn', '⟩');
      back.title = '收起为图标条';
      back.addEventListener('click', () => setMode('strip'));
      header.appendChild(back);
    } else {
      // strip / handle 态：展开 = 面板往左拉出来，所以箭头朝左
      const fwd = el('button', 'btn', '⟨');
      fwd.title = '展开详细信息';
      fwd.addEventListener('click', () => setMode('expanded'));
      header.appendChild(fwd);
    }
    bar.appendChild(header);

    // 内容区
    if (state.items.length === 0) {
      if (state.mode === 'expanded') {
        const empty = el('div', 'empty', '还没有快捷方式\n在网页上右键 →「添加到侧边栏」\n或点下方 ⇧ 从备份文件导入');
        empty.style.flex = '1';
        bar.appendChild(empty);
        appendFooter(bar);
      }
      return;
    }

    if (state.mode === 'expanded') {
      const list = el('div', 'list');
      for (const item of state.items) list.appendChild(buildCard(item));
      bar.appendChild(list);
      appendFooter(bar);
    } else {
      const strip = el('div', 'strip');
      for (const item of state.items) strip.appendChild(buildIconBtn(item));
      bar.appendChild(strip);
    }
  }

  /* 展开态底栏：账号同步状态 + 导出 / 导入备份 */
  function appendFooter(bar) {
    const footer = el('div', 'footer');

    const status = el('span', 'status', '正在检查账号同步…');
    footer.appendChild(status);

    const expBtn = el('button', 'btn', '⇩');
    expBtn.title = '导出备份（JSON 文件）';
    expBtn.addEventListener('click', exportBackup);
    footer.appendChild(expBtn);

    const impBtn = el('button', 'btn', '⇧');
    impBtn.title = '从备份文件导入';
    impBtn.addEventListener('click', importBackup);
    footer.appendChild(impBtn);

    bar.appendChild(footer);

    syncStatus().then((st) => {
      if (!st.ok) {
        status.textContent = '账号同步不可用（数据存本机）';
        status.title = st.error || '';
        status.classList.add('warn');
        return;
      }
      status.textContent = st.bytes
        ? '账号同步正常 · 云端 ' + st.bytes + ' 字节'
        : '账号同步正常 · 暂无数据';
      status.classList.add('ok');
    });
  }

  function buildImg(item, cls) {
    const img = el('img', cls);
    // 跨站引用图标时很多 CDN 会因 referer 拒绝返回，必须去掉
    img.referrerPolicy = 'no-referrer';
    img.src = item.favicon || FALLBACK_ICON;
    img.alt = '';

    let done = false;
    const useFallback = () => {
      if (done) return;
      done = true;
      img.src = FALLBACK_ICON;
    };
    // 图片加载失败会触发 error，但请求被墙 / 一直挂着不会 —— 所以再加定时兜底
    img.addEventListener('error', useFallback, { once: true });
    img.addEventListener('load', () => { done = true; }, { once: true });
    setTimeout(() => { if (!done && !img.naturalWidth) useFallback(); }, 5000);

    return img;
  }

  /* 图标条条目 */
  function buildIconBtn(item) {
    const btn = el('button', 'iconbtn');
    btn.title = item.title;
    btn.appendChild(buildImg(item));
    btn.addEventListener('click', () => openItem(item));
    return btn;
  }

  /* 详情卡片条目 */
  function buildCard(item) {
    const card = el('div', 'card');
    card.draggable = true;
    card.appendChild(buildImg(item, 'card-icon'));

    const info = el('div', 'card-info');
    info.appendChild(el('div', 'card-title', item.title));
    info.appendChild(el('div', 'card-url', item.url));
    card.appendChild(info);

    const actions = el('div', 'card-actions');
    const editBtn = el('button', 'act', '✎');
    editBtn.title = '编辑';
    const delBtn = el('button', 'act act-del', '✕');
    delBtn.title = '删除';
    actions.append(editBtn, delBtn);
    card.appendChild(actions);

    // 点击卡片（非按钮区域）→ 新标签页打开
    card.addEventListener('click', (e) => {
      if (e.target.closest('.act')) return;
      openItem(item);
    });

    // 删除
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveItems(state.items.filter((i) => i.id !== item.id));
    });

    // 编辑
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toEditMode(card, item);
    });

    // 拖拽排序（拖拽期间阻止自动收起）
    card.addEventListener('dragstart', (e) => {
      state.dragActive = true;
      cancelClose();
      e.dataTransfer.setData('text/plain', item.id);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => {
      state.dragActive = false;
      card.classList.remove('dragging');
      scheduleClose();
    });
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      card.classList.add('dragover');
    });
    card.addEventListener('dragleave', () => card.classList.remove('dragover'));
    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      state.dragActive = false;
      card.classList.remove('dragover');
      const dragId = e.dataTransfer.getData('text/plain');
      if (!dragId || dragId === item.id) return;
      const items = state.items.slice();
      const from = items.findIndex((i) => i.id === dragId);
      if (from < 0) return;
      const [moved] = items.splice(from, 1);
      const to = items.findIndex((i) => i.id === item.id);
      items.splice(to, 0, moved);
      await saveItems(items);
    });

    return card;
  }

  /* 卡片行内编辑 */
  function toEditMode(card, item) {
    card.textContent = '';

    const box = el('div', 'edit');
    const titleInput = el('input', 'input');
    titleInput.type = 'text';
    titleInput.value = item.title;
    const urlInput = el('input', 'input');
    urlInput.type = 'text';
    urlInput.value = item.url;

    const btns = el('div', 'edit-btns');
    const okBtn = el('button', 'act act-ok', '✓');
    okBtn.title = '保存';
    const cancelBtn = el('button', 'act act-del', '✕');
    cancelBtn.title = '取消';
    btns.append(okBtn, cancelBtn);

    box.append(titleInput, urlInput, btns);
    card.appendChild(box);

    const save = async () => {
      const title = titleInput.value.trim() || item.title;
      const url = urlInput.value.trim() || item.url;
      if (title === item.title && url === item.url) {
        render();
        return;
      }
      const items = state.items.map((i) => (i.id === item.id ? { ...i, title, url } : i));
      await saveItems(items);
    };

    okBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      save();
    });
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      render();
    });
    for (const input of [titleInput, urlInput]) {
      input.addEventListener('click', (e) => e.stopPropagation());
      input.addEventListener('blur', () => scheduleClose());
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') save();
        else if (e.key === 'Escape') render();
      });
    }
    titleInput.focus();
    titleInput.select();
  }

  /* 搜索过滤：隐藏/显示条目，不重建列表避免丢焦点 */
  function applyFilter(keyword) {
    const kw = keyword.trim().toLowerCase();
    for (const card of shadow.querySelectorAll('.card')) {
      const titleEl = card.querySelector('.card-title');
      const urlEl = card.querySelector('.card-url');
      const text = ((titleEl ? titleEl.textContent : '') + ' ' + (urlEl ? urlEl.textContent : '')).toLowerCase();
      card.style.display = !kw || text.includes(kw) ? '' : 'none';
    }
  }

  /* ---------- 与后台通信 ---------- */

  function collectPageInfo() {
    let favicon = '';
    const iconLink =
      document.querySelector('link[rel~="icon"]') ||
      document.querySelector('link[rel="shortcut icon"]') ||
      document.querySelector('link[rel="apple-touch-icon"]');
    if (iconLink && iconLink.href) favicon = iconLink.href;
    if (!favicon) favicon = location.origin + '/favicon.ico';
    return {
      url: location.href,
      title: document.title || location.hostname,
      favicon
    };
  }

  /* ---------- 备份导出 / 导入 ----------
   * 账号同步只是第一道保险：它依赖「登录同一账号 + 打开同步」。
   * 导出成 JSON 是第二道保险，不依赖账号、也不依赖浏览器，换机时一定能用。
   */
  function exportBackup() {
    let text;
    try {
      text = JSON.stringify(
        { format: 'quick-sidebar-backup', version: 1, exportedAt: new Date().toISOString(), items: state.items },
        null,
        2
      );
    } catch (e) {
      showToast('导出失败：' + ((e && e.message) || e));
      return;
    }
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quick-sidebar-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    shadow.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showToast('已导出 ' + state.items.length + ' 条');
  }

  // 按 url 去重合并：保留本地已有的 id，避免导入后重复项
  function mergeItems(current, incoming) {
    const byUrl = new Map();
    for (const it of current) {
      if (it && it.url) byUrl.set(it.url, it);
    }
    for (const it of incoming) {
      if (!it || !it.url) continue;
      const old = byUrl.get(it.url);
      byUrl.set(it.url, old ? Object.assign({}, old, it) : Object.assign({ id: it.id || newId() }, it));
    }
    return Array.from(byUrl.values());
  }

  function importBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      try {
        const raw = JSON.parse(await file.text());
        const incoming = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.items) ? raw.items : null);
        if (!incoming) {
          showToast('备份文件格式不对');
          return;
        }
        const result = await saveItems(mergeItems(state.items, incoming));
        showToast(
          result && result.synced
            ? '已导入 ' + incoming.length + ' 条，已同步'
            : '已导入到本机（账号同步不可用）'
        );
      } catch (e) {
        showToast('导入失败：' + ((e && e.message) || e));
      }
    });
    shadow.appendChild(input);
    input.click();
  }

  async function init() {
    // enabled 是设备级 UI 偏好，故意留在 local，不跟着账号同步
    let enabled = true;
    try {
      const local = await chrome.storage.local.get(['enabled']);
      enabled = local.enabled !== false;
    } catch (e) { /* 读不到就按「开启」处理，绝不能因此卡住渲染 */ }

    try {
      state.items = await loadItems();
    } catch (e) {
      state.items = [];
    }
    state.enabled = enabled;

    buildUI(); // 无论上面发生什么，都必须走到这里把界面画出来

    migrateLocalToSync(); // 老版本的本地数据搬到 sync（不阻塞渲染）

    // 数据变化（右键添加 / 其他标签页修改 / 别的设备同步过来）时刷新列表
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' && area !== 'local') return;
      if (!changes.items) return;
      state.items = changes.items.newValue || [];
      render();
    });

    // 响应后台消息
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      switch (msg && msg.type) {
        case 'GET_PAGE_INFO':
          sendResponse(collectPageInfo());
          break;
        case 'TOGGLE_SIDEBAR':
          state.enabled = !state.enabled;
          chrome.storage.local.set({ enabled: state.enabled });
          if (!state.enabled) {
            cancelClose();
            state.mode = 'handle';
          }
          render();
          showToast(state.enabled ? '侧边栏已显示' : '侧边栏已隐藏');
          break;
        case 'SHOW_TOAST':
          showToast(msg.text);
          break;
      }
    });

    // 切走标签页时收起，避免回来时残留展开状态
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelClose();
        if (state.mode !== 'handle') setMode('handle');
      }
    });
  }

  init();
})();
