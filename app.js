/* ═══════════════════════════════════════════════════════════
 *  1. 配置常量 (Configuration)
 * ═══════════════════════════════════════════════════════════ */
const SUPABASE_URL = "https://ayhgkrtzhhxjpmgvnpoz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MnoKuiESGpic_JyL_a8WgQ_6UvD43YG";
const FOOTPRINT_TABLE = "footprint_logs";
const CHINA_ADCODE = "100000";
const GEOJSON_BASE = "https://geo.datav.aliyun.com/areas_v3/bound";
const LOCAL_CHINA_GEOJSON_BASE = "./maps/china";
const CHINA_CITY_MAP_NAME = "china-cities";
const REQUEST_TIMEOUT_MS = 8000;

const companionTags = [
  { label: "父母", color: "#FF6B6B" },
  { label: "同学", color: "#4ECDC4" },
  { label: "java", color: "#A569BD" },
  { label: "自己", color: "#F4D03F" },
  { label: "阿姨", color: "#EB984E" },
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

/* ═══════════════════════════════════════════════════════════
 *  2. 全局状态 (State)
 * ═══════════════════════════════════════════════════════════ */
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
    level: "world",
    mapName: "world",
    title: "世界足迹",
    province: "",
    adcode: "world",
    country: "世界",
  },
  pendingLocation: null,
  editingLogId: null,
  hiddenTapCount: 0,
  currentZoom: null,
  playbackInterval: null,
  prePlaybackYear: "",
  currentCenter: null,
  lastShowCity: false,
  lastRenderedMapName: null,
  offscreenChart: null,
  isSharedMode: false,
  shareToken: null,
  worldScatterData: [],  // 保存地球散点数据，供触摸事件使用
};

const provinceCapitals = new Set([
  "北京市", "天津市", "石家庄市", "太原市", "呼和浩特市", "沈阳市", "长春市", "哈尔滨市",
  "上海市", "南京市", "杭州市", "合肥市", "福州市", "南昌市", "济南市", "郑州市",
  "武汉市", "长沙市", "广州市", "南宁市", "海口市", "成都市", "贵阳市", "昆明市",
  "拉萨市", "西安市", "兰州市", "西宁市", "银川市", "乌鲁木齐市", "南投县", "香港特别行政区", "澳门特别行政区"
]);



const els = {
  map: document.querySelector("#map"),
  loadingMask: document.querySelector("#loadingMask"),
  mapTitle: document.querySelector("#mapTitle"),
  legend: document.querySelector("#legend"),
  filterToggleButton: document.querySelector("#filterToggleButton"),
  filterDropdown: document.querySelector("#filterDropdown"),
  yearInput: document.querySelector("#yearInput"),
  playButton: document.querySelector("#playButton"),
  yearOverlay: document.querySelector("#yearOverlay"),
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
  shareButton: document.querySelector("#shareButton"),
  shareDialog: document.querySelector("#shareDialog"),
  shareForm: document.querySelector("#shareForm"),
  shareExpireInput: document.querySelector("#shareExpireInput"),
  shareLabelInput: document.querySelector("#shareLabelInput"),
  shareTagsContainer: document.querySelector("#shareTagsContainer"),
  shareMessage: document.querySelector("#shareMessage"),
  shareResultArea: document.querySelector("#shareResultArea"),
  shareLinkInput: document.querySelector("#shareLinkInput"),
  copyShareButton: document.querySelector("#copyShareButton"),
  generateShareButton: document.querySelector("#generateShareButton"),
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
  offscreenMap: document.querySelector("#offscreenMap"),
};

const countryCodeMap = {
  "afghanistan":"af","albania":"al","algeria":"dz","andorra":"ad","angola":"ao","antigua and barbuda":"ag","argentina":"ar","armenia":"am","australia":"au","austria":"at","azerbaijan":"az","bahamas":"bs","bahrain":"bh","bangladesh":"bd","barbados":"bb","belarus":"by","belgium":"be","belize":"bz","benin":"bj","bhutan":"bt","bolivia":"bo","bosnia and herzegovina":"ba","botswana":"bw","brazil":"br","brunei":"bn","bulgaria":"bg","burkina faso":"bf","burundi":"bi","cabo verde":"cv","cambodia":"kh","cameroon":"cm","canada":"ca","central african republic":"cf","chad":"td","chile":"cl","china":"cn","colombia":"co","comoros":"km","congo":"cg","costa rica":"cr","croatia":"hr","cuba":"cu","cyprus":"cy","czech republic":"cz","democratic republic of the congo":"cd","denmark":"dk","djibouti":"dj","dominica":"dm","dominican republic":"do","ecuador":"ec","egypt":"eg","el salvador":"sv","equatorial guinea":"gq","eritrea":"er","estonia":"ee","eswatini":"sz","ethiopia":"et","fiji":"fj","finland":"fi","france":"fr","gabon":"ga","gambia":"gm","georgia":"ge","germany":"de","ghana":"gh","greece":"gr","grenada":"gd","guatemala":"gt","guinea":"gn","guinea-bissau":"gw","guyana":"gy","haiti":"ht","honduras":"hn","hungary":"hu","iceland":"is","india":"in","indonesia":"id","iran":"ir","iraq":"iq","ireland":"ie","israel":"il","italy":"it","jamaica":"jm","japan":"jp","jordan":"jo","kazakhstan":"kz","kenya":"ke","kiribati":"ki","kuwait":"kw","kyrgyzstan":"kg","laos":"la","latvia":"lv","lebanon":"lb","lesotho":"ls","liberia":"lr","libya":"ly","liechtenstein":"li","lithuania":"lt","luxembourg":"lu","madagascar":"mg","malawi":"mw","malaysia":"my","maldives":"mv","mali":"ml","malta":"mt","marshall islands":"mh","mauritania":"mr","mauritius":"mu","mexico":"mx","micronesia":"fm","moldova":"md","monaco":"mc","mongolia":"mn","montenegro":"me","morocco":"ma","mozambique":"mz","myanmar":"mm","namibia":"na","nauru":"nr","nepal":"np","netherlands":"nl","new zealand":"nz","nicaragua":"ni","niger":"ne","nigeria":"ng","north korea":"kp","north macedonia":"mk","norway":"no","oman":"om","pakistan":"pk","palau":"pw","palestine":"ps","panama":"pa","papua new guinea":"pg","paraguay":"py","peru":"pe","philippines":"ph","poland":"pl","portugal":"pt","qatar":"qa","romania":"ro","russia":"ru","rwanda":"rw","saint kitts and nevis":"kn","saint lucia":"lc","saint vincent and the grenadines":"vc","samoa":"ws","san marino":"sm","sao tome and principe":"st","saudi arabia":"sa","senegal":"sn","serbia":"rs","seychelles":"sc","sierra leone":"sl","singapore":"sg","slovakia":"sk","slovenia":"si","solomon islands":"sb","somalia":"so","south africa":"za","south korea":"kr","south sudan":"ss","spain":"es","sri lanka":"lk","sudan":"sd","suriname":"sr","sweden":"se","switzerland":"ch","syria":"sy","tajikistan":"tj","tanzania":"tz","thailand":"th","timor-leste":"tl","togo":"tg","tonga":"to","trinidad and tobago":"tt","tunisia":"tn","turkey":"tr","turkmenistan":"tm","tuvalu":"tv","uganda":"ug","ukraine":"ua","united arab emirates":"ae","united kingdom":"gb","united states":"us","united states of america":"us","uruguay":"uy","uzbekistan":"uz","vanuatu":"vu","vatican city":"va","venezuela":"ve","vietnam":"vn","yemen":"ye","zambia":"zm","zimbabwe":"zw"
};

