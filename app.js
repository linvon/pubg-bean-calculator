const STORAGE_KEY = "pubg-bean-desk-v1";

const DEFAULT_PLAYERS = [
  { id: "a", slot: "A", name: "玩家 A" },
  { id: "b", slot: "B", name: "玩家 B" },
  { id: "c", slot: "C", name: "玩家 C" },
  { id: "d", slot: "D", name: "玩家 D" },
];

const PLAYER_IDS = DEFAULT_PLAYERS.map((player) => player.id);

const PAIRINGS = {
  ab_cd: { teamA: ["a", "b"], teamB: ["c", "d"] },
  ac_bd: { teamA: ["a", "c"], teamB: ["b", "d"] },
  ad_bc: { teamA: ["a", "d"], teamB: ["b", "c"] },
};

const PEST_MODE_LABELS = {
  duel: "逐个对照",
  split: "三人均摊",
  tripleTotal: "三人各摊一次总和",
};

const state = {
  players: DEFAULT_PLAYERS.map((player) => ({ ...player })),
  rounds: [],
  editingRoundId: null,
  draft: {
    roundType: "team",
    pairing: "ab_cd",
    pestHero: "a",
    pestMode: "duel",
    chickenMode: "1",
    kills: createPlayerValueMap(),
    rescues: createPlayerValueMap(),
    teamKills: createPlayerValueMap(),
  },
};

const dom = {
  scoreboard: document.querySelector("#scoreboard"),
  roundCounter: document.querySelector("#roundCounter"),
  historyTotal: document.querySelector("#historyTotal"),
  playerNameGrid: document.querySelector("#playerNameGrid"),
  killGrid: document.querySelector("#killGrid"),
  pestHero: document.querySelector("#pestHero"),
  teamOptions: document.querySelector("#teamOptions"),
  pairingOptions: document.querySelector("#pairingOptions"),
  pestOptions: document.querySelector("#pestOptions"),
  randomPairingBtn: document.querySelector("#randomPairingBtn"),
  customChickenField: document.querySelector("#customChickenField"),
  customChicken: document.querySelector("#customChicken"),
  multiplierPill: document.querySelector("#multiplierPill"),
  nextRoundLabel: document.querySelector("#nextRoundLabel"),
  metrics: document.querySelector("#metrics"),
  resultList: document.querySelector("#resultList"),
  formulaList: document.querySelector("#formulaList"),
  copyRoundBtn: document.querySelector("#copyRoundBtn"),
  commitRoundBtn: document.querySelector("#commitRoundBtn"),
  cancelEditBtn: document.querySelector("#cancelEditBtn"),
  resetDraftBtn: document.querySelector("#resetDraftBtn"),
  undoRoundBtn: document.querySelector("#undoRoundBtn"),
  clearAllBtn: document.querySelector("#clearAllBtn"),
  historyList: document.querySelector("#historyList"),
};

function createPlayerValueMap(value = 0) {
  return Object.fromEntries(PLAYER_IDS.map((id) => [id, value]));
}

