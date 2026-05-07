const SUPABASE_URL = "https://ayhgkrtzhhxjpmgvnpoz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MnoKuiESGpic_JyL_a8WgQ_6UvD43YG";
const FOOTPRINT_TABLE = "footprint_logs";
const CHINA_ADCODE = "100000";
const GEOJSON_BASE = "https://geo.datav.aliyun.com/areas_v3/bound";
const LOCAL_CHINA_GEOJSON_BASE = "./maps/china";
const CHINA_CITY_MAP_NAME = "china-cities";
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

const provinceNameByAdcode = Object.fromEntries(
  Object.entries(provinceAdcodes).map(([name, adcode]) => [adcode, name]),
);

const state = {
  chart: null,
  supabase: null,
  session: null,
  logs: [],
  mapMode: "highlight",
  fillLevel: "province",
  activeCompanionFilters: new Set(companionTags.map((tag) => tag.label)),
  geoJsonCache: new Map(),
  mapRegions: new Map(),
  cityProvinceByName: new Map(),
  locationIndex: [],
  locationLookup: new Map(),
  locationIndexReady: false,
  chinaCityGeoJson: null,
  cityMapPromise: null,
  renderSerial: 0,
  selectedLocation: null,
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
  mapModeButtons: document.querySelectorAll("[data-map-mode]"),
  fillLevelControls: document.querySelector("#fillLevelControls"),
  fillLevelButtons: document.querySelectorAll("[data-fill-level]"),
  locationSearchInput: document.querySelector("#locationSearchInput"),
  clearSearchButton: document.querySelector("#clearSearchButton"),
  searchResults: document.querySelector("#searchResults"),
  locationPanel: document.querySelector("#locationPanel"),
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
  buildLocationIndex().catch((error) => {
    showToast(`地点索引准备失败：${error.message}`);
  });
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

  renderLegend();

  els.loginButton.addEventListener("click", openLoginDialog);
  els.logoutButton.addEventListener("click", logout);
  els.backButton.addEventListener("click", loadCountryMap);
  els.ledgerButton.addEventListener("click", openLedger);
  els.closeLedgerButton.addEventListener("click", closeLedger);
  els.drawerScrim.addEventListener("click", closeLedger);
  els.loginForm.addEventListener("submit", login);
  els.footprintForm.addEventListener("submit", saveFootprint);
  els.legend.addEventListener("change", handleLegendFilterChange);
  els.mapModeButtons.forEach((button) => {
    button.addEventListener("click", () => setMapMode(button.dataset.mapMode));
  });
  els.fillLevelButtons.forEach((button) => {
    button.addEventListener("click", () => setFillLevel(button.dataset.fillLevel));
  });
  els.locationSearchInput.addEventListener("input", renderSearchResults);
  els.clearSearchButton.addEventListener("click", clearLocationSearch);
  els.searchResults.addEventListener("click", handleSearchResultClick);
  els.locationPanel.addEventListener("click", handleLocationPanelClick);
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

function renderLegend() {
  els.legend.innerHTML = companionTags
    .map(
      (tag) => `
        <label class="legend-item">
          <input type="checkbox" value="${escapeHtml(tag.label)}" ${
            state.activeCompanionFilters.has(tag.label) ? "checked" : ""
          } />
          <span class="legend-dot" style="background:${tag.color}"></span>
          ${escapeHtml(tag.label)}
        </label>
      `,
    )
    .join("");
}

function handleLegendFilterChange(event) {
  const checkbox = event.target.closest("input[type='checkbox']");
  if (!checkbox) return;

  if (checkbox.checked) {
    state.activeCompanionFilters.add(checkbox.value);
  } else {
    state.activeCompanionFilters.delete(checkbox.value);
  }
  renderCurrentMap();
}

function setMapMode(mode) {
  if (!["highlight", "plain"].includes(mode)) return;
  state.mapMode = mode;
  syncMapControls();
  renderCurrentMap();
}

function setFillLevel(fillLevel) {
  if (!["province", "city"].includes(fillLevel)) return;
  state.fillLevel = fillLevel;
  syncMapControls();
  renderCurrentMap();
}

function syncMapControls() {
  els.mapModeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mapMode === state.mapMode));
  });
  els.fillLevelButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.fillLevel === state.fillLevel));
  });
  els.fillLevelControls.hidden = state.currentView.level !== "country";
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
  renderLocationPanel();
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
  state.selectedLocation = null;
  closeLedger();
  renderLedger();
  renderLocationPanel();
  renderCurrentMap();
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
  renderLocationPanel();
}