/* ═══════════════════════════════════════════════════════════
 *  3. 初始化与事件绑定 (Initialization & Events)
 * ═══════════════════════════════════════════════════════════ */
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
  if (els.offscreenMap) {
    state.offscreenChart = echarts.init(els.offscreenMap);
  }

  state.chart.on("georoam", () => {
    clearTimeout(state.roamTimeout);
    state.roamTimeout = setTimeout(() => {
      saveMapState();
      const isCityFill = state.currentView.level === "country" && state.fillLevel === "city";
      if (isCityFill) {
        const nextShowCity = (state.currentZoom || 1) >= 9;
        if (state.lastShowCity !== nextShowCity) {
          state.lastShowCity = nextShowCity;
          renderCurrentMap();
        }
      }
    }, 150);
  });

  setupStaticUi();
  await loadWorldMap();
  buildLocationIndex().catch((error) => {
    showToast(`地点索引准备失败：${error.message}`);
  });
  
  if (state.isSharedMode) {
    await loadSharedLogs();
    renderCurrentMap();
  } else {
    restoreSession().catch((error) => {
      showToast(`登录状态恢复失败：${error.message}`);
    });
  }

  window.addEventListener("resize", () => state.chart.resize());
}

/**
 * 检测当前设备是否为触屏设备。
 * 触屏设备使用 2D 世界地图（可靠 click），桌面端使用 3D 地球。
 */
function isTouchDevice() {
  return ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
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
  if(els.shareButton) els.shareButton.addEventListener("click", openShareDialog);
  if(els.shareForm) els.shareForm.addEventListener("submit", generateShareLink);
  if(els.copyShareButton) els.copyShareButton.addEventListener("click", copyShareLink);
  els.backButton.addEventListener("click", () => {
    if (state.currentView.level === "province") {
      loadCountryMap(state.currentView.country);
    } else if (state.currentView.level === "country") {
      loadWorldMap();
    }
  });
  els.ledgerButton.addEventListener("click", openLedger);
  els.closeLedgerButton.addEventListener("click", closeLedger);
  els.drawerScrim.addEventListener("click", closeLedger);
  els.loginForm.addEventListener("submit", login);
  els.footprintForm.addEventListener("submit", saveFootprint);
  
  els.filterToggleButton.addEventListener("click", () => {
    els.filterDropdown.hidden = !els.filterDropdown.hidden;
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#legend")) els.filterDropdown.hidden = true;
  });
  els.filterDropdown.addEventListener("change", handleLegendFilterChange);

  els.yearInput.addEventListener("input", triggerYearChange);
  els.playButton.addEventListener("click", togglePlayback);

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
      state.editingLogId = null;
      els.footprintDialog.close();
    });
  });
  document.querySelectorAll("[data-close-share]").forEach((button) => {
    button.addEventListener("click", () => els.shareDialog.close());
  });
  els.brandButton.addEventListener("click", handleHiddenAdminTap);
  state.chart.on("click", handleMapClick);

  const urlParams = new URLSearchParams(window.location.search);
  const shareToken = urlParams.get('share');
  
  if (shareToken) {
    state.isSharedMode = true;
    state.shareToken = shareToken;
    els.authStatus.textContent = "访客模式 (只读)";
    els.authStatus.hidden = false;
  } else if (location.pathname.endsWith("/admin") || location.hash === "#admin") {
    els.loginButton.hidden = false;
    setTimeout(openLoginDialog, 200);
  }
}

function renderLegend() {
  // 在分享模式下，动态过滤得到仅属于当前分享的数据的可见标签列表
  let visibleTags = companionTags;
  if (state.isSharedMode) {
    const existingTags = new Set(state.logs.map(log => log.companion_type));
    visibleTags = companionTags.filter(tag => existingTags.has(tag.label));
  }

  const allSelected = visibleTags.length > 0 && visibleTags.every((tag) => state.activeCompanionFilters.has(tag.label));
  
  const selectAllHtml = `
    <label class="legend-item">
      <input type="checkbox" value="SELECT_ALL" ${allSelected ? "checked" : ""} />
      <strong>全选</strong>
    </label>
    <div class="legend-divider"></div>
  `;

  const tagsHtml = visibleTags
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

  els.filterDropdown.innerHTML = selectAllHtml + tagsHtml;
}

function handleLegendFilterChange(event) {
  const checkbox = event.target.closest("input[type='checkbox']");
  if (!checkbox) return;

  // 在分享模式下，全选操作仅针对当前分享可见的标签
  let targetTags = companionTags;
  if (state.isSharedMode) {
    const existingTags = new Set(state.logs.map(log => log.companion_type));
    targetTags = companionTags.filter(tag => existingTags.has(tag.label));
  }

  if (checkbox.value === "SELECT_ALL") {
    if (checkbox.checked) {
      state.activeCompanionFilters = new Set(targetTags.map((tag) => tag.label));
    } else {
      state.activeCompanionFilters.clear();
    }
  } else {
    if (checkbox.checked) {
      state.activeCompanionFilters.add(checkbox.value);
    } else {
      state.activeCompanionFilters.delete(checkbox.value);
    }
  }
  
  renderLegend();
  renderCurrentMap();
  renderLedger();
  renderLocationPanel();
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
  els.fillLevelControls.hidden = state.currentView.mapName !== "china";
}