function cloneDraft() {
  return {
    ...state.draft,
    kills: { ...state.draft.kills },
    rescues: { ...state.draft.rescues },
    teamKills: { ...state.draft.teamKills },
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizePlayerValues(values, min = 0) {
  const normalized = createPlayerValueMap();
  PLAYER_IDS.forEach((id) => {
    normalized[id] = Math.max(min, toNumber(values?.[id], 0));
  });
  return normalized;
}

function formatNumber(value) {
  const number = Math.abs(value) < 0.0001 ? 0 : value;

  if (Number.isInteger(number)) {
    return String(number);
  }

  return number.toFixed(2).replace(/\.?0+$/, "");
}

function formatDelta(value) {
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
}

function getDeltaClass(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "";
}

function getPlayer(id, players = state.players) {
  return players.find((player) => player.id === id);
}

function getPlayerName(id, players = state.players) {
  return getPlayer(id, players)?.name || id.toUpperCase();
}

function getSlotName(id, players = state.players) {
  const player = getPlayer(id, players);
  return player ? `${player.slot} ${player.name}` : id.toUpperCase();
}

function getPairingLabel(pairingKey, players = state.players) {
  const pairing = PAIRINGS[pairingKey] || PAIRINGS.ab_cd;
  const teamA = pairing.teamA.map((id) => getPlayerName(id, players)).join(" / ");
  const teamB = pairing.teamB.map((id) => getPlayerName(id, players)).join(" / ");
  return `${teamA} vs ${teamB}`;
}

function getRoundConfig(values) {
  return {
    roundType: state.draft.roundType,
    pairing: state.draft.pairing,
    pestHero: state.draft.pestHero,
    pestMode: state.draft.pestMode,
    chickenMode: state.draft.chickenMode,
    customChicken: dom.customChicken.value,
    kills: { ...values.kills },
    rescues: { ...values.rescues },
    teamKills: { ...values.teamKills },
  };
}

function getDraftMap(selectorName) {
  const values = {};
  state.players.forEach((player) => {
    const input = document.querySelector(`[data-${selectorName}-input="${player.id}"]`);
    values[player.id] = Math.max(0, toNumber(input?.value, 0));
  });
  return normalizePlayerValues(values);
}

function syncNamesFromInputs() {
  state.players = state.players.map((player) => {
    const input = document.querySelector(`[data-name-input="${player.id}"]`);
    const name = input?.value.trim() || player.name;
    return { ...player, name };
  });
}

function syncDraftFromInputs() {
  state.draft.kills = getDraftMap("kill");
  state.draft.rescues = getDraftMap("rescue");
  state.draft.teamKills = getDraftMap("teamkill");
}

function getChickenMultiplier() {
  if (state.draft.chickenMode === "custom") {
    return Math.max(1, toNumber(dom.customChicken.value, 2));
  }

  return toNumber(state.draft.chickenMode, 1);
}

function buildMultiplier(kills) {
  const totalKills = Object.values(kills).reduce((sum, value) => sum + value, 0);
  const chicken = getChickenMultiplier();

  return {
    chicken,
    totalKills,
    effective: chicken,
  };
}

function buildRoundValues(kills, rescues, teamKills, multiplier) {
  const normalizedKills = normalizePlayerValues(kills);
  const normalizedRescues = normalizePlayerValues(rescues);
  const normalizedTeamKills = normalizePlayerValues(teamKills);
  const adjustments = createPlayerValueMap();
  const settlementKills = createPlayerValueMap();

  PLAYER_IDS.forEach((id) => {
    adjustments[id] = normalizedRescues[id] - normalizedTeamKills[id];
    settlementKills[id] = normalizedKills[id] * multiplier.chicken + adjustments[id];
  });

  return {
    kills: normalizedKills,
    rescues: normalizedRescues,
    teamKills: normalizedTeamKills,
    adjustments,
    settlementKills,
  };
}

function getActivePlayers() {
  return state.players.map((player) => ({ ...player }));
}

function sumPlayerValues(ids, values) {
  return ids.reduce((sum, id) => sum + (values[id] || 0), 0);
}

function buildSettlementFormulaLines(players, values, multiplier) {
  return [
    `每人结算击杀 = 本局击杀 × 吃鸡倍率 + 救人 - 杀队友。`,
    ...players.map((player) => {
      const id = player.id;
      return `${player.name} 结算击杀 = ${formatNumber(values.kills[id])} × ${formatNumber(multiplier.chicken)} + 救人 ${formatNumber(values.rescues[id])} - 杀队友 ${formatNumber(values.teamKills[id])} = ${formatNumber(values.settlementKills[id])}。`;
    }),
  ];
}

function calculateTeamRound(players, values, multiplier) {
  const pairing = PAIRINGS[state.draft.pairing] || PAIRINGS.ab_cd;
  const teamAKills = sumPlayerValues(pairing.teamA, values.settlementKills);
  const teamBKills = sumPlayerValues(pairing.teamB, values.settlementKills);
  const killGap = teamAKills - teamBKills;
  const teamASet = new Set(pairing.teamA);
  const deltas = {};

  players.forEach((player) => {
    deltas[player.id] = teamASet.has(player.id) ? killGap : -killGap;
  });

  const teamANames = pairing.teamA.map((id) => getPlayerName(id, players)).join(" / ");
  const teamBNames = pairing.teamB.map((id) => getPlayerName(id, players)).join(" / ");

  return {
    type: "team",
    title: `2v2 豆子局，${getPairingLabel(state.draft.pairing, players)}`,
    roleByPlayer: Object.fromEntries(
      players.map((player) => [player.id, teamASet.has(player.id) ? "A 队" : "B 队"]),
    ),
    metrics: [
      { label: "A 队结算击杀", value: formatNumber(teamAKills) },
      { label: "B 队结算击杀", value: formatNumber(teamBKills) },
      { label: "结算差", value: formatDelta(killGap) },
    ],
    deltas,
    formula: [
      `口径：2v2，${teamANames} 一队，${teamBNames} 一队。`,
      ...buildSettlementFormulaLines(players, values, multiplier),
      `A 队结算击杀 = ${pairing.teamA.map((id) => formatNumber(values.settlementKills[id])).join(" + ")} = ${formatNumber(teamAKills)}。`,
      `B 队结算击杀 = ${pairing.teamB.map((id) => formatNumber(values.settlementKills[id])).join(" + ")} = ${formatNumber(teamBKills)}。`,
      `结算差 = ${formatNumber(teamAKills)} - ${formatNumber(teamBKills)} = ${formatNumber(killGap)}。`,
      `A 队每人 ${formatDelta(killGap)}，B 队每人 ${formatDelta(-killGap)}。`,
    ],
  };
}

function calculatePestRound(players, values, multiplier) {
  const heroId = state.draft.pestHero;
  const hero = getPlayer(heroId, players) || players[0];
  const opponents = players.filter((player) => player.id !== hero.id);
  const heroKills = values.settlementKills[hero.id] || 0;
  const opponentKills = opponents.reduce((sum, player) => sum + (values.settlementKills[player.id] || 0), 0);
  const totalGap = heroKills * opponents.length - opponentKills;
  const deltas = {};
  const roleByPlayer = {};
  const formula = [
    `口径：除三害，${PEST_MODE_LABELS[state.draft.pestMode]}。`,
    ...buildSettlementFormulaLines(players, values, multiplier),
    `除害者 ${hero.name} 结算击杀 = ${formatNumber(heroKills)}，另外三人结算击杀合计 = ${formatNumber(opponentKills)}。`,
    `总差额 = 除害者结算击杀 × 3 - 三人结算击杀合计 = ${formatNumber(heroKills)} × 3 - ${formatNumber(opponentKills)} = ${formatNumber(totalGap)}。`,
  ];

  roleByPlayer[hero.id] = "除害者";
  opponents.forEach((player) => {
    roleByPlayer[player.id] = "三害方";
  });

  if (state.draft.pestMode === "duel") {
    let heroDelta = 0;

    opponents.forEach((opponent) => {
      const gap = heroKills - values.settlementKills[opponent.id];
      const opponentDelta = -gap;
      deltas[opponent.id] = opponentDelta;
      heroDelta += gap;
      formula.push(
        `${hero.name} 对 ${opponent.name}：${formatNumber(heroKills)} - ${formatNumber(values.settlementKills[opponent.id])} = ${formatNumber(gap)}，${opponent.name} ${formatDelta(opponentDelta)}。`,
      );
    });

    deltas[hero.id] = heroDelta;
    formula.push(`${hero.name} 本局 = 三个差额合计 = ${formatDelta(heroDelta)}。`);
  }

  if (state.draft.pestMode === "split") {
    const heroDelta = totalGap;
    const eachOpponentDelta = -heroDelta / opponents.length;
    deltas[hero.id] = heroDelta;
    opponents.forEach((opponent) => {
      deltas[opponent.id] = eachOpponentDelta;
    });
    formula.push(`除害者本局 = 总差额 ${formatNumber(totalGap)} = ${formatDelta(heroDelta)}。`);
    formula.push(`三人均摊 = ${formatDelta(-heroDelta)} / 3 = ${formatDelta(eachOpponentDelta)}，三害方每人同额结算。`);
  }

  if (state.draft.pestMode === "tripleTotal") {
    const eachOpponentDelta = -totalGap;
    const heroDelta = -eachOpponentDelta * opponents.length;
    deltas[hero.id] = heroDelta;
    opponents.forEach((opponent) => {
      deltas[opponent.id] = eachOpponentDelta;
    });
    formula.push(`每个三害方 = -总差额 ${formatNumber(totalGap)} = ${formatDelta(eachOpponentDelta)}。`);
    formula.push(`除害者本局 = ${formatDelta(-eachOpponentDelta)} × 3 = ${formatDelta(heroDelta)}。`);
  }

  return {
    type: "pest",
    title: `除三害，${hero.slot} ${hero.name}，${PEST_MODE_LABELS[state.draft.pestMode]}`,
    roleByPlayer,
    metrics: [
      { label: "除害者结算击杀", value: formatNumber(heroKills) },
      { label: "三人结算击杀", value: formatNumber(opponentKills) },
      { label: "总差额", value: formatDelta(totalGap) },
    ],
    deltas,
    formula,
  };
}

function calculateCurrentRound(options = {}) {
  syncDraftFromInputs();
  const players = getActivePlayers();
  const multiplier = buildMultiplier(state.draft.kills);
  const values = buildRoundValues(state.draft.kills, state.draft.rescues, state.draft.teamKills, multiplier);
  const config = getRoundConfig(values);
  const calculation =
    state.draft.roundType === "team"
      ? calculateTeamRound(players, values, multiplier)
      : calculatePestRound(players, values, multiplier);

  return {
    id: options.id || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    number: options.number || state.rounds.length + 1,
    players,
    multiplier,
    config,
    ...values,
    ...calculation,
  };
}

function normalizeSavedRound(round, index) {
  const previousDraft = cloneDraft();
  const previousChicken = dom.customChicken.value;
  const players = getActivePlayers();
  const config = round.config || {};
  const kills = normalizePlayerValues(config.kills || round.kills);
  const rescues = normalizePlayerValues(config.rescues || round.rescues);
  const teamKills = normalizePlayerValues(config.teamKills || round.teamKills);
  const chickenValue = config.customChicken ?? round.multiplier?.chicken ?? 1;
  const numericChicken = Number(chickenValue);

  state.draft = {
    ...state.draft,
    roundType: config.roundType || round.type || "team",
    pairing: config.pairing || "ab_cd",
    pestHero: config.pestHero || "a",
    pestMode: config.pestMode || "duel",
    chickenMode: config.chickenMode || (numericChicken === 1 ? "1" : numericChicken === 2 ? "2" : "custom"),
    kills,
    rescues,
    teamKills,
  };
  dom.customChicken.value = chickenValue;

  const multiplier = buildMultiplier(kills);
  const values = buildRoundValues(kills, rescues, teamKills, multiplier);
  const calculation =
    state.draft.roundType === "team"
      ? calculateTeamRound(players, values, multiplier)
      : calculatePestRound(players, values, multiplier);

  const normalized = {
    id: round.id || `${Date.now()}-${Math.random()}`,
    number: index + 1,
    players,
    multiplier,
    config: getRoundConfig(values),
    ...values,
    ...calculation,
  };

  state.draft = previousDraft;
  dom.customChicken.value = previousChicken;
  return normalized;
}

function refreshRoundsForCurrentPlayers() {
  state.rounds = state.rounds.map((round, index) => normalizeSavedRound(round, index));
}

function getTotals() {
  const totals = Object.fromEntries(
    state.players.map((player) => [
      player.id,
      {
        total: 0,
        totalKills: 0,
        totalRescues: 0,
        totalTeamKills: 0,
        rounds: 0,
        latestDelta: 0,
      },
    ]),
  );

  state.rounds.forEach((round, roundIndex) => {
    state.players.forEach((player) => {
      const delta = round.deltas[player.id] || 0;
      totals[player.id].total += delta;
      totals[player.id].totalKills += round.kills[player.id] || 0;
      totals[player.id].totalRescues += round.rescues?.[player.id] || 0;
      totals[player.id].totalTeamKills += round.teamKills?.[player.id] || 0;
      totals[player.id].rounds += 1;

      if (roundIndex === state.rounds.length - 1) {
        totals[player.id].latestDelta = delta;
      }
    });
  });

  return totals;
}

function renderPlayerNames() {
  dom.playerNameGrid.innerHTML = state.players
    .map(
      (player) => `
        <label class="name-field">
          ${player.slot} 号玩家
          <input data-name-input="${player.id}" type="text" value="${escapeHtml(player.name)}" />
        </label>
      `,
    )
    .join("");
}

function renderKillInputs() {
  dom.killGrid.innerHTML = state.players
    .map(
      (player) => `
        <article class="round-player-card">
          <div class="round-player-head">
            <span class="slot-badge">${player.slot}</span>
            <strong>${escapeHtml(player.name)}</strong>
          </div>
          <label class="kill-field">
            击杀
            <input data-kill-input="${player.id}" type="number" min="0" step="1" value="${state.draft.kills[player.id] || 0}" />
          </label>
          <div class="adjust-grid">
            <label class="kill-field">
              救人
              <input data-rescue-input="${player.id}" type="number" min="0" step="1" value="${state.draft.rescues[player.id] || 0}" />
            </label>
            <label class="kill-field">
              杀队友
              <input data-teamkill-input="${player.id}" type="number" min="0" step="1" value="${state.draft.teamKills[player.id] || 0}" />
            </label>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderPestHeroOptions() {
  const current = state.draft.pestHero;
  dom.pestHero.innerHTML = state.players
    .map(
      (player) => `
        <option value="${player.id}" ${player.id === current ? "selected" : ""}>
          ${player.slot} ${escapeHtml(player.name)}
        </option>
      `,
    )
    .join("");
}

function renderPairingOptions() {
  dom.pairingOptions.innerHTML = Object.entries(PAIRINGS)
    .map(([key, pairing]) => {
      const teamA = pairing.teamA.map((id) => getSlotName(id)).join(" / ");
      const teamB = pairing.teamB.map((id) => getSlotName(id)).join(" / ");

      return `
        <button class="choice ${state.draft.pairing === key ? "is-active" : ""}" type="button" data-choice-group="pairing" data-value="${key}">
          <span class="pair-label">
            <strong>${escapeHtml(teamA)}</strong>
            <span>vs</span>
            <strong>${escapeHtml(teamB)}</strong>
          </span>
        </button>
      `;
    })
    .join("");
}

function renderChoices() {
  document.querySelectorAll("[data-choice-group]").forEach((button) => {
    const group = button.dataset.choiceGroup;
    button.classList.toggle("is-active", state.draft[group] === button.dataset.value);
  });

  dom.teamOptions.classList.toggle("is-hidden", state.draft.roundType !== "team");
  dom.pestOptions.classList.toggle("is-hidden", state.draft.roundType !== "pest");
  dom.customChickenField.classList.toggle("is-hidden", state.draft.chickenMode !== "custom");
}

function renderScoreboard() {
  const totals = getTotals();
  const ranked = state.players
    .map((player) => ({ ...player, ...totals[player.id] }))
    .sort((a, b) => b.total - a.total || b.totalKills - a.totalKills);

  const leaderTotal = ranked[0]?.total || 0;

  dom.roundCounter.textContent = `${state.rounds.length} 局`;
  dom.scoreboard.innerHTML = ranked
    .map((player, index) => {
      const deltaClass = getDeltaClass(player.total);
      const latestClass = getDeltaClass(player.latestDelta);
      const isLeading = player.total === leaderTotal && state.rounds.length > 0;

      return `
        <article class="score-card ${isLeading ? "leading" : ""}">
          <div class="score-top">
            <span class="slot-badge">${player.slot}</span>
            <span class="rank-badge">#${index + 1}</span>
          </div>
          <div class="score-name">${escapeHtml(player.name)}</div>
          <div class="score-number ${deltaClass}">${formatDelta(player.total)}</div>
          <div class="score-meta">
            <span>总击杀 <strong>${formatNumber(player.totalKills)}</strong></span>
            <span>参与 <strong>${player.rounds}</strong> 局</span>
            <span>最近 <strong class="${latestClass}">${formatDelta(player.latestDelta)}</strong></span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderPreview() {
  const round = calculateCurrentRound();
  const editingRound = state.rounds.find((item) => item.id === state.editingRoundId);
  dom.nextRoundLabel.textContent = editingRound ? `编辑第 ${editingRound.number} 局` : `第 ${round.number} 局`;
  dom.commitRoundBtn.textContent = editingRound ? "保存本局修改" : "记入本局";
  dom.cancelEditBtn.classList.toggle("is-hidden", !editingRound);
  dom.multiplierPill.textContent = `x${formatNumber(round.multiplier.effective)}`;

  dom.metrics.innerHTML = [
    ...round.metrics,
    { label: "吃鸡倍率", value: `x${formatNumber(round.multiplier.effective)}` },
  ]
    .map(
      (metric) => `
        <div class="metric">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(metric.value)}</strong>
        </div>
      `,
    )
    .join("");

  dom.resultList.innerHTML = `
    <div class="result-row header">
      <span>玩家</span>
      <span>击杀</span>
      <span>救/队杀</span>
      <span>结算击杀</span>
      <span>角色</span>
      <span>本局</span>
    </div>
    ${round.players
      .map((player) => {
        const delta = round.deltas[player.id] || 0;
        const rescue = round.rescues[player.id] || 0;
        const teamKill = round.teamKills[player.id] || 0;

        return `
          <div class="result-row">
            <strong>${player.slot} ${escapeHtml(player.name)}</strong>
            <span>${formatNumber(round.kills[player.id] || 0)}</span>
            <span>救 ${formatNumber(rescue)} / 队 ${formatNumber(teamKill)}</span>
            <span>${formatNumber(round.settlementKills[player.id] || 0)}</span>
            <span>${escapeHtml(round.roleByPlayer[player.id] || "")}</span>
            <span class="delta ${getDeltaClass(delta)}">${formatDelta(delta)}</span>
          </div>
        `;
      })
      .join("")}
  `;

  dom.formulaList.innerHTML = round.formula
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("");
}

function renderRoundDetail(round) {
  const rows = round.players
    .map((player) => {
      const id = player.id;
      const delta = round.deltas[id] || 0;
      return `
        <div class="detail-row">
          <strong>${player.slot} ${escapeHtml(player.name)}</strong>
          <span>${formatNumber(round.kills[id] || 0)}</span>
          <span>${formatNumber(round.rescues?.[id] || 0)}</span>
          <span>${formatNumber(round.teamKills?.[id] || 0)}</span>
          <span>${formatNumber(round.settlementKills?.[id] || 0)}</span>
          <span>${escapeHtml(round.roleByPlayer[id] || "")}</span>
          <span class="delta ${getDeltaClass(delta)}">${formatDelta(delta)}</span>
        </div>
      `;
    })
    .join("");

  return `
    <div class="history-detail-table">
      <div class="detail-row detail-head">
        <span>玩家</span>
        <span>击杀</span>
        <span>救人</span>
        <span>杀队友</span>
        <span>结算击杀</span>
        <span>角色</span>
        <span>本局</span>
      </div>
      ${rows}
    </div>
  `;
}

function renderHistory() {
  dom.historyTotal.textContent = state.rounds.length ? `${state.rounds.length} 局已记入` : "暂无记录";

  if (!state.rounds.length) {
    dom.historyList.innerHTML = '<div class="empty-state">还没有记入任何一局。本局确认后会出现在这里。</div>';
    return;
  }

  dom.historyList.innerHTML = [...state.rounds]
    .reverse()
    .map((round) => {
      const deltas = round.players
        .map((player) => {
          const delta = round.deltas[player.id] || 0;
          return `<span class="${getDeltaClass(delta)}">${player.slot} ${formatDelta(delta)}</span>`;
        })
        .join("");

      return `
        <article class="history-item ${state.editingRoundId === round.id ? "editing" : ""}">
          <div class="history-summary">
            <div class="history-round-no">第 ${round.number} 局</div>
            <div class="history-title">${escapeHtml(round.title)}</div>
            <div class="history-deltas">${deltas}</div>
            <div class="history-actions">
              <button class="history-action" type="button" data-edit-round="${round.id}">编辑</button>
              <button class="history-action delete" type="button" data-delete-round="${round.id}" aria-label="删除第 ${round.number} 局">×</button>
            </div>
          </div>
          <div class="history-formula">
            <details>
              <summary>查看详情和公式口径</summary>
              ${renderRoundDetail(round)}
              <ol>
                ${round.formula.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
              </ol>
            </details>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAll() {
  renderPestHeroOptions();
  renderPairingOptions();
  renderChoices();
  renderScoreboard();
  renderPreview();
  renderHistory();
  saveState();
}

function applyRoundToDraft(round) {
  const config = round.config || {};
  state.draft = {
    ...state.draft,
    roundType: config.roundType || round.type || "team",
    pairing: config.pairing || state.draft.pairing || "ab_cd",
    pestHero: config.pestHero || state.draft.pestHero || state.players[0].id,
    pestMode: config.pestMode || state.draft.pestMode || "duel",
    chickenMode: config.chickenMode || "custom",
    kills: normalizePlayerValues(round.kills),
    rescues: normalizePlayerValues(round.rescues),
    teamKills: normalizePlayerValues(round.teamKills),
  };

  dom.customChicken.value = config.customChicken ?? round.multiplier?.chicken ?? 1;
  renderKillInputs();
  renderAll();
}

function resetDraft() {
  state.draft = {
    ...state.draft,
    kills: createPlayerValueMap(),
    rescues: createPlayerValueMap(),
    teamKills: createPlayerValueMap(),
  };
  renderKillInputs();
  renderAll();
}

function commitRound() {
  if (state.editingRoundId) {
    const index = state.rounds.findIndex((round) => round.id === state.editingRoundId);

    if (index >= 0) {
      const original = state.rounds[index];
      const round = calculateCurrentRound({ id: original.id, number: original.number });
      state.rounds[index] = round;
      state.rounds = state.rounds.map((item, itemIndex) => ({ ...item, number: itemIndex + 1 }));
    }

    state.editingRoundId = null;
    resetDraft();
    return;
  }

  const round = calculateCurrentRound();
  state.rounds.push(round);
  resetDraft();
}

function deleteRound(roundId) {
  state.rounds = state.rounds.filter((round) => round.id !== roundId);
  state.rounds = state.rounds.map((round, index) => ({ ...round, number: index + 1 }));
  if (state.editingRoundId === roundId) {
    state.editingRoundId = null;
  }
  renderAll();
}

function editRound(roundId) {
  const round = state.rounds.find((item) => item.id === roundId);
  if (!round) return;
  state.editingRoundId = roundId;
  applyRoundToDraft(round);
  document.querySelector("#round-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelEdit() {
  state.editingRoundId = null;
  resetDraft();
}

function undoRound() {
  if (!state.rounds.length) return;
  const removed = state.rounds.pop();
  if (removed?.id === state.editingRoundId) {
    state.editingRoundId = null;
  }
  renderAll();
}

function clearAll() {
  const confirmed = window.confirm("确定清空所有历史和累计分数吗？玩家名字会保留。");
  if (!confirmed) return;
  state.rounds = [];
  state.editingRoundId = null;
  resetDraft();
}

function getPayload() {
  syncNamesFromInputs();
  syncDraftFromInputs();
  return {
    version: 2,
    players: state.players,
    rounds: state.rounds,
    draft: {
      ...state.draft,
      kills: { ...state.draft.kills },
      rescues: { ...state.draft.rescues },
      teamKills: { ...state.draft.teamKills },
    },
    custom: {
      chicken: dom.customChicken.value,
    },
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getPayload()));
}

function applySavedPayload(saved) {
  if (Array.isArray(saved.players) && saved.players.length === 4) {
    state.players = saved.players.map((player, index) => ({
      ...DEFAULT_PLAYERS[index],
      ...player,
    }));
  }

  if (saved.custom) {
    dom.customChicken.value = saved.custom.chicken ?? 2;
  }

  if (Array.isArray(saved.rounds)) {
    state.rounds = saved.rounds.map((round, index) => normalizeSavedRound(round, index));
  }

  if (saved.draft) {
    state.draft = {
      ...state.draft,
      ...saved.draft,
      kills: normalizePlayerValues(saved.draft.kills),
      rescues: normalizePlayerValues(saved.draft.rescues),
      teamKills: normalizePlayerValues(saved.draft.teamKills),
    };
  }
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    applySavedPayload(JSON.parse(raw));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function setChoice(group, value) {
  state.draft[group] = value;

  if (group === "roundType" && value === "pest" && !state.draft.pestHero) {
    state.draft.pestHero = state.players[0].id;
  }

  renderChoices();
  renderPreview();
  saveState();
}

function buildRoundText(round) {
  const resultLines = round.players.map((player) => {
    const id = player.id;
    return `${player.slot} ${player.name}：击杀 ${formatNumber(round.kills[id] || 0)}，救人 ${formatNumber(round.rescues?.[id] || 0)}，杀队友 ${formatNumber(round.teamKills?.[id] || 0)}，结算击杀 ${formatNumber(round.settlementKills?.[id] || 0)}，本局 ${formatDelta(round.deltas[id] || 0)}`;
  });

  return [
    `第 ${round.number} 局：${round.title}`,
    "",
    "本局结果：",
    ...resultLines,
    "",
    "公式口径：",
    ...round.formula,
  ].join("\n");
}

function flashButton(button, text) {
  const previous = button.textContent;
  button.textContent = text;
  window.setTimeout(() => {
    button.textContent = previous;
  }, 1300);
}

async function copyCurrentRoundText() {
  const round = calculateCurrentRound();
  const text = buildRoundText(round);

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    flashButton(dom.copyRoundBtn, "已复制");
  } catch {
    window.alert("复制失败，可以展开公式后手动复制。");
  }
}

function bindEvents() {
  document.addEventListener("input", (event) => {
    const target = event.target;

    if (target.matches("[data-name-input]")) {
      syncNamesFromInputs();
      syncDraftFromInputs();
      refreshRoundsForCurrentPlayers();
      renderKillInputs();
      renderPestHeroOptions();
      renderAll();
      return;
    }

    if (target.matches("[data-kill-input], [data-rescue-input], [data-teamkill-input], #customChicken")) {
      renderPreview();
      saveState();
    }
  });

  document.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-choice-group]");
    if (choice) {
      setChoice(choice.dataset.choiceGroup, choice.dataset.value);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-round]");
    if (deleteButton) {
      deleteRound(deleteButton.dataset.deleteRound);
      return;
    }

    const editButton = event.target.closest("[data-edit-round]");
    if (editButton) {
      editRound(editButton.dataset.editRound);
    }
  });

  dom.pestHero.addEventListener("change", () => {
    state.draft.pestHero = dom.pestHero.value;
    renderPreview();
    saveState();
  });

  dom.randomPairingBtn.addEventListener("click", () => {
    const keys = Object.keys(PAIRINGS);
    const next = keys[Math.floor(Math.random() * keys.length)];
    setChoice("pairing", next);
  });

  dom.copyRoundBtn.addEventListener("click", copyCurrentRoundText);
  dom.commitRoundBtn.addEventListener("click", commitRound);
  dom.cancelEditBtn.addEventListener("click", cancelEdit);
  dom.resetDraftBtn.addEventListener("click", resetDraft);
  dom.undoRoundBtn.addEventListener("click", undoRound);
  dom.clearAllBtn.addEventListener("click", clearAll);
}

loadState();
renderPlayerNames();
renderKillInputs();
renderPestHeroOptions();
bindEvents();
renderAll();