async function loadCountryMap() {
  const nextView = {
    level: "country",
    mapName: "china",
    title: "全国足迹",
    province: "",
    adcode: CHINA_ADCODE,
  };
  const loaded = await loadAndRegisterMap("china", CHINA_ADCODE);
  if (!loaded) return;
  state.currentView = nextView;
  renderCurrentMap();
}

async function loadProvinceMap(provinceName) {
  const adcode = provinceAdcodes[provinceName];
  if (!adcode) {
    showToast("暂未找到这个省份的市级地图数据");
    return;
  }

  const nextView = {
    level: "province",
    mapName: `province-${adcode}`,
    title: provinceName,
    province: provinceName,
    adcode,
  };
  const loaded = await loadAndRegisterMap(nextView.mapName, adcode);
  if (!loaded) return;
  state.currentView = nextView;
  renderCurrentMap();
}

async function loadAndRegisterMap(mapName, adcode) {
  if (echarts.getMap(mapName)) {
    setLoading(false);
    return true;
  }

  setLoading(true, "正在加载地图...");
  try {
    const geoJson = await loadGeoJson(adcode);
    echarts.registerMap(mapName, geoJson);
    state.mapRegions.set(mapName, getFeatureNames(geoJson));
    setLoading(false);
    return true;
  } catch (error) {
    const message = `地图数据加载失败。本地文件与远程备用源均不可用。错误：${error.message}`;
    setLoading(true, message);
    showToast("地图数据加载失败");
    return false;
  }
}

async function loadGeoJson(adcode) {
  if (state.geoJsonCache.has(adcode)) return state.geoJsonCache.get(adcode);

  const urls = [
    `${LOCAL_CHINA_GEOJSON_BASE}/${adcode}_full.json`,
    `${GEOJSON_BASE}/${adcode}_full.json`,
  ];
  const errors = [];

  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
      const geoJson = await response.json();
      state.geoJsonCache.set(adcode, geoJson);
      return geoJson;
    } catch (error) {
      errors.push(`${url}：${error.message}`);
    }
  }

  throw new Error(errors.join("；"));
}

function getFeatureNames(geoJson) {
  return new Set((geoJson.features || []).map((feature) => feature.properties?.name).filter(Boolean));
}

