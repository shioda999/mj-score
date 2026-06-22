const tileDefs = [
  ...Array.from({ length: 9 }, (_, i) => ({ id: `m${i + 1}`, label: `${i + 1}萬`, suit: "m", value: i + 1 })),
  ...Array.from({ length: 9 }, (_, i) => ({ id: `p${i + 1}`, label: `${i + 1}筒`, suit: "p", value: i + 1 })),
  ...Array.from({ length: 9 }, (_, i) => ({ id: `s${i + 1}`, label: `${i + 1}索`, suit: "s", value: i + 1 })),
  { id: "z1", label: "東", suit: "z", value: 1 },
  { id: "z2", label: "南", suit: "z", value: 2 },
  { id: "z3", label: "西", suit: "z", value: 3 },
  { id: "z4", label: "北", suit: "z", value: 4 },
  { id: "z5", label: "白", suit: "z", value: 5 },
  { id: "z6", label: "發", suit: "z", value: 6 },
  { id: "z7", label: "中", suit: "z", value: 7 },
];

const state = {
  selected: [],
  melds: [],
  callMode: null,
  changeWinningTileMode: false,
  notice: "",
  players: 4,
  win: "tsumo",
};

const $ = (id) => document.getElementById(id);
const tileById = Object.fromEntries(tileDefs.map((tile) => [tile.id, tile]));
const order = Object.fromEntries(tileDefs.map((tile, index) => [tile.id, index]));
const storageKey = "mj-score-inputs-v1";
const savedInputIds = [
  "roundWind",
  "seatWind",
  "dora",
  "honba",
  "tsumoLoss",
  "riichi",
  "doubleRiichi",
  "ippatsu",
  "qianggang",
  "lingshang",
  "haidi",
  "chiho",
];

function saveInputs() {
  const inputs = Object.fromEntries(savedInputIds.map((id) => {
    const input = $(id);
    return [id, input.type === "checkbox" ? input.checked : input.value];
  }));
  const data = {
    version: 1,
    selected: state.selected,
    melds: state.melds,
    players: state.players,
    win: state.win,
    inputs,
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
  }
  catch {
    // 保存できない環境でも点数計算はそのまま利用できるようにする。
  }
}

function restoreInputs() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem(storageKey));
  }
  catch {
    return;
  }
  if (!data || data.version !== 1) return;

  const validTile = (id) => Object.hasOwn(tileById, id);
  if (Array.isArray(data.selected) && data.selected.every(validTile)) {
    state.selected = data.selected.slice(0, 14);
  }
  if (Array.isArray(data.melds)) {
    state.melds = data.melds.slice(0, 4).flatMap((meld) => {
      if (!meld || !["pon", "chi", "minkan", "ankan"].includes(meld.type)) return [];
      if (!Array.isArray(meld.ids) || !meld.ids.every(validTile)) return [];
      return [{ type: meld.type, ids: meld.ids, code: meldCode(meld.type, meld.ids) }];
    });
  }
  if ([3, 4].includes(data.players)) state.players = data.players;
  if (["ron", "tsumo"].includes(data.win)) state.win = data.win;

  if (data.inputs && typeof data.inputs === "object") {
    savedInputIds.forEach((id) => {
      if (!(id in data.inputs)) return;
      const input = $(id);
      if (input.type === "checkbox") input.checked = Boolean(data.inputs[id]);
      else input.value = data.inputs[id];
    });
  }

  document.querySelectorAll("[data-mode]").forEach((button) => {
    const value = button.dataset.mode === "players" ? Number(button.dataset.value) : button.dataset.value;
    button.classList.toggle("active", state[button.dataset.mode] === value);
  });
}

function createTileImage(id) {
  const image = document.createElement("img");
  image.src = `imgs/${id}.gif`;
  image.alt = tileById[id].label;
  image.draggable = false;
  return image;
}

function renderTiles() {
  const groups = { m: $("manzu"), p: $("pinzu"), s: $("souzu"), z: $("honors") };
  tileDefs.forEach((tile) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tile";
    button.appendChild(createTileImage(tile.id));
    button.setAttribute("aria-label", tile.label);
    button.title = tile.label;
    button.dataset.tile = tile.id;
    button.addEventListener("click", () => addTile(tile.id));
    groups[tile.suit].appendChild(button);
  });
}