/* ═══════════════════════════════════════════════════════════
 *  4. 认证与会话 (Authentication)
 * ═══════════════════════════════════════════════════════════ */
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
  if (state.isSharedMode) return;
  const isAuthed = Boolean(state.session);
  // 对于管理员，不再显示“已登录”状态文字，仅用隐藏判断
  els.authStatus.hidden = true;
  els.loginButton.hidden = isAuthed || (!isAuthed && !location.pathname.endsWith("/admin") && location.hash !== "#admin");
  els.logoutButton.hidden = !isAuthed;
  els.ledgerButton.hidden = !isAuthed;
  if (els.shareButton) els.shareButton.hidden = !isAuthed;
  renderLocationPanel();
}

function handleHiddenAdminTap() {
  if (state.isSharedMode) return;
  state.hiddenTapCount += 1;
  window.clearTimeout(state.hiddenTapTimer);
  state.hiddenTapTimer = window.setTimeout(() => {
    state.hiddenTapCount = 0;
  }, 1200);
  if (state.hiddenTapCount >= 5) {
    state.hiddenTapCount = 0;
    els.loginButton.hidden = false;
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


/* ═══════════════════════════════════════════════════════════
 *  5. 数据加载 (Data Layer)
 * ═══════════════════════════════════════════════════════════ */
async function loadSharedLogs() {
  setLoading(true, "正在加载分享数据...");
  const { data, error } = await withTimeout(
    state.supabase.rpc('get_shared_footprints', { share_token: state.shareToken }),
    REQUEST_TIMEOUT_MS,
    "读取分享数据超时"
  );

  if (error) {
    setLoading(false);
    showToast("分享链接无效或已过期");
    state.logs = [];
    return;
  }

  state.logs = data || [];

  // 在分享模式下，根据返回的数据动态过滤可见的筛选标签，并默认全选这些可见标签，然后刷新图例渲染
  if (state.isSharedMode) {
    const existingTags = new Set(state.logs.map(log => log.companion_type));
    state.activeCompanionFilters = new Set(
      companionTags.map(tag => tag.label).filter(label => existingTags.has(label))
    );
    renderLegend();
  }

  setLoading(false);
  renderLedger();
  renderLocationPanel();
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


/* ═══════════════════════════════════════════════════════════
 *  6. 地图导航 (Map Navigation)
 *  TODO: v5 - loadCountryMap 增加 countryName 参数支持多国切换
 *  TODO: v5 - 新增 loadWorldMap() 加载世界地图 3D 地球视图
 * ═══════════════════════════════════════════════════════════ */
async function loadWorldMap() {
  clearTimeout(state.roamTimeout);
  state.currentZoom = null;
  state.currentCenter = null;
  const nextView = {
    level: "world",
    mapName: "world",
    title: "Globe",
    province: "",
    adcode: "world",
    country: "世界",
  };
  const loaded = await loadAndRegisterMap("world", "world");
  if (!loaded) return;
  state.currentView = nextView;
  renderCurrentMap();
}

async function loadCountryMap(countryName = "China", isoCode = "") {
  clearTimeout(state.roamTimeout);
  state.currentZoom = null;
  state.currentCenter = null;
  
  if (countryName === "China" || countryName === "china" || countryName === "中国") {
    const nextView = {
      level: "country",
      mapName: "china",
      title: "China",
      province: "",
      adcode: CHINA_ADCODE,
      country: "中国",
    };
    const loaded = await loadAndRegisterMap("china", CHINA_ADCODE);
    if (!loaded) return;
    state.currentView = nextView;
  } else {
    const nextView = {
      level: "country",
      mapName: countryName,
      title: countryName,
      province: "",
      adcode: countryName,
      country: countryName,
    };
    const loaded = await loadAndRegisterMap(countryName, countryName, isoCode);
    if (!loaded) return;
    state.currentView = nextView;
  }
  renderCurrentMap();
}

async function loadProvinceMap(provinceName) {
  clearTimeout(state.roamTimeout);
  state.currentZoom = null;
  state.currentCenter = null;
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
    country: "中国",
  };
  const loaded = await loadAndRegisterMap(nextView.mapName, adcode);
  if (!loaded) return;
  state.currentView = nextView;
  renderCurrentMap();
}

async function loadAndRegisterMap(mapName, adcode, isoCode = "") {
  if (echarts.getMap(mapName)) {
    setLoading(false);
    return true;
  }

  setLoading(true, "正在加载地图...");
  try {
    const geoJson = await loadGeoJson(adcode, isoCode);
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


// TODO: v5 - loadGeoJson 支持中国以外国家的路径格式
async function loadGeoJson(adcode, isoCode = "") {
  if (state.geoJsonCache.has(adcode)) return state.geoJsonCache.get(adcode);

  let urls = [];
  if (adcode === "world") {
    urls = ["./maps/world.json"];
  } else if (adcode === CHINA_ADCODE || provinceNameByAdcode[adcode]) {
    urls = [
      `${LOCAL_CHINA_GEOJSON_BASE}/${adcode}_full.json`,
      `${GEOJSON_BASE}/${adcode}_full.json`,
    ];
  } else {
    // 懒加载外部国家数据：优先使用传入的 isoCode，其次在 countryCodeMap 中查找（大小写不敏感）
    const hcCode = isoCode
      ? isoCode.toLowerCase()
      : (countryCodeMap[adcode.toLowerCase()] || adcode.toLowerCase());
    urls = [
      `https://code.highcharts.com/mapdata/countries/${hcCode}/${hcCode}-all.geo.json`,
      `https://cdn.jsdelivr.net/npm/@highcharts/map-collection@2.2.0/countries/${hcCode}/${hcCode}-all.geo.json`
    ];
    setLoading(true, "加载中（Loading...）");
  }

  const errors = [];

  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
      const geoJson = await response.json();
      
      if (geoJson.UTF8Encoding) {
        if (geoJson.features) {
          geoJson.features.forEach(f => {
            if (f.geometry) decodeGeometry(f.geometry);
          });
        }
        geoJson.UTF8Encoding = false;
      }

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


/* ═══════════════════════════════════════════════════════════
 *  7. 地图渲染 (Map Rendering)
 * ═══════════════════════════════════════════════════════════ */
function getFeatureMetrics(feature) {
  let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
  const processCoords = (coords) => {
    coords.forEach(coord => {
      if (typeof coord[0] === 'number') {
        minLng = Math.min(minLng, coord[0]);
        maxLng = Math.max(maxLng, coord[0]);
        minLat = Math.min(minLat, coord[1]);
        maxLat = Math.max(maxLat, coord[1]);
      } else {
        processCoords(coord);
      }
    });
  };
  if (feature.geometry && feature.geometry.coordinates) {
    processCoords(feature.geometry.coordinates);
    return {
      center: feature.properties?.cp || [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
      lonSpan: maxLng - minLng,
      latSpan: maxLat - minLat
    };
  }
  return { center: feature.properties?.cp || [0, 0], lonSpan: 0, latSpan: 0 };
}

function updateOffscreenWorldMap(seriesData) {
  if (!state.offscreenChart) return null;
  state.offscreenChart.setOption({
    animation: false,
    backgroundColor: '#0a101d', // 海洋颜色
    series: [{
      type: 'map',
      map: 'world',
      left: 0, top: 0, right: 0, bottom: 0,
      boundingCoords: [[-180, 90], [180, -90]],
      itemStyle: {
        areaColor: '#1a242f',
        borderColor: '#2b3846',
      },
      data: seriesData
    }]
  }, true);
  return state.offscreenChart;
}

async function renderCurrentMap() {
  const serial = ++state.renderSerial;
  const { currentView } = state;
  els.mapTitle.textContent = currentView.title;
  
  // 返回按钮逻辑：在世界地图隐藏，在中国/国家级显示“返回世界”，在省级显示“返回全国”
  els.backButton.hidden = currentView.level === "world";
  if (currentView.level === "country") {
    els.backButton.textContent = "🔙 返回世界";
  } else if (currentView.level === "province") {
    els.backButton.textContent = "🔙 返回全国";
  }
  
  syncMapControls();

  const renderTarget = await prepareRenderTarget();
  if (!renderTarget || serial !== state.renderSerial) return;

  const mapChanged = state.lastRenderedMapName !== renderTarget.mapName;
  if (!mapChanged) saveMapState();
  state.lastRenderedMapName = renderTarget.mapName;

  const isCityFill = state.currentView.level === "country" && state.fillLevel === "city" && state.currentView.mapName === "china";
  state.lastShowCity = (state.currentZoom || 1) >= 9;

  const seriesData = buildMapSeriesData();
  const isWorld = state.currentView.level === "world";

  if (isWorld) {
    // ── 触屏设备：渲染 2D 平面世界地图，原生支持 touch click ──
    if (isTouchDevice()) {
      state.chart.setOption({
        backgroundColor: "#0d1b2a",
        tooltip: {
          show: true,
          trigger: "item",
          borderWidth: 0,
          backgroundColor: "rgba(31, 41, 51, 0.9)",
          textStyle: { color: "#fff" },
          formatter: (params) => formatTooltip(params.name),
        },
        globe: undefined,
        series: [{
          type: "map",
          map: "world",
          roam: true,
          scaleLimit: { min: 0.8, max: 20 },
          selectedMode: false,
          animationDurationUpdate: 0,
          label: { show: false },
          emphasis: {
            label: { show: true, color: "#fff", fontWeight: 700 },
            itemStyle: { areaColor: "#f2c66d" },
          },
          itemStyle: {
            areaColor: "#1a3a5c",
            borderColor: "#2b5a8a",
            borderWidth: 0.5,
          },
          data: seriesData,
        }],
      }, true);
      setLoading(false);
      return;
    }

    // ── 桌面端：保持原有 3D 地球体验 ──
    const offChart = updateOffscreenWorldMap(seriesData);
    if (offChart) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    
    const scatterData = [];
    const worldGeo = echarts.getMap("world");
    
    // 针对拥有海外领土或跨越 180 度经线的特殊国家，手动校准其本土核心中心点
    const manualCenters = {
      "United States of America": [-98.5795, 39.8283], // 美国本土
      "United States": [-98.5795, 39.8283],
      "France": [2.2137, 46.2276], // 法国本土
      "United Kingdom": [-3.4359, 55.3780], // 英国本土
      "Russia": [95.0, 60.0] // 俄罗斯中西部核心区
    };

    if (worldGeo && worldGeo.geoJSON) {
      worldGeo.geoJSON.features.forEach(f => {
        const name = f.properties.name || f.properties["hc-a2"];
        if (name) {
          const metrics = getFeatureMetrics(f);
          let center = manualCenters[name] || f.properties.cp || metrics.center;
          const baseSize = Math.sqrt(metrics.lonSpan * Math.abs(metrics.latSpan));
          
          // 动态缩放热区：为移动端提高下限至 50，放大系数提升到 4.5，让点击更容易
          const symbolSize = Math.max(50, Math.min(500, baseSize * 4.5));

          scatterData.push({
            name: name,
            value: [center[0], center[1], 0],
            symbolSize: symbolSize,
            isoCode: f.properties["hc-a2"]
          });
        }
      });
    }

    // 保存散点数据供移动端触摸点击使用
    state.worldScatterData = scatterData;

    setTimeout(() => {
      state.chart.setOption({
        backgroundColor: "#00050a", // 深邃的太空背景色
        tooltip: {
          show: true,
          trigger: "item",
          borderWidth: 0,
          backgroundColor: "rgba(31, 41, 51, 0.9)",
          textStyle: { color: "#fff" },
          formatter: (params) => {
            if (params.seriesType === 'scatter3D') {
               return `<strong>${params.name}</strong>`;
            }
            return formatTooltip(params.name);
          },
        },
        globe: {
          baseTexture: offChart ? offChart.getRenderedCanvas({ pixelRatio: 1 }) : null,
          shading: 'color',
          atmosphere: {
            show: true,
            offset: 8,
            color: '#3060ba',
            glowPower: 6
          },
          environment: '#00050a', 
          viewControl: {
            autoRotate: true,
            autoRotateSpeed: 2,
            autoRotateAfterStill: 5, // 闲置 5 秒后自动恢复旋转
            distance: 180,
            targetCoord: [104, 35], // 默认定位在中国上空
            animationDurationUpdate: 1500,
            animationEasingUpdate: 'cubicInOut'
          }
        },
        series: [{
          type: 'scatter3D',
          coordinateSystem: 'globe',
          blendMode: 'lighter',
          symbolSize: function (val, params) {
            return params.data.symbolSize;
          },
          itemStyle: {
            color: '#ffffff',
            opacity: 0.01 // 极低透明度，防止视觉污染同时确保触控事件触发
          },
          emphasis: {
            itemStyle: {
              opacity: 0.01
            }
          },
          data: scatterData
        }]
      }, true);
      setLoading(false);
    }, 100);
    return;
  }

  const seriesOption = {
    type: "map",
    map: renderTarget.mapName,
    roam: true,
    scaleLimit: { min: 0.8, max: 30 },
    selectedMode: false,
    animationDurationUpdate: 0,
    ...(state.currentZoom != null ? { zoom: state.currentZoom } : {}),
    ...(state.currentCenter ? { center: state.currentCenter } : {}),
    label: {
      show: !isWorld,
      color: "#43505c",
      fontSize: 11,
      formatter: function (params) {
        if (params.name === "南海诸岛") return "南海诸岛";
        if (isCityFill && !state.lastShowCity) {
          if (provinceCapitals.has(params.name)) {
            return state.cityProvinceByName.get(params.name) || params.name;
          }
          return "";
        }
        return params.name;
      }
    },
    emphasis: {
      label: { show: true, color: "#1f2933", fontWeight: 700 },
      itemStyle: { areaColor: "#f2c66d" },
    },
    itemStyle: {
      areaColor: "#dfe8ea",
      borderColor: "#aab9c0",
      borderWidth: 1,
    },
    data: seriesData,
  };

  if (mapChanged) {
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
        series: [seriesOption],
      },
      true,
    );
  } else {
    state.chart.setOption({
      backgroundColor: "#ffffff",
      series: [seriesOption],
    });
  }
  setLoading(false);
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

function decodeCoordinateString(coordinateStr, encodeOffsets) {
  const result = [];
  let prevX = encodeOffsets[0];
  let prevY = encodeOffsets[1];

  for (let i = 0; i < coordinateStr.length; i += 2) {
    let x = coordinateStr.charCodeAt(i) - 64;
    let y = coordinateStr.charCodeAt(i + 1) - 64;
    x = (x >> 1) ^ (-(x & 1));
    y = (y >> 1) ^ (-(y & 1));
    x += prevX;
    y += prevY;
    prevX = x;
    prevY = y;
    result.push([x / 1024, y / 1024]);
  }
  return result;
}

function decodeGeometry(geometry) {
  if (!geometry.encodeOffsets) return;
  if (geometry.type === 'Polygon') {
    geometry.coordinates = geometry.coordinates.map((coordStr, idx) => {
      return typeof coordStr === 'string' 
        ? decodeCoordinateString(coordStr, geometry.encodeOffsets[idx]) 
        : coordStr;
    });
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates = geometry.coordinates.map((polygonCoords, pIdx) => {
      return polygonCoords.map((coordStr, idx) => {
        return typeof coordStr === 'string' 
          ? decodeCoordinateString(coordStr, geometry.encodeOffsets[pIdx][idx])
          : coordStr;
      });
    });
  }
}

async function buildChinaCityGeoJson() {
  const features = [];
  const tasks = Object.entries(provinceAdcodes).map(async ([provinceName, adcode]) => {
    try {
      const geoJson = await loadGeoJson(adcode);
      let featuresToUse = geoJson.features || [];

      featuresToUse.forEach((feature) => {
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

  // 从全国地图中补充南海诸岛
  const chinaMap = echarts.getMap("china");
  if (chinaMap && chinaMap.geoJson) {
    const nanhai = chinaMap.geoJson.features.find(f => f.properties.name === "南海诸岛");
    if (nanhai) {
      features.push(nanhai);
      state.cityProvinceByName.set("南海诸岛", "海南省");
    }
  }

  state.chinaCityGeoJson = { type: "FeatureCollection", features };
  return state.chinaCityGeoJson;
}

function buildMapSeriesData() {
  const regionMap = new Map();
  const logs = state.mapMode === "highlight" ? getVisibleLogs() : [];
  const targetYear = getTargetYear();

  logs.forEach((log) => {
    const key = getRegionKeyFromLog(log);
    if (!key) return;
    const current = regionMap.get(key) || [];
    if (current.length === 0) {
      regionMap.set(key, [log]);
    } else {
      const currentLog = current[0];
      const logDate = new Date(log.visit_date);
      const currentDate = new Date(currentLog.visit_date);
      const logYear = logDate.getFullYear();
      const currentYear = currentDate.getFullYear();
      const dateDiff = currentDate.getTime() - logDate.getTime();
      
      let shouldReplace = false;
      if (targetYear) {
        if (logYear > currentYear) {
          shouldReplace = true;
        } else if (logYear < currentYear) {
          shouldReplace = false;
        } else {
          shouldReplace = dateDiff > 0;
        }
      } else {
        shouldReplace = dateDiff > 0;
      }

      if (shouldReplace) {
        regionMap.set(key, [log]);
      } else if (dateDiff === 0) {
        if (!current.some(c => c.companion_type === log.companion_type)) {
          current.push(log);
        }
      }
    }
  });

  return Array.from(regionMap.entries()).map(([name, logList]) => {
    const colors = logList.map((l) => getCompanionColor(l.companion_type));
    let areaColor = colors[0];
    if (colors.length > 1) {
      areaColor = {
        type: 'linear', x: 0, y: 0, x2: 1, y2: 1,
        colorStops: colors.map((c, i) => ({ offset: i / (colors.length - 1), color: c }))
      };
    }

    return {
      name,
      value: 1,
      itemStyle: {
        areaColor,
        borderColor: "#ffffff",
        borderWidth: 1.4,
      },
    };
  });
}

function getRegionKeyFromLog(log) {
  if (state.currentView.level === "world") {
    // Return English name for offscreen ECharts world map matching
    const map = {
      "中国": "China", "美国": "United States", "日本": "Japan", "韩国": "Korea",
      "英国": "United Kingdom", "法国": "France", "德国": "Germany", "俄罗斯": "Russia",
      "澳大利亚": "Australia", "加拿大": "Canada", "意大利": "Italy", "西班牙": "西班牙",
      "泰国": "Thailand", "新加坡": "Singapore", "马来西亚": "Malaysia", "越南": "Vietnam",
      "United States of America": "United States"
    };
    return map[log.country] || log.country;
  }
  if (state.currentView.level === "country") {
    if (state.fillLevel === "city" && state.currentView.mapName === "china") return log.city || "";
    return log.province;
  }
  if (log.province !== state.currentView.province) return "";
  return log.city || "";
}

function getTargetYear() {
  return els.yearInput.value ? parseInt(els.yearInput.value, 10) : null;
}

function filterByYear(logs) {
  const targetYear = getTargetYear();
  if (!targetYear) return logs;
  return logs.filter((log) => new Date(log.visit_date).getFullYear() <= targetYear);
}

function getVisibleLogs() {
  if (!state.session && !state.isSharedMode) return [];
  return filterByYear(
    state.logs.filter((log) => state.activeCompanionFilters.has(log.companion_type))
  );
}


/* ═══════════════════════════════════════════════════════════
 *  8. 搜索与地点管理 (Search & Location)
 * ═══════════════════════════════════════════════════════════ */
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
      country: "中国",
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

  const worldGeo = echarts.getMap("world");
  if (worldGeo && worldGeo.geoJSON) {
    worldGeo.geoJSON.features.forEach((f) => {
      const name = f.properties.name || f.properties["hc-a2"];
      if (name && name !== "China" && name !== "中国") {
        const location = {
          key: `country:${name}`,
          type: "country",
          country: name,
          province: "",
          city: "",
          adcode: name,
          label: name,
          meta: "国家",
          searchText: name.toLocaleLowerCase(),
        };
        locations.push(location);
        lookup.set(location.key, location);
      }
    });
  }

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
  let inputValue = location.province;
  if (location.type === "city") inputValue = `${location.province} ${location.city}`;
  if (location.type === "country") inputValue = location.country;
  
  els.locationSearchInput.value = inputValue;
  els.searchResults.hidden = true;
  els.clearSearchButton.hidden = false;
  renderLocationPanel();

  if (location.type === "country") {
    await loadCountryMap(location.country);
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
  const canCreate = Boolean(state.session) && !state.isSharedMode;

  els.locationPanel.innerHTML = `
    <div class="location-header">
      <div>
        <p class="eyebrow">${escapeHtml(headerMeta)}</p>
        <h2>${escapeHtml(location.label)}</h2>
      </div>
      <div class="location-actions" ${state.isSharedMode ? 'hidden' : ''}>
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
  if (!state.session && !state.isSharedMode) return `<p class="empty-state">登录后可以查看和管理这个地点的足迹。</p>`;
  if (!logs.length) return `<p class="empty-state">这个地点还没有足迹记录。</p>`;

  return logs
    .map(
      (log) => `
        <article class="history-row">
          <time>${formatMonth(log.visit_date)}</time>
          <div>
            <strong>${escapeHtml(log.companion_type)}</strong>
            <small>${escapeHtml(getLogLocationLabel(log))}</small>
          </div>
          ${!state.isSharedMode ? `
          <div class="history-actions">
            <button class="tool-button" type="button" data-location-action="edit" data-edit-id="${escapeHtml(log.id)}">修改</button>
            <button class="delete-button" type="button" data-location-action="delete" data-delete-id="${escapeHtml(log.id)}">删除</button>
          </div>
          ` : ''}
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

  if (action === "edit") {
    editFootprint(actionEl.dataset.editId);
  }

  if (action === "delete") {
    deleteFootprint(actionEl.dataset.deleteId);
  }
}

function getLogsForLocation(location) {
  if (!state.session || !location) return [];
  return getVisibleLogs()
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
  const matchedLogs = getLogsForRegion(regionName, { ignoreTagFilter: false });
  const title = `<strong>${regionName}</strong>`;
  if (!state.session && !state.isSharedMode) return `${title}<br/>登录后可查看足迹`;
  if (state.mapMode === "plain") return `${title}<br/>普通地图模式未显示足迹`;
  if (!matchedLogs.length) return `${title}<br/>暂无足迹`;

  const rows = matchedLogs
    .map((log) => {
      return `${formatMonth(log.visit_date)}｜${escapeHtml(log.companion_type)}`;
    })
    .join("<br/>");
  return `${title}<br/>${rows}`;
}

function getLogsForRegion(regionName, { ignoreTagFilter = false } = {}) {
  const baseLogs = ignoreTagFilter
    ? filterByYear(state.logs)
    : getVisibleLogs();
  return baseLogs
    .filter((log) => {
      if (state.currentView.level === "world") {
        return log.country === regionName;
      }
      if (state.currentView.level === "country") {
        if (state.fillLevel === "city" && state.currentView.mapName === "china") return log.city === regionName;
        return log.province === regionName;
      }
      return log.province === state.currentView.province && log.city === regionName;
    })
    .sort((a, b) => compareLogDate(b, a));
}

function handleMapClick(params) {
  if (!params.name) return;

  if (state.currentView.level === "world") {
    const isoCode = params.data && params.data.isoCode ? params.data.isoCode : "";
    const targetCenter = params.data && params.data.value ? params.data.value : null;

    // 触屏设备使用 2D 世界地图，直接下钻，无 3D 动画
    if (isTouchDevice() || !targetCenter) {
      loadCountryMap(params.name, isoCode);
      return;
    }

    // ── 以下为桌面端 3D 地球俯冲动画逻辑 ──
    const mapEl = els.map;
    const w = mapEl.offsetWidth;
    const h = mapEl.offsetHeight;

    // 获取点击位置（scatter3D 的事件对象）
    const evt = params.event && params.event.event ? params.event.event : params.event;
    let clickX = w / 2, clickY = h / 2;
    if (evt && evt.offsetX != null) {
      clickX = evt.offsetX;
      clickY = evt.offsetY;
    }

    // 计算平移量：将点击点移到画布中央（模拟"旋转居中"）
    const dx = (w / 2 - clickX) / 6;  // 除以缩放倍数做归一化
    const dy = (h / 2 - clickY) / 6;

    // 设置 CSS 变量驱动 @keyframes drill-dive
    mapEl.style.setProperty('--tx', `${dx}px`);
    mapEl.style.setProperty('--ty', `${dy}px`);
    mapEl.style.transformOrigin = `${clickX}px ${clickY}px`;

    // === 阶段一：触发俯冲动画 (2s) ===
    mapEl.classList.add('drill-animating');

    // === 阶段二：俯冲到 40% 时，云层从上下涌入 ===
    setTimeout(() => {
      els.loadingMask.classList.add("drill-transition");
      setLoading(true, "");
    }, 800);

    // === 阶段三：动画结束后，在云层下切换到 2D 地图，然后云层打开 ===
    setTimeout(async () => {
      // 移除俯冲动画（此时被云层完全遮盖）
      mapEl.classList.remove('drill-animating');
      mapEl.style.removeProperty('--tx');
      mapEl.style.removeProperty('--ty');
      mapEl.style.transformOrigin = '';

      // 加载 2D 地图
      await loadCountryMap(params.name, isoCode);

      // 2D 地图就绪 → 云层打开，揭开地图
      els.loadingMask.classList.remove("drill-transition");
      els.loadingMask.classList.add("drill-fade-out");
      setLoading(true, ""); // 保持 mask 可见，让云层动画播放
      setTimeout(() => {
        els.loadingMask.classList.remove("drill-fade-out");
        setLoading(false);
      }, 950);
    }, 2100);
    return;
  }


  if (state.currentView.level === "country") {
    // 仅中国地图支持省份下钻，其他国家由于暂无二级地图，点击不触发下钻及动画
    if (state.currentView.mapName !== "china") return;

    if (state.fillLevel === "city" && state.currentView.mapName === "china") {
      const province = state.cityProvinceByName.get(params.name);
      if (!province) return;
      if (state.isSharedMode) return;
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

    // 2D 视角下钻（无遮罩，纯粹的缩放与淡出淡入）
    const mapEl = els.map;
    const w = mapEl.offsetWidth;
    const h = mapEl.offsetHeight;

    // 获取点击位置
    const evt = params.event && params.event.event ? params.event.event : params.event;
    let clickX = w / 2, clickY = h / 2;
    if (evt && evt.offsetX != null) {
      clickX = evt.offsetX;
      clickY = evt.offsetY;
    }

    // 计算平移量，让点击区域尽量靠向中心
    const dx = (w / 2 - clickX) / 1.5;
    const dy = (h / 2 - clickY) / 1.5;

    mapEl.style.setProperty('--tx', `${dx}px`);
    mapEl.style.setProperty('--ty', `${dy}px`);
    mapEl.style.transformOrigin = `${clickX}px ${clickY}px`;

    // 触发简单的缩放淡出动画
    mapEl.classList.add('drill-simple-animating');

    // 动画结束时加载数据并淡入新地图
    setTimeout(async () => {
      // 保持加载状态，防止渲染时的卡顿感
      setLoading(true, ""); 
      
      // 加载并渲染省份/州市地图
      await loadProvinceMap(params.name);

      // 移除淡出动画
      mapEl.classList.remove('drill-simple-animating');
      mapEl.style.removeProperty('--tx');
      mapEl.style.removeProperty('--ty');
      mapEl.style.transformOrigin = '';

      setLoading(false);

      // 触发淡入动画
      mapEl.classList.add('drill-simple-fade-in');
      
      // 动画完成后清理 class
      setTimeout(() => {
        mapEl.classList.remove('drill-simple-fade-in');
      }, 600);
    }, 600);

    return;
  }

  if (state.isSharedMode) return;
  if (!state.session) {
    showToast("请先以管理员身份登录");
    return;
  }

  openFootprintDialog({
    country: state.currentView.country,
    province: state.currentView.level === "province" ? state.currentView.province : params.name,
    city: state.currentView.level === "province" ? params.name : null,
  });
}


/* ═══════════════════════════════════════════════════════════
 *  9. 足迹 CRUD (Footprint Operations)
 * ═══════════════════════════════════════════════════════════ */
function editFootprint(id) {
  const target = state.logs.find((log) => log.id === id);
  if (!target) return;
  
  state.editingLogId = id;
  state.pendingLocation = {
    country: target.country,
    province: target.province,
    city: target.city
  };
  
  els.footprintMessage.textContent = "";
  els.visitMonthInput.value = formatMonth(target.visit_date);
  els.companionInput.value = target.companion_type;
  els.remarkInput.value = target.remark || "";
  
  const locationName = getLocationDisplayName(state.pendingLocation);
  document.querySelector("#footprintDialogEyebrow").textContent = "修改足迹";
  els.footprintDialogTitle.textContent = `修改到访 ${locationName}`;
  els.lockedLocation.innerHTML = `
    <strong>${escapeHtml(formatLocationPath(state.pendingLocation))}</strong>
    <br />
    <small>位置已自动锁定</small>
  `;
  els.footprintDialog.showModal();
}

function openFootprintDialog(locationInfo) {
  state.editingLogId = null;
  state.pendingLocation = locationInfo;
  els.footprintMessage.textContent = "";
  els.remarkInput.value = "";
  els.visitMonthInput.value = getCurrentMonthValue();
  els.companionInput.value = companionTags[0].label;
  const locationName = getLocationDisplayName(locationInfo);
  document.querySelector("#footprintDialogEyebrow").textContent = "新增足迹";
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

  let error;
  if (state.editingLogId) {
    const res = await state.supabase.from(FOOTPRINT_TABLE).update(payload).eq("id", state.editingLogId);
    error = res.error;
  } else {
    const res = await state.supabase.from(FOOTPRINT_TABLE).insert(payload);
    error = res.error;
  }

  if (error) {
    els.footprintMessage.textContent = `保存失败：${error.message}`;
    return;
  }

  state.pendingLocation = null;
  state.editingLogId = null;
  els.footprintDialog.close();
  showToast("足迹已保存");
  await loadLogs();
  renderCurrentMap();
}


/* ═══════════════════════════════════════════════════════════
 * 9.5 分享功能 (Sharing)
 * ═══════════════════════════════════════════════════════════ */
function openShareDialog() {
  els.shareMessage.textContent = "";
  els.shareMessage.style.color = "var(--muted)";
  els.shareResultArea.hidden = true;
  els.shareExpireInput.value = "7";
  els.shareLabelInput.value = "";
  els.generateShareButton.hidden = false;

  // 动态渲染供分享的标签选择框，默认全选
  if (els.shareTagsContainer) {
    els.shareTagsContainer.innerHTML = companionTags
      .map(
        (tag) => `
          <label class="share-tag-item">
            <input type="checkbox" value="${escapeHtml(tag.label)}" checked />
            <span class="share-tag-dot" style="background:${tag.color}"></span>
            ${escapeHtml(tag.label)}
          </label>
        `
      )
      .join("");
  }

  els.shareDialog.showModal();
}

async function generateShareLink(event) {
  event.preventDefault();
  if (!state.session) return;

  // 获取选择的分享标签
  const checkedBoxes = els.shareTagsContainer ? els.shareTagsContainer.querySelectorAll("input[type='checkbox']:checked") : [];
  const allowedCompanions = Array.from(checkedBoxes).map(cb => cb.value);

  // 零勾选拦截逻辑
  if (allowedCompanions.length === 0) {
    els.shareMessage.style.color = "var(--danger)";
    els.shareMessage.textContent = "错误：请至少选择一个允许分享的标签！";
    return;
  }

  els.shareMessage.style.color = "var(--muted)";
  els.shareMessage.textContent = "正在生成...";
  els.generateShareButton.disabled = true;

  const expireDays = parseInt(els.shareExpireInput.value, 10);
  let expiresAt = null;
  if (expireDays > 0) {
    const d = new Date();
    d.setDate(d.getDate() + expireDays);
    expiresAt = d.toISOString();
  }

  // 生成 32 位随机 token
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

  const { error } = await state.supabase.from('share_tokens').insert({
    token: token,
    label: els.shareLabelInput.value.trim() || null,
    expires_at: expiresAt,
    allowed_companions: allowedCompanions
  });

  els.generateShareButton.disabled = false;

  if (error) {
    els.shareMessage.style.color = "var(--danger)";
    els.shareMessage.textContent = `生成失败：${error.message}`;
    return;
  }

  els.shareMessage.style.color = "var(--accent)";
  els.shareMessage.textContent = "生成成功！";
  
  // 构建分享链接
  const shareUrl = new URL(window.location.href);
  shareUrl.searchParams.set('share', token);
  shareUrl.hash = ''; // 清除 hash
  
  els.shareLinkInput.value = shareUrl.toString();
  els.shareResultArea.hidden = false;
  els.generateShareButton.hidden = true;
}

function copyShareLink() {
  els.shareLinkInput.select();
  document.execCommand("copy");
  showToast("链接已复制到剪贴板");
}

/* ═══════════════════════════════════════════════════════════
 * 10. 足迹簿抽屉 (Ledger Drawer)
 * ═══════════════════════════════════════════════════════════ */
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
  if (!state.session && !state.isSharedMode) {
    els.ledgerList.innerHTML = `<p class="empty-state">登录后可以查看足迹簿。</p>`;
    return;
  }
  
  const visibleLogs = getVisibleLogs();
  
  if (!visibleLogs.length) {
    els.ledgerList.innerHTML = `<p class="empty-state">当前没有符合筛选条件的足迹记录。</p>`;
    return;
  }

  let currentMonth = null;
  const listHtml = visibleLogs
    .map((log) => {
      const month = formatMonth(log.visit_date);
      let monthHeader = "";
      if (month !== currentMonth) {
        monthHeader = `<h3 class="timeline-month">${month}</h3>`;
        currentMonth = month;
      }
      return `
        ${monthHeader}
        <article class="log-card timeline-card" ${log.remark ? `data-toggle-remark="true"` : ""}>
          <header>
            <div>
              <strong>${escapeHtml(getLogLocationLabel(log))}</strong>
              <small>
                ${month} ｜ ${escapeHtml(log.companion_type)}
              </small>
            </div>
            ${!state.isSharedMode ? `
            <div class="history-actions">
              <button class="tool-button" type="button" data-edit-id="${log.id}">修改</button>
              <button class="delete-button" type="button" data-delete-id="${log.id}">删除</button>
            </div>
            ` : ''}
          </header>
          ${
            log.remark
              ? `
            <div class="log-remark">
              <div class="log-remark-inner">
                <p><strong>📝 备注：</strong>${escapeHtml(log.remark)}</p>
              </div>
            </div>
          `
              : ""
          }
        </article>
      `;
    })
    .join("");

  els.ledgerList.innerHTML = `<div class="timeline">${listHtml}</div>`;

  els.ledgerList.querySelectorAll("[data-toggle-remark]").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      card.classList.toggle("expanded");
    });
  });

  els.ledgerList.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => deleteFootprint(button.dataset.deleteId));
  });
  els.ledgerList.querySelectorAll("[data-edit-id]").forEach((button) => {
    button.addEventListener("click", () => editFootprint(button.dataset.editId));
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


/* ═══════════════════════════════════════════════════════════
 * 12. 工具函数 (Utilities)
 * ═══════════════════════════════════════════════════════════ */
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
  if (state.currentView.level === "world") {
    return [log.country, log.province].filter(Boolean).join(" ") || log.country || "未知地点";
  } else {
    return [log.province, log.city].filter(Boolean).join(" ") || log.province || log.country || "未知地点";
  }
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

function saveMapState() {
  if (!state.chart) return;
  try {
    const view = state.chart.getModel().getSeriesByIndex(0).coordinateSystem;
    if (view && view.getZoom) {
      state.currentZoom = view.getZoom();
      state.currentCenter = view.getCenter();
      return;
    }
  } catch (e) {}
  const option = state.chart.getOption();
  if (option && option.series && option.series.length > 0) {
    state.currentZoom = option.series[0].zoom || 1;
    state.currentCenter = option.series[0].center || null;
  }
}


/* ═══════════════════════════════════════════════════════════
 * 11. 时间轴与播放 (Playback)
 * ═══════════════════════════════════════════════════════════ */
function togglePlayback() {
  if (state.playbackInterval) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

function startPlayback() {
  const filteredLogs = state.logs.filter((log) => state.activeCompanionFilters.has(log.companion_type));
  if (!filteredLogs.length) return;

  state.prePlaybackYear = els.yearInput.value;

  const allYears = Array.from(new Set(filteredLogs.map(l => new Date(l.visit_date).getFullYear()))).sort((a, b) => a - b);
  const endYear = els.yearInput.value ? parseInt(els.yearInput.value, 10) : new Date().getFullYear();
  
  const playbackYears = allYears.filter(y => y <= endYear);
  if (!playbackYears.length) return;

  if (playbackYears[playbackYears.length - 1] < endYear) {
    playbackYears.push(endYear);
  }

  let currentIndex = 0;
  els.yearInput.value = playbackYears[currentIndex];
  triggerYearChange();

  els.playButton.innerHTML = "⏸ 停止";
  els.playButton.classList.add("playing");

  state.playbackInterval = setInterval(() => {
    currentIndex++;
    if (currentIndex >= playbackYears.length) {
      els.yearInput.value = state.prePlaybackYear || "";
      triggerYearChange();
      stopPlayback();
      return;
    }
    els.yearInput.value = playbackYears[currentIndex];
    triggerYearChange();
  }, 1500);
}

function stopPlayback() {
  clearInterval(state.playbackInterval);
  state.playbackInterval = null;
  els.playButton.innerHTML = "▶ 演示";
  els.playButton.classList.remove("playing");
}

function triggerYearChange() {
  const y = els.yearInput.value;
  if (y) {
    els.yearOverlay.textContent = y;
    els.yearOverlay.hidden = false;
  } else {
    els.yearOverlay.hidden = true;
  }
  renderCurrentMap();
  renderLedger();
  renderLocationPanel();
}
