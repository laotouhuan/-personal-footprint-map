const SUPABASE_URL = "https://ayhgkrtzhhxjpmgvnpoz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MnoKuiESGpic_JyL_a8WgQ_6UvD43YG";
const FOOTPRINT_TABLE = "footprint_logs";
const CHINA_ADCODE = "100000";
const GEOJSON_BASE = "https://geo.datav.aliyun.com/areas_v3/bound";
const REQUEST_TIMEOUT_MS = 8000;

const companionTags = [
  { label: "家人", color: "#d85857" },
  { label: "同学", color: "#2f7dd1" },
  { label: "java", color: "#7b56b7" },
  { label: "自己", color: "#2d986e" },
];
const companionColorByLabel = Object.fromEntries(companionTags.map((tag) => [tag.label, tag.color]));

const provinceAdcodes = {
  北京市: "110000",
  天津市: "120000",
  河北省: "130000",
  山西省: "140000",
  内蒙古自治区: "150000",
  辽宁省: "210000",
  吉林省: "220000",
  黑龙江省: "230000",
  上海市: "310000",
  江苏省: "320000",
  浙江省: "330000",
  安徽省: "340000",
  福建省: "350000",
  江西省: "360000",
  山东省: "370000",
  河南省: "410000",
  湖北省: "420000",
  湖南省: "430000",
  广东省: "440000",
  广西壮族自治区: "450000",
  海南省: "460000",
  重庆市: "500000",
  四川省: "510000",
  贵州省: "520000",
  云南省: "530000",
  西藏自治区: "540000",
  陕西省: "610000",
  甘肃省: "620000",
  青海省: "630000",
  宁夏回族自治区: "640000",
  新疆维吾尔自治区: "650000",
  台湾省: "710000",
  香港特别行政区: "810000",
  澳门特别行政区: "820000",
};

const state = {
  chart: null,
  supabase: null,
  session: null,
  logs: [],
  currentView: {
    level: "country",
    mapName: "china",
    title: "全国足迹",
    province: "",
    adcode: CHINA_ADCODE,
  },
  pendingLocation: null,
  hiddenTapCount: 0,
};