function addTile(id) {
  if (state.callMode) {
    createMeld(state.callMode, id);
    return;
  }
  const target = concealedTileTarget();
  if (state.selected.length >= target) {
    state.notice = `副露を含めると、手牌は${target}枚までです。`;
    calculate();
    return;
  }
  if (totalTileCount(id) >= 4) {
    state.notice = `${tileById[id].label}は4枚までです。`;
    calculate();
    return;
  }
  state.selected.push(id);
  state.notice = "";
  calculate();
}

function concealedTileTarget() {
  return 14 - state.melds.length * 3;
}

function meldIds(type, startId) {
  const tile = tileById[startId];
  if (type === "pon") return [startId, startId, startId];
  if (type === "minkan" || type === "ankan") return [startId, startId, startId, startId];
  if (tile.suit === "z" || tile.value > 7) return null;
  return [startId, `${tile.suit}${tile.value + 1}`, `${tile.suit}${tile.value + 2}`];
}

function meldCode(type, ids) {
  const suit = tileById[ids[0]].suit;
  const digits = ids.map((id) => tileById[id].value).join("");
  if (type === "chi") return `${suit}${digits}-`;
  if (type === "ankan") return `${suit}${digits}`;
  return `${suit}${digits}+`;
}

function totalTileCount(id) {
  const concealed = state.selected.filter((tile) => tile === id).length;
  const called = state.melds.reduce(
    (sum, meld) => sum + meld.ids.filter((tile) => tile === id).length,
    0,
  );
  return concealed + called;
}

function setCallMode(mode) {
  state.callMode = state.callMode === mode ? null : mode;
  const callLabels = {
    pon: "ポン",
    minkan: "明槓",
    ankan: "暗槓",
    chi: "チー",
  };
  state.notice = state.callMode
    ? `${callLabels[mode]}する牌を選択してください。`
    : "";
  calculate();
}

function createMeld(type, startId) {
  if (state.melds.length >= 4) {
    state.notice = "副露は4面子までです。";
    calculate();
    return;
  }
  const ids = meldIds(type, startId);
  if (!ids) {
    state.notice = "チーは数牌の1〜7から選択してください。";
    calculate();
    return;
  }
  const additions = {};
  ids.forEach((id) => {
    additions[id] = (additions[id] || 0) + 1;
  });
  const overflow = Object.entries(additions).find(([id, count]) => totalTileCount(id) + count > 4);
  if (overflow) {
    state.notice = `${tileById[overflow[0]].label}が5枚以上になるため実行できません。`;
    calculate();
    return;
  }
  if (state.selected.length > concealedTileTarget() - 3) {
    state.notice = "現在の手牌枚数では副露を追加できません。先に牌を削除してください。";
    calculate();
    return;
  }
  state.melds.push({ type, ids, code: meldCode(type, ids) });
  state.callMode = null;
  state.notice = "";
  calculate();
}

function countsFromSelected() {
  const counts = Object.fromEntries(tileDefs.map((tile) => [tile.id, 0]));
  state.selected.forEach((id) => {
    counts[id] += 1;
  });
  state.melds.forEach((meld) => {
    meld.ids.forEach((id) => {
      counts[id] += 1;
    });
  });
  return counts;
}

function buildShoupai() {
  const body = state.selected.slice(0, -1);
  const winTile = state.selected.at(-1);
  const shoupai = new Majiang.Shoupai(body);
  shoupai._fulou = state.melds.map((meld) => meld.code);
  if (state.win === "tsumo") {
    shoupai.zimo(winTile);
    return { shoupai, rongpai: null };
  }
  return { shoupai, rongpai: `${winTile}+` };
}

function isOpenHand() {
  return state.melds.some((meld) => ["pon", "chi", "minkan"].includes(meld.type));
}

function normalizeManualYaku() {
  if ($("doubleRiichi").checked) $("riichi").checked = false;
  if ($("riichi").checked) $("doubleRiichi").checked = false;
  const open = isOpenHand();
  const hasKan = state.melds.some((meld) => meld.type === "minkan" || meld.type === "ankan");
  ["riichi", "doubleRiichi", "ippatsu"].forEach((id) => {
    $(id).disabled = open;
    if (open) $(id).checked = false;
  });
  const availability = {
    qianggang: state.win === "ron",
    lingshang: state.win === "tsumo" && hasKan,
    haidi: state.win === "tsumo",
    chiho: state.win === "tsumo" && !open,
  };
  Object.entries(availability).forEach(([id, enabled]) => {
    $(id).disabled = !enabled;
    if (!enabled) $(id).checked = false;
  });
  if ($("qianggang").checked) {
    $("lingshang").checked = false;
    $("haidi").checked = false;
  }
  if ($("lingshang").checked) {
    $("qianggang").checked = false;
    $("haidi").checked = false;
  }
  if ($("haidi").checked) {
    $("qianggang").checked = false;
    $("lingshang").checked = false;
  }
}