async function renderCurrentMap() {
  const serial = ++state.renderSerial;
  const { currentView } = state;
  els.mapTitle.textContent = currentView.title;
  els.viewHint.textContent = getViewHint();
  els.backButton.hidden = currentView.level === "country";
  syncMapControls();

  const renderTarget = await prepareRenderTarget();
  if (!renderTarget || serial !== state.renderSerial) return;

  const seriesData = buildMapSeriesData();

  state.chart.setOption(
    {
      backgroundColor: "#ffffff",
      tooltip: {
        trigger: "item",
        borderWidth: 0,
        backgroundColor: "rgba(31, 41, 51, 0.9)",
        textStyle: { color: "#fff" },
        formatter: (params) => formatTooltip(params.name),
      },
      series: [
        {
          type: "map",
          map: renderTarget.mapName,
          roam: true,
          selectedMode: false,
          animationDurationUpdate: 260,
          label: {
            show: true,
            color: "#43505c",
            fontSize: 11,
          },
          emphasis: {
            label: { color: "#1f2933", fontWeight: 700 },
            itemStyle: { areaColor: "#f2c66d" },
          },
          itemStyle: {
            areaColor: "#dfe8ea",
            borderColor: "#aab9c0",
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

function getViewHint() {
  if (state.currentView.level === "province") return "点击城市新增足迹";
  if (state.fillLevel === "city") return "市级填色：点击城市新增足迹";
  return "省级填色：点击省份进入市级地图";
}

async function prepareRenderTarget() {
  if (state.currentView.level === "country" && state.fillLevel === "city") {
    const loaded = await loadChinaCityMap();
    if (loaded) return { mapName: CHINA_CITY_MAP_NAME };
    state.fillLevel = "province";
    syncMapControls();
    return { mapName: state.currentView.mapName };
  }
  return { mapName: state.currentView.mapName };
}

async function loadChinaCityMap() {
  if (echarts.getMap(CHINA_CITY_MAP_NAME)) return true;
  if (state.cityMapPromise) return state.cityMapPromise;

  state.cityMapPromise = (async () => {
    setLoading(true, "正在加载全国市级地图...");
    try {
      const cityGeoJson = state.chinaCityGeoJson || (await buildChinaCityGeoJson());
      if (!cityGeoJson.features.length) throw new Error("未找到市级地图数据");
      echarts.registerMap(CHINA_CITY_MAP_NAME, cityGeoJson);
      state.mapRegions.set(CHINA_CITY_MAP_NAME, getFeatureNames(cityGeoJson));
      setLoading(false);
      return true;
    } catch (error) {
      showToast(`市级地图加载失败：${error.message}`);
      setLoading(false);
      return false;
    } finally {
      state.cityMapPromise = null;
    }
  })();

  return state.cityMapPromise;
}

async function buildChinaCityGeoJson() {
  const features = [];
  const tasks = Object.entries(provinceAdcodes).map(async ([provinceName, adcode]) => {
    if (adcode === "710000") return;
    try {
      const geoJson = await loadGeoJson(adcode);
      (geoJson.features || []).forEach((feature) => {
        const cityName = feature.properties?.name;
        if (!cityName) return;
        feature.properties = {
          ...feature.properties,
          parentName: provinceName,
        };
        state.cityProvinceByName.set(cityName, provinceName);
        features.push(feature);
      });
    } catch (_error) {
      // 个别省级市级数据缺失时不阻断全国地图。
    }
  });

  await Promise.all(tasks);
  state.chinaCityGeoJson = { type: "FeatureCollection", features };
  return state.chinaCityGeoJson;
}

function buildMapSeriesData() {
  const regionMap = new Map();
  const logs = state.mapMode === "highlight" ? getVisibleLogs() : [];
  const useEarliest = state.currentView.level === "country" && state.fillLevel === "province";

  logs.forEach((log) => {
    const key = getRegionKeyFromLog(log);
    if (!key) return;
    const current = regionMap.get(key);
    const shouldReplace = useEarliest ? compareLogDate(log, current || log) < 0 : compareLogDate(log, current || log) > 0;
    if (!current || shouldReplace) {
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
  if (state.currentView.level === "country") {
    if (state.fillLevel === "city") return log.city || "";
    return log.province;
  }
  if (log.province !== state.currentView.province) return "";
  return log.city || "";
}

function getVisibleLogs() {
  if (!state.session) return [];
  return state.logs.filter((log) => state.activeCompanionFilters.has(log.companion_type));
}

async function buildLocationIndex() {
  const locations = [];
  const lookup = new Map();

  Object.entries(provinceAdcodes).forEach(([provinceName, adcode]) => {
    const location = {
      key: `province:${provinceName}`,
      type: "province",
      province: provinceName,
      city: "",
      adcode,
      label: provinceName,
      meta: "省级行政区",
      searchText: `${provinceName} ${stripAdministrativeSuffix(provinceName)}`,
    };
    locations.push(location);
    lookup.set(location.key, location);
  });

  const cityGeoJson = await buildChinaCityGeoJson();
  cityGeoJson.features.forEach((feature) => {
    const cityName = feature.properties?.name;
    const parentAdcode = String(feature.properties?.parent?.adcode || "");
    const provinceName =
      feature.properties?.parentName || provinceNameByAdcode[parentAdcode] || state.cityProvinceByName.get(cityName);
    if (!cityName || !provinceName) return;

    const location = {
      key: `city:${provinceName}:${cityName}`,
      type: "city",
      province: provinceName,
      city: cityName,
      adcode: String(feature.properties?.adcode || ""),
      label: cityName,
      meta: provinceName,
      searchText: `${cityName} ${stripAdministrativeSuffix(cityName)} ${provinceName}`,
    };
    locations.push(location);
    lookup.set(location.key, location);
  });

  state.locationIndex = locations;
  state.locationLookup = lookup;
  state.locationIndexReady = true;
  renderSearchResults();
}

function stripAdministrativeSuffix(name) {
  return String(name || "")
    .replace(/特别行政区$/, "")
    .replace(/维吾尔自治区$/, "")
    .replace(/壮族自治区$/, "")
    .replace(/回族自治区$/, "")
    .replace(/自治区$/, "")
    .replace(/自治州$/, "")
    .replace(/地区$/, "")
    .replace(/盟$/, "")
    .replace(/省$/, "")
    .replace(/市$/, "");
}

function renderSearchResults() {
  const keyword = els.locationSearchInput.value.trim();
  els.clearSearchButton.hidden = !keyword && !state.selectedLocation;

  if (!keyword) {
    els.searchResults.hidden = true;
    els.searchResults.innerHTML = "";
    return;
  }

  if (!state.locationIndexReady) {
    els.searchResults.hidden = false;
    els.searchResults.innerHTML = `<p class="empty-state">正在准备地点索引...</p>`;
    return;
  }

  const normalizedKeyword = keyword.toLocaleLowerCase();
  const matches = state.locationIndex
    .filter((location) => location.searchText.toLocaleLowerCase().includes(normalizedKeyword))
    .slice(0, 10);

  els.searchResults.hidden = false;
  if (!matches.length) {
    els.searchResults.innerHTML = `<p class="empty-state">没有找到匹配地点。</p>`;
    return;
  }

  els.searchResults.innerHTML = matches
    .map(
      (location) => `
        <button class="search-result" type="button" data-location-key="${escapeHtml(location.key)}">
          <span>${escapeHtml(location.label)}</span>
          <small>${escapeHtml(location.meta)}</small>
        </button>
      `,
    )
    .join("");
}

async function handleSearchResultClick(event) {
  const button = event.target.closest("[data-location-key]");
  if (!button) return;

  const location = state.locationLookup.get(button.dataset.locationKey);
  if (!location) return;

  state.selectedLocation = location;
  els.locationSearchInput.value = location.type === "city" ? `${location.province} ${location.city}` : location.province;
  els.searchResults.hidden = true;
  els.clearSearchButton.hidden = false;
  renderLocationPanel();

  if (location.type === "province") {
    await loadProvinceMap(location.province);
  } else {
    await loadProvinceMap(location.province);
  }
}

function clearLocationSearch() {
  state.selectedLocation = null;
  els.locationSearchInput.value = "";
  els.clearSearchButton.hidden = true;
  els.searchResults.hidden = true;
  els.searchResults.innerHTML = "";
  renderLocationPanel();
}

function renderLocationPanel() {
  const location = state.selectedLocation;
  if (!location) {
    els.locationPanel.hidden = true;
    els.locationPanel.innerHTML = "";
    return;
  }

  els.locationPanel.hidden = false;
  const locationLogs = getLogsForLocation(location);
  const headerMeta = location.type === "city" ? location.province : "省级行政区";
  const canCreate = Boolean(state.session);

  els.locationPanel.innerHTML = `
    <div class="location-header">
      <div>
        <p class="eyebrow">${escapeHtml(headerMeta)}</p>
        <h2>${escapeHtml(location.label)}</h2>
      </div>
      <div class="location-actions">
        <button class="tool-button primary" type="button" data-location-action="create" ${
          canCreate ? "" : "disabled"
        }>新建足迹</button>
      </div>
    </div>
    <div class="location-history">
      ${renderLocationHistory(locationLogs)}
    </div>
  `;
}

function renderLocationHistory(logs) {
  if (!state.session) return `<p class="empty-state">登录后可以查看和管理这个地点的足迹。</p>`;
  if (!logs.length) return `<p class="empty-state">这个地点还没有足迹记录。</p>`;

  return logs
    .map(
      (log) => `
        <article class="history-row">
          <time>${formatMonth(log.visit_date)}</time>
          <div>
            <strong>${escapeHtml(log.companion_type)}</strong>
            <small>${escapeHtml(getLogLocationLabel(log))}</small>
            ${log.remark ? `<p>${escapeHtml(log.remark)}</p>` : ""}
          </div>
          <button class="delete-button" type="button" data-location-action="delete" data-delete-id="${escapeHtml(
            log.id,
          )}">删除</button>
        </article>
      `,
    )
    .join("");
}

function handleLocationPanelClick(event) {
  const actionEl = event.target.closest("[data-location-action]");
  if (!actionEl || !state.selectedLocation) return;

  const action = actionEl.dataset.locationAction;
  if (action === "create") {
    if (!state.session) {
      showToast("请先以管理员身份登录");
      return;
    }
    openFootprintDialog({
      country: "中国",
      province: state.selectedLocation.province,
      city: state.selectedLocation.city,
    });
  }

  if (action === "delete") {
    deleteFootprint(actionEl.dataset.deleteId);
  }
}

function getLogsForLocation(location) {
  if (!state.session || !location) return [];
  return state.logs
    .filter((log) => {
      if (location.type === "province") return log.province === location.province;
      return log.province === location.province && log.city === location.city;
    })
    .sort((a, b) => compareLogDate(b, a));
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
  if (state.mapMode === "plain") return `${title}<br/>普通地图模式未显示足迹`;
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
  return getVisibleLogs()
    .filter((log) => {
      if (state.currentView.level === "country") {
        if (state.fillLevel === "city") return log.city === regionName;
        return log.province === regionName;
      }
      return log.province === state.currentView.province && log.city === regionName;
    })
    .sort((a, b) => compareLogDate(b, a));
}

function handleMapClick(params) {
  if (!params.name) return;
  if (state.currentView.level === "country") {
    if (state.fillLevel === "city") {
      const province = state.cityProvinceByName.get(params.name);
      if (!province) return;
      if (!state.session) {
        showToast("请先以管理员身份登录");
        return;
      }
      openFootprintDialog({
        country: "中国",
        province,
        city: params.name,
      });
      return;
    }
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
  const locationName = getLocationDisplayName(locationInfo);
  els.footprintDialogTitle.textContent = `确认到访 ${locationName}`;
  els.lockedLocation.innerHTML = `
    <strong>${escapeHtml(formatLocationPath(locationInfo))}</strong>
    <br />
    <small>位置已自动锁定</small>
  `;
  els.footprintDialog.showModal();
}

async function saveFootprint(event) {
  event.preventDefault();
  if (!state.pendingLocation || !state.session) return;

  els.footprintMessage.textContent = "正在保存...";
  const payload = {
    country: state.pendingLocation.country,
    province: state.pendingLocation.province,
    city: state.pendingLocation.city || null,
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
              <strong>${escapeHtml(getLogLocationLabel(log))}</strong>
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

function getLocationDisplayName(locationInfo) {
  return locationInfo.city || locationInfo.province || locationInfo.country;
}

function formatLocationPath(locationInfo) {
  return [locationInfo.country, locationInfo.province, locationInfo.city].filter(Boolean).join(" / ");
}

function getLogLocationLabel(log) {
  return [log.province, log.city].filter(Boolean).join(" ") || log.country || "未知地点";
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