const els = {
  map: document.querySelector("#map"),
  loadingMask: document.querySelector("#loadingMask"),
  mapTitle: document.querySelector("#mapTitle"),
  viewHint: document.querySelector("#viewHint"),
  legend: document.querySelector("#legend"),
  backButton: document.querySelector("#backButton"),
  ledgerButton: document.querySelector("#ledgerButton"),
  authStatus: document.querySelector("#authStatus"),
  loginButton: document.querySelector("#loginButton"),
  logoutButton: document.querySelector("#logoutButton"),
  loginDialog: document.querySelector("#loginDialog"),
  loginForm: document.querySelector("#loginForm"),
  emailInput: document.querySelector("#emailInput"),
  passwordInput: document.querySelector("#passwordInput"),
  loginMessage: document.querySelector("#loginMessage"),
  footprintDialog: document.querySelector("#footprintDialog"),
  footprintForm: document.querySelector("#footprintForm"),
  footprintDialogTitle: document.querySelector("#footprintDialogTitle"),
  lockedLocation: document.querySelector("#lockedLocation"),
  visitMonthInput: document.querySelector("#visitMonthInput"),
  companionInput: document.querySelector("#companionInput"),
  remarkInput: document.querySelector("#remarkInput"),
  footprintMessage: document.querySelector("#footprintMessage"),
  ledgerDrawer: document.querySelector("#ledgerDrawer"),
  ledgerList: document.querySelector("#ledgerList"),
  drawerScrim: document.querySelector("#drawerScrim"),
  closeLedgerButton: document.querySelector("#closeLedgerButton"),
  brandButton: document.querySelector("#brandButton"),
  toast: document.querySelector("#toast"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  if (!window.echarts || !window.supabase) {
    const missing = [];
    if (!window.echarts) missing.push("ECharts 地图库");
    if (!window.supabase) missing.push("Supabase 客户端");
    const message = `${missing.join("、")}加载失败。请检查网络能否访问 cdn.jsdelivr.net，或用本地服务方式打开页面后刷新。`;
    setLoading(true, message);
    showToast("依赖加载失败，请检查网络");
    return;
  }

  state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  state.chart = echarts.init(els.map);

  setupStaticUi();
  await loadCountryMap();
  restoreSession().catch((error) => {
    showToast(`登录状态恢复失败：${error.message}`);
  });

  window.addEventListener("resize", () => state.chart.resize());
}

function setupStaticUi() {
  companionTags.forEach((tag) => {
    const option = document.createElement("option");
    option.value = tag.label;
    option.textContent = tag.label;
    els.companionInput.append(option);
  });

  els.legend.innerHTML = companionTags
    .map(
      (tag) => `
        <span class="legend-item">
          <span class="legend-dot" style="background:${tag.color}"></span>
          ${tag.label}
        </span>
      `,
    )
    .join("");

  els.loginButton.addEventListener("click", openLoginDialog);
  els.logoutButton.addEventListener("click", logout);
  els.backButton.addEventListener("click", loadCountryMap);
  els.ledgerButton.addEventListener("click", openLedger);
  els.closeLedgerButton.addEventListener("click", closeLedger);
  els.drawerScrim.addEventListener("click", closeLedger);
  els.loginForm.addEventListener("submit", login);
  els.footprintForm.addEventListener("submit", saveFootprint);
  document.querySelectorAll("[data-close-login]").forEach((button) => {
    button.addEventListener("click", () => els.loginDialog.close());
  });
  document.querySelectorAll("[data-close-footprint]").forEach((button) => {
    button.addEventListener("click", () => {
      state.pendingLocation = null;
      els.footprintDialog.close();
    });
  });
  els.brandButton.addEventListener("click", handleHiddenAdminTap);
  state.chart.on("click", handleMapClick);

  if (location.pathname.endsWith("/admin") || location.hash === "#admin") {
    setTimeout(openLoginDialog, 200);
  }
}

async function restoreSession() {
  const { data } = await withTimeout(
    state.supabase.auth.getSession(),
    REQUEST_TIMEOUT_MS,
    "Supabase 登录状态请求超时",
  );
  state.session = data.session;
  updateAuthUi();

  state.supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    updateAuthUi();
    await loadLogs();
    renderCurrentMap();
  });

  if (state.session) {
    await loadLogs();
    renderCurrentMap();
  }
}

function updateAuthUi() {
  const isAuthed = Boolean(state.session);
  els.authStatus.textContent = isAuthed ? "已登录" : "未登录";
  els.loginButton.hidden = isAuthed;
  els.logoutButton.hidden = !isAuthed;
  els.ledgerButton.hidden = !isAuthed;
}

function handleHiddenAdminTap() {
  state.hiddenTapCount += 1;
  window.clearTimeout(state.hiddenTapTimer);
  state.hiddenTapTimer = window.setTimeout(() => {
    state.hiddenTapCount = 0;
  }, 1200);
  if (state.hiddenTapCount >= 5) {
    state.hiddenTapCount = 0;
    openLoginDialog();
  }
}

function openLoginDialog() {
  els.loginMessage.textContent = "";
  els.passwordInput.value = "";
  els.loginDialog.showModal();
}

async function login(event) {
  event.preventDefault();
  els.loginMessage.textContent = "正在登录...";
  const { error } = await state.supabase.auth.signInWithPassword({
    email: els.emailInput.value.trim(),
    password: els.passwordInput.value,
  });
  if (error) {
    els.loginMessage.textContent = `登录失败：${error.message}`;
    return;
  }
  els.loginDialog.close();
  showToast("登录成功");
}

async function logout() {
  await state.supabase.auth.signOut();
  state.logs = [];
  closeLedger();
  showToast("已退出登录");
}

async function loadLogs() {
  if (!state.session) {
    state.logs = [];
    return;
  }

  const { data, error } = await withTimeout(
    state.supabase.from(FOOTPRINT_TABLE).select("*").order("visit_date", { ascending: false }),
    REQUEST_TIMEOUT_MS,
    "Supabase 足迹读取超时",
  );

  if (error) {
    showToast(`读取足迹失败：${error.message}`);
    state.logs = [];
    return;
  }

  state.logs = data || [];
  renderLedger();
}

async function loadCountryMap() {
  state.currentView = {
    level: "country",
    mapName: "china",
    title: "全国足迹",
    province: "",
    adcode: CHINA_ADCODE,
  };
  const loaded = await loadAndRegisterMap("china", CHINA_ADCODE);
  if (!loaded) return;
  renderCurrentMap();
}