function makeParam() {
  normalizeManualYaku();
  return Majiang.Util.hule_param({
    zhuangfeng: Number($("roundWind").value),
    menfeng: Number($("seatWind").value),
    lizhi: $("doubleRiichi").checked ? 2 : $("riichi").checked ? 1 : 0,
    yifa: $("ippatsu").checked,
    qianggang: $("qianggang").checked,
    lingshang: $("lingshang").checked,
    haidi: $("haidi").checked ? 1 : 0,
    tianhu: $("chiho").checked ? (Number($("seatWind").value) === 0 ? 1 : 2) : 0,
    changbang: Number($("honba").value || 0),
    lizhibang: 0,
    baopai: [],
    fubaopai: [],
  });
}

function evaluateHand() {
  if (state.selected.length !== concealedTileTarget() || !window.Majiang) return null;
  try {
    const { shoupai, rongpai } = buildShoupai();
    return Majiang.Util.hule(shoupai, rongpai, makeParam());
  }
  catch (error) {
    return { error };
  }
}

function tileFuValue(id) {
  const tile = tileById[id];
  if (tile.suit === "z") return 4;
  if (tile.value === 1 || tile.value === 9) return 4;
  return 2;
}

function findStandardShapes(counts) {
  const ids = tileDefs.map((tile) => tile.id);
  const results = [];

  function removeMelds(localCounts, melds) {
    const first = ids.find((id) => localCounts[id] > 0);
    if (!first) {
      results.push(melds.slice());
      return;
    }

    if (localCounts[first] >= 3) {
      localCounts[first] -= 3;
      melds.push({ type: "triplet", ids: [first, first, first] });
      removeMelds(localCounts, melds);
      melds.pop();
      localCounts[first] += 3;
    }

    const tile = tileById[first];
    if (tile.suit !== "z" && tile.value <= 7) {
      const second = `${tile.suit}${tile.value + 1}`;
      const third = `${tile.suit}${tile.value + 2}`;
      if (localCounts[second] > 0 && localCounts[third] > 0) {
        localCounts[first] -= 1;
        localCounts[second] -= 1;
        localCounts[third] -= 1;
        melds.push({ type: "sequence", ids: [first, second, third] });
        removeMelds(localCounts, melds);
        melds.pop();
        localCounts[first] += 1;
        localCounts[second] += 1;
        localCounts[third] += 1;
      }
    }
  }

  ids.forEach((id) => {
    if (counts[id] >= 2) {
      const localCounts = { ...counts };
      localCounts[id] -= 2;
      const before = results.length;
      removeMelds(localCounts, []);
      for (let i = before; i < results.length; i += 1) {
        results[i] = { pair: id, melds: results[i] };
      }
    }
  });

  return results.slice(0, 16);
}

function isChitoitsu(counts) {
  return Object.values(counts).filter((count) => count === 2).length === 7;
}

function isKokushi(counts) {
  const terminals = ["m1", "m9", "p1", "p9", "s1", "s9", "z1", "z2", "z3", "z4", "z5", "z6", "z7"];
  return terminals.every((id) => counts[id] >= 1) && terminals.some((id) => counts[id] >= 2);
}

function calculateFallbackFu(counts) {
  if (isChitoitsu(counts)) return 25;
  const shapes = findStandardShapes(counts);
  if (!shapes.length) return 30;
  const windMap = ["z1", "z2", "z3", "z4"];
  const winTile = state.selected.at(-1);
  const candidates = shapes.map((shape) => {
    let fu = 20;
    if (state.win === "tsumo") fu += 2;
    if (state.win === "ron" && !isOpenHand()) fu += 10;
    if (["z5", "z6", "z7"].includes(shape.pair)) fu += 2;
    if (shape.pair === windMap[Number($("roundWind").value)]) fu += 2;
    if (shape.pair === windMap[Number($("seatWind").value)]) fu += 2;
    if (shape.pair === winTile) fu += 2;
    shape.melds.forEach((meld) => {
      if (meld.type === "triplet") fu += tileFuValue(meld.ids[0]);
    });
    return Math.ceil(fu / 10) * 10;
  });
  return Math.max(30, Math.min(...candidates));
}

function basePoint(fu, han) {
  if (han >= 13) return { base: 8000, label: "数え役満" };
  if (han >= 11) return { base: 6000, label: "三倍満" };
  if (han >= 8) return { base: 4000, label: "倍満" };
  if (han >= 6) return { base: 3000, label: "跳満" };
  const raw = fu * (2 ** (han + 2));
  if (han >= 5 || raw >= 2000) return { base: 2000, label: "満貫" };
  return { base: raw, label: "" };
}

function ceil100(value) {
  return Math.ceil(value / 100) * 100;
}

function formatPayment(base, dealer, honba, label) {
  const bonusRon = honba * 300;
  const bonusTsumoEach = honba * 100;
  if (state.win === "ron") {
    const total = ceil100(base * (dealer ? 6 : 4)) + bonusRon;
    return `${total.toLocaleString()}点${label ? ` (${label})` : ""}`;
  }
  if (state.players === 3 && !$("tsumoLoss").checked) {
    if (dealer) {
      const each = ceil100(base * 3) + bonusTsumoEach;
      return `各${each.toLocaleString()}点${label ? ` (${label})` : ""}`;
    }
    const child = ceil100(base * 1.5) + bonusTsumoEach;
    const parent = ceil100(base * 2.5) + bonusTsumoEach;
    return `子${child.toLocaleString()} / 親${parent.toLocaleString()}点${label ? ` (${label})` : ""}`;
  }
  if (dealer) {
    const each = ceil100(base * 2) + bonusTsumoEach;
    return `各${each.toLocaleString()}点${label ? ` (${label})` : ""}`;
  }
  const child = ceil100(base) + bonusTsumoEach;
  const parent = ceil100(base * 2) + bonusTsumoEach;
  return `子${child.toLocaleString()} / 親${parent.toLocaleString()}点${label ? ` (${label})` : ""}`;
}

function pointText(fu, han, damanguan) {
  const honba = Number($("honba").value || 0);
  const dealer = Number($("seatWind").value) === 0;

  if (damanguan > 0) {
    return formatPayment(8000 * damanguan, dealer, honba, `${damanguan > 1 ? `${damanguan}倍` : ""}役満`);
  }
  if (han <= 0) return "役なし";
  const point = basePoint(fu, han);
  return formatPayment(point.base, dealer, honba, point.label);
}

function renderAutoYaku(result, dora) {
  const area = $("autoYaku");
  area.innerHTML = "";
  if (state.selected.length !== concealedTileTarget()) {
    return;
  }
  if (result?.error) {
    area.textContent = "和了形として判定できません。";
    return;
  }
  if (!result) {
    area.textContent = dora > 0 ? "ドラのみでは和了できません。" : "役がありません。";
    return;
  }
  result.hupai.forEach((item) => {
    const chip = document.createElement("span");
    chip.className = "yaku-chip";
    const yakumanLabel = typeof item.fanshu === "string" && item.fanshu.includes("*")
      ? `${item.fanshu.length > 1 ? `${item.fanshu.length}倍` : ""}役満`
      : `${item.fanshu}翻`;
    chip.textContent = `${item.name} ${yakumanLabel}`;
    area.appendChild(chip);
  });
  if (dora > 0 && !result.damanguan) {
    const chip = document.createElement("span");
    chip.className = "yaku-chip";
    chip.textContent = `ドラ ${dora}翻`;
    area.appendChild(chip);
  }
}