async function loadProvinceMap(provinceName) {
  const adcode = provinceAdcodes[provinceName];
  if (!adcode) {
    showToast("暂未找到这个省份的市级地图数据");
    return;
  }

  state.currentView = {
    level: "province",
    mapName: `province-${adcode}`,
    title: provinceName,
    province: provinceName,
    adcode,
  };
  const loaded = await loadAndRegisterMap(state.currentView.mapName, adcode);
  if (!loaded) return;
  renderCurrentMap();
}

async function loadAndRegisterMap(mapName, adcode) {
  if (echarts.getMap(mapName)) {
    setLoading(false);
    return true;
  }

  setLoading(true, "正在加载地图...");
  try {
    const response = await fetchWithTimeout(`${GEOJSON_BASE}/${adcode}_full.json`, REQUEST_TIMEOUT_MS);
    if (!response.ok) throw new Error("地图数据请求失败");
    const geoJson = await response.json();
    echarts.registerMap(mapName, geoJson);
    setLoading(false);
    return true;
  } catch (error) {
    const message = `地图数据加载失败。请检查网络能否访问 geo.datav.aliyun.com，或稍后刷新重试。错误：${error.message}`;
    setLoading(true, message);
    showToast("地图数据加载失败");
    return false;
  }
}

function renderCurrentMap() {
  const { currentView } = state;
  els.mapTitle.textContent = currentView.title;
  els.viewHint.textContent =
    currentView.level === "country" ? "点击省份进入市级地图" : "点击城市新增足迹";
  els.backButton.hidden = currentView.level === "country";

  const seriesData = buildMapSeriesData();

  state.chart.setOption(
    {
      backgroundColor: "#fffaf0",
      tooltip: {
        trigger: "item",
        borderWidth: 0,
        backgroundColor: "rgba(36, 33, 29, 0.88)",
        textStyle: { color: "#fff" },
        formatter: (params) => formatTooltip(params.name),
      },
      series: [
        {
          type: "map",
          map: currentView.mapName,
          roam: true,
          selectedMode: false,
          label: {
            show: true,
            color: "#4f4a43",
            fontSize: 11,
          },
          emphasis: {
            label: { color: "#1d1a17", fontWeight: 700 },
            itemStyle: { areaColor: "#f3c96b" },
          },
          itemStyle: {
            areaColor: "#e6dece",
            borderColor: "#b9ad9b",
            borderWidth: 1,
          },
          data: seriesData,
        },
      ],
    },
    true,
  );
  setLoading(false);
}

function buildMapSeriesData() {
  const regionMap = new Map();
  const logs = state.session ? state.logs : [];

  logs.forEach((log) => {
    const key = getRegionKeyFromLog(log);
    if (!key) return;
    const current = regionMap.get(key);
    if (!current || compareLogDate(log, current) > 0) {
      regionMap.set(key, log);
    }
  });

  return Array.from(regionMap.entries()).map(([name, log]) => ({
    name,
    value: 1,
    itemStyle: {
      areaColor: getCompanionColor(log.companion_type),
      borderColor: "#ffffff",
      borderWidth: 1.4,
    },
  }));
}

function getRegionKeyFromLog(log) {
  if (state.currentView.level === "country") return log.province;
  if (log.province !== state.currentView.province) return "";
  return log.city;
}

function compareLogDate(a, b) {
  const dateDiff = new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime();
  if (dateDiff !== 0) return dateDiff;
  return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
}

function formatTooltip(regionName) {
  const matchedLogs = getLogsForRegion(regionName);
  const title = `<strong>${regionName}</strong>`;
  if (!state.session) return `${title}<br/>登录后可查看足迹`;
  if (!matchedLogs.length) return `${title}<br/>暂无足迹`;

  const rows = matchedLogs
    .map((log) => {
      const remark = log.remark ? `｜${escapeHtml(log.remark)}` : "";
      return `${formatMonth(log.visit_date)}｜${escapeHtml(log.companion_type)}${remark}`;
    })
    .join("<br/>");
  return `${title}<br/>${rows}`;
}

function getLogsForRegion(regionName) {
  return state.logs
    .filter((log) => {
      if (state.currentView.level === "country") return log.province === regionName;
      return log.province === state.currentView.province && log.city === regionName;
    })
    .sort((a, b) => compareLogDate(b, a));
}