function renderSelected(counts) {
  const hand = $("selectedTiles");
  hand.innerHTML = "";
  const complete = state.selected.length === concealedTileTarget();
  if (!complete) state.changeWinningTileMode = false;
  state.selected.forEach((id, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `selected-tile ${index === state.selected.length - 1 && complete ? "win" : ""}`;
    button.appendChild(createTileImage(id));
    const action = state.changeWinningTileMode ? "和了牌に変更" : "削除";
    button.setAttribute("aria-label", `${tileById[id].label}を${action}`);
    button.title = `${tileById[id].label}を${action}`;
    button.addEventListener("click", () => {
      if (state.changeWinningTileMode) {
        const [winningTile] = state.selected.splice(index, 1);
        state.selected.push(winningTile);
        state.changeWinningTileMode = false;
        state.notice = "";
        calculate();
        return;
      }
      state.selected.splice(index, 1);
      state.notice = "";
      calculate();
    });
    hand.appendChild(button);
  });
  const meldArea = $("meldTiles");
  meldArea.innerHTML = "";
  state.melds.forEach((meld, index) => {
    const group = document.createElement("button");
    group.type = "button";
    group.className = "meld-group";
    group.title = "副露を削除";
    const meldLabels = { pon: "ポン", minkan: "明槓", ankan: "暗槓", chi: "チー" };
    group.setAttribute("aria-label", `${meldLabels[meld.type]}を削除`);
    meld.ids.forEach((id, tileIndex) => {
      const tile = document.createElement("span");
      const concealedBack = meld.type === "ankan" && (tileIndex === 1 || tileIndex === 2);
      tile.className = `selected-tile meld-tile${concealedBack ? " back" : ""}`;
      if (!concealedBack) tile.appendChild(createTileImage(id));
      group.appendChild(tile);
    });
    group.addEventListener("click", () => {
      state.melds.splice(index, 1);
      state.notice = "";
      calculate();
    });
    meldArea.appendChild(group);
  });
  document.querySelectorAll(".call-button").forEach((button) => {
    const active = button.dataset.call === state.callMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("changeWinningTile").disabled = !complete;
  $("changeWinningTile").classList.toggle("active", state.changeWinningTileMode);
  $("changeWinningTile").setAttribute("aria-pressed", String(state.changeWinningTileMode));
  document.querySelectorAll(".tile").forEach((button) => {
    const id = button.dataset.tile;
    button.disabled = !state.callMode && (state.selected.length >= concealedTileTarget() || counts[id] >= 4);
  });
}

function calculate() {
  normalizeManualYaku();
  const counts = countsFromSelected();
  const target = concealedTileTarget();
  const complete = state.selected.length === target;
  const dora = Number($("dora").value || 0);
  const result = evaluateHand();
  const fu = result && !result.error ? result.fu : complete && !state.melds.length ? calculateFallbackFu(counts) : null;
  const baseHan = result && !result.error ? (result.fanshu || 0) : 0;
  const damanguan = result && !result.error ? (result.damanguan || 0) : 0;
  const han = damanguan ? 0 : baseHan + dora;

  renderSelected(counts);
  renderAutoYaku(result, dora);
  $("tileCounter").textContent = `${state.selected.length} / ${target}`;
  $("winningTile").textContent = complete ? tileById[state.selected.at(-1)].label : "未";
  $("fuDisplay").textContent = damanguan ? "-" : fu ? `${fu}符` : "-";
  $("hanDisplay").textContent = damanguan ? `${damanguan}役満` : han ? `${han}翻` : "-";
  $("pointDisplay").textContent = damanguan > 0 || (fu && han > 0) ? pointText(fu || 0, han, damanguan) : complete ? "役なし" : "牌を選択";
  $("message").textContent = state.notice;
  $("message").hidden = !state.notice;
  document.querySelector(".sanma-only").style.display = state.players === 3 ? "flex" : "none";
  saveInputs();
}

function setupEvents() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode;
      document.querySelectorAll(`[data-mode="${mode}"]`).forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      state[mode] = mode === "players" ? Number(button.dataset.value) : button.dataset.value;
      calculate();
    });
  });
  ["roundWind", "seatWind", "dora", "honba", "tsumoLoss", "riichi", "doubleRiichi", "ippatsu", "qianggang", "lingshang", "haidi", "chiho"].forEach((id) => {
    $(id).addEventListener("change", calculate);
    $(id).addEventListener("input", calculate);
  });
  $("removeLast").addEventListener("click", () => {
    state.selected.pop();
    state.changeWinningTileMode = false;
    state.notice = "";
    calculate();
  });
  $("sortTiles").addEventListener("click", () => {
    if (state.selected.length === concealedTileTarget()) {
      const winningTile = state.selected.at(-1);
      state.selected = state.selected.slice(0, -1).sort((a, b) => order[a] - order[b]);
      state.selected.push(winningTile);
    }
    else {
      state.selected.sort((a, b) => order[a] - order[b]);
    }
    calculate();
  });
  $("changeWinningTile").addEventListener("click", () => {
    state.changeWinningTileMode = !state.changeWinningTileMode;
    state.notice = state.changeWinningTileMode ? "和了牌にする牌を選択してください。" : "";
    calculate();
  });
  $("resetAll").addEventListener("click", () => {
    state.selected = [];
    state.melds = [];
    state.callMode = null;
    state.changeWinningTileMode = false;
    state.notice = "";
    document.querySelectorAll("input[type='checkbox']").forEach((input) => {
      input.checked = false;
      input.disabled = false;
    });
    $("dora").value = 0;
    $("honba").value = 0;
    calculate();
  });
  document.querySelectorAll(".call-button").forEach((button) => {
    button.addEventListener("click", () => setCallMode(button.dataset.call));
  });
}

renderTiles();
setupEvents();
restoreInputs();
calculate();