function handleMapClick(params) {
  if (!params.name) return;
  if (state.currentView.level === "country") {
    loadProvinceMap(params.name);
    return;
  }

  if (!state.session) {
    showToast("请先以管理员身份登录");
    return;
  }

  openFootprintDialog({
    country: "中国",
    province: state.currentView.province,
    city: params.name,
  });
}

function openFootprintDialog(locationInfo) {
  state.pendingLocation = locationInfo;
  els.footprintMessage.textContent = "";
  els.remarkInput.value = "";
  els.visitMonthInput.value = getCurrentMonthValue();
  els.companionInput.value = companionTags[0].label;
  els.footprintDialogTitle.textContent = `确认到访 ${locationInfo.city}`;
  els.lockedLocation.innerHTML = `
    <strong>${locationInfo.country} / ${locationInfo.province} / ${locationInfo.city}</strong>
    <br />
    <small>位置已根据地图点击自动锁定</small>
  `;
  els.footprintDialog.showModal();
}

async function saveFootprint(event) {
  event.preventDefault();
  if (!state.pendingLocation || !state.session) return;

  els.footprintMessage.textContent = "正在保存...";
  const payload = {
    ...state.pendingLocation,
    visit_date: `${els.visitMonthInput.value}-01`,
    companion_type: els.companionInput.value,
    remark: els.remarkInput.value.trim() || null,
  };

  const { error } = await state.supabase.from(FOOTPRINT_TABLE).insert(payload);
  if (error) {
    els.footprintMessage.textContent = `保存失败：${error.message}`;
    return;
  }

  state.pendingLocation = null;
  els.footprintDialog.close();
  showToast("足迹已保存");
  await loadLogs();
  renderCurrentMap();
}

function openLedger() {
  renderLedger();
  els.ledgerDrawer.classList.add("open");
  els.ledgerDrawer.setAttribute("aria-hidden", "false");
  els.drawerScrim.hidden = false;
}

function closeLedger() {
  els.ledgerDrawer.classList.remove("open");
  els.ledgerDrawer.setAttribute("aria-hidden", "true");
  els.drawerScrim.hidden = true;
}

function renderLedger() {
  if (!state.session) {
    els.ledgerList.innerHTML = `<p class="empty-state">登录后可以查看足迹簿。</p>`;
    return;
  }
  if (!state.logs.length) {
    els.ledgerList.innerHTML = `<p class="empty-state">还没有足迹，进入市级地图后点击城市添加第一条记录。</p>`;
    return;
  }

  els.ledgerList.innerHTML = state.logs
    .map(
      (log) => `
        <article class="log-card">
          <header>
            <div>
              <strong>${escapeHtml(log.province || "")} ${escapeHtml(log.city || "")}</strong>
              <small>${formatMonth(log.visit_date)} ｜ ${escapeHtml(log.companion_type)}</small>
            </div>
            <button class="delete-button" type="button" data-delete-id="${log.id}">删除</button>
          </header>
          ${log.remark ? `<p>${escapeHtml(log.remark)}</p>` : ""}
        </article>
      `,
    )
    .join("");

  els.ledgerList.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => deleteFootprint(button.dataset.deleteId));
  });
}

async function deleteFootprint(id) {
  const target = state.logs.find((log) => log.id === id);
  if (!target) return;

  const label = `${target.province || ""}${target.city || ""} ${formatMonth(target.visit_date)}`;
  const confirmed = window.confirm(`确定删除「${label}」这条足迹吗？删除后无法恢复。`);
  if (!confirmed) return;

  const { error } = await state.supabase.from(FOOTPRINT_TABLE).delete().eq("id", id);
  if (error) {
    showToast(`删除失败：${error.message}`);
    return;
  }

  showToast("足迹已删除");
  await loadLogs();
  renderCurrentMap();
}

function getCompanionColor(label) {
  return companionColorByLabel[label] || "#7c8792";
}

function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(dateValue) {
  if (!dateValue) return "未知日期";
  return String(dateValue).slice(0, 7);
}

function setLoading(isLoading, text = "正在加载...") {
  els.loadingMask.hidden = !isLoading;
  els.loadingMask.textContent = text;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2400);
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
