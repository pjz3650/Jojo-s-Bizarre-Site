const state = {
    parts: [],
    catalog: [],
    catalogSource: "",
    teams: [],
    team: null,
    history: [],
    selectedVersion: null,
    busy: false,
};
let catalogRequest = 0;

const elements = {
    teamSelect: document.querySelector("#team-select"),
    newTeamButton: document.querySelector("#new-team-button"),
    emptyNewTeamButton: document.querySelector("#empty-new-team-button"),
    teamModal: document.querySelector("#team-modal"),
    newTeamName: document.querySelector("#new-team-name"),
    createTeamButton: document.querySelector("#create-team-button"),
    versionModal: document.querySelector("#version-modal"),
    versionModalCode: document.querySelector("#version-modal-code"),
    versionModalTitle: document.querySelector("#version-modal-title"),
    versionReason: document.querySelector("#version-reason"),
    versionMembers: document.querySelector("#version-members"),
    rollbackButton: document.querySelector("#rollback-button"),
    partFilter: document.querySelector("#part-filter"),
    characterSearch: document.querySelector("#character-search"),
    catalogGrid: document.querySelector("#catalog-grid"),
    sourceBadge: document.querySelector("#source-badge"),
    emptyTeam: document.querySelector("#empty-team"),
    teamContent: document.querySelector("#team-content"),
    teamTitle: document.querySelector("#team-title"),
    teamName: document.querySelector("#team-name"),
    saveNameButton: document.querySelector("#save-name-button"),
    currentVersion: document.querySelector("#current-version"),
    previousVersion: document.querySelector("#previous-version"),
    catalogHelp: document.querySelector("#catalog-help"),
    memberCount: document.querySelector("#member-count"),
    teamSlots: document.querySelector("#team-slots"),
    historyList: document.querySelector("#history-list"),
    teamCount: document.querySelector("#hero-team-count"),
    toast: document.querySelector("#toast"),
};

async function api(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(body.error || "Não foi possível concluir a operação.");
    }
    return body;
}

async function initialize() {
    bindEvents();
    try {
        const [partsResponse] = await Promise.all([
            JojoCatalog.parts(),
            loadTeams(),
        ]);
        state.parts = partsResponse.data;
        renderParts();
        elements.characterSearch.value = JojoCatalog.initialSearch();
        let lastTeamId = null;
        try { lastTeamId = Number(localStorage.getItem("jojo-active-team")); } catch { /* Preferência opcional. */ }
        const selected = state.teams.find((team) => team.id === lastTeamId) || state.teams[0];
        await Promise.all([loadCatalog(), selected ? selectTeam(selected.id) : Promise.resolve()]);
    } catch (error) {
        showToast(error.message, true);
    }
}

function bindEvents() {
    elements.newTeamButton.addEventListener("click", openTeamModal);
    elements.emptyNewTeamButton.addEventListener("click", openTeamModal);
    elements.createTeamButton.addEventListener("click", createTeam);
    elements.newTeamName.addEventListener("keydown", (event) => {
        if (event.key === "Enter") createTeam();
    });
    elements.teamSelect.addEventListener("change", () => {
        if (elements.teamSelect.value) selectTeam(Number(elements.teamSelect.value));
    });
    elements.partFilter.addEventListener("change", loadCatalog);
    elements.characterSearch.addEventListener("input", renderCatalog);
    elements.saveNameButton.addEventListener("click", saveTeamName);
    elements.teamName.addEventListener("keydown", (event) => {
        if (event.key === "Enter") saveTeamName();
    });
    elements.rollbackButton.addEventListener("click", rollbackSelectedVersion);

    document.querySelectorAll("[data-close-modal]").forEach((button) => {
        button.addEventListener("click", () => closeModal(button.dataset.closeModal));
    });
    document.querySelectorAll("dialog.team-dialog").forEach((dialog) => {
        dialog.addEventListener("click", (event) => {
            const box = dialog.getBoundingClientRect();
            if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right
                || event.clientY < box.top || event.clientY > box.bottom)) closeModal(dialog.id);
        });
        dialog.addEventListener("close", () => dialog.classList.add("hidden"));
    });
}

function setBusy(busy) {
    state.busy = busy;
    elements.teamSelect.disabled = busy;
    elements.newTeamButton.disabled = busy;
    elements.emptyNewTeamButton.disabled = busy;
    elements.createTeamButton.disabled = busy;
    elements.saveNameButton.disabled = busy;
    elements.rollbackButton.disabled = busy || !state.selectedVersion
        || state.selectedVersion.version_number === state.team?.currentVersion;
    elements.teamSlots.querySelectorAll("button").forEach((button) => { button.disabled = busy; });
    renderCatalog();
}

async function loadTeams() {
    const response = await api("/api/teams");
    state.teams = response.data;
    renderTeamPicker();
}

function renderTeamPicker() {
    elements.teamCount.textContent = state.teams.length;
    elements.teamSelect.innerHTML = state.teams.length
        ? '<option value="" disabled>Selecione uma equipe</option>'
        : '<option value="">Nenhuma equipe</option>';
    state.teams.forEach((team) => {
        const option = document.createElement("option");
        option.value = team.id;
        option.textContent = `${team.name} · v${team.current_version}`;
        option.selected = state.team?.id === team.id;
        elements.teamSelect.append(option);
    });
}

function renderParts() {
    JojoCatalog.populateParts(elements.partFilter, state.parts);
}

async function loadCatalog() {
    const requestNumber = ++catalogRequest;
    state.catalog = [];
    state.catalogSource = "";
    elements.catalogGrid.innerHTML = '<div class="loading-card">Consultando o arquivo...</div>';
    elements.sourceBadge.textContent = "Consultando...";
    try {
        const part = elements.partFilter.value || "3";
        JojoCatalog.rememberPart(part);
        const response = await JojoCatalog.characters(part);
        if (requestNumber !== catalogRequest) return;
        state.catalog = response.data;
        state.catalogSource = response.meta.source;
        elements.sourceBadge.textContent = response.meta.source;
        elements.sourceBadge.classList.toggle("fallback", response.meta.source.includes("local"));
        renderCatalog();
    } catch (error) {
        if (requestNumber !== catalogRequest) return;
        state.catalogSource = "erro";
        elements.sourceBadge.textContent = "Catálogo indisponível";
        renderCatalog();
        showToast(error.message, true);
    }
}

function renderCatalog() {
    elements.catalogHelp.textContent = !state.team
        ? "Crie ou selecione uma equipe para adicionar personagens."
        : state.team.members.length >= 6
            ? "Equipe completa. Remova um membro para adicionar outro."
            : `Adicione personagens à equipe ${state.team.name}.`;
    if (!state.catalogSource) return;
    if (state.catalogSource === "erro") {
        elements.catalogGrid.innerHTML = '<div class="catalog-empty">Não foi possível carregar o catálogo. <button class="button button-secondary" type="button">Tentar novamente</button></div>';
        elements.catalogGrid.querySelector("button").addEventListener("click", loadCatalog);
        return;
    }
    const characters = JojoCatalog.filter(state.catalog, elements.characterSearch.value);

    elements.catalogGrid.innerHTML = "";
    if (!characters.length) {
        elements.catalogGrid.innerHTML = '<div class="catalog-empty">Nenhum personagem encontrado.</div>';
        return;
    }

    const memberIds = new Set((state.team?.members || []).map((member) => member.characterId));
    characters.forEach((character) => {
        const card = document.createElement("article");
        card.className = "character-card";
        const image = imageMarkup(character.imageUrl, character.name, true);
        const disabled = state.busy || !state.team || memberIds.has(character.id) || state.team.members.length >= 6;
        card.innerHTML = `
            <div class="character-visual">
                ${image}
                <span class="character-role">${escapeHtml(character.role)}</span>
            </div>
            <div class="character-info">
                <h3>${escapeHtml(character.name)}</h3>
                <p>${escapeHtml(character.stand)}</p>
                <button class="add-character" type="button" ${disabled ? "disabled" : ""}>
                    ${memberIds.has(character.id) ? "Já está na equipe" : "Adicionar à equipe"}
                </button>
            </div>
        `;
        card.querySelector("button").addEventListener("click", () => addCharacter(character));
        bindImageFallback(card, character.name);
        elements.catalogGrid.append(card);
    });
}

async function createTeam() {
    if (state.busy) return;
    const name = elements.newTeamName.value.trim();
    if (!name) {
        showToast("Digite um nome para a equipe.", true);
        return;
    }
    setBusy(true);
    try {
        const response = await api("/api/teams", {
            method: "POST",
            body: JSON.stringify({ name }),
        });
        closeModal("team-modal");
        elements.newTeamName.value = "";
        state.team = response.data;
        try { localStorage.setItem("jojo-active-team", String(state.team.id)); } catch { /* Preferência opcional. */ }
        await refreshAfterMutation();
        showToast("Equipe criada e versão inicial salva.");
    } catch (error) {
        showToast(error.message, true);
    } finally { setBusy(false); }
}

async function selectTeam(teamId) {
    if (state.busy) return;
    setBusy(true);
    try {
        const [teamResponse, historyResponse] = await Promise.all([
            api(`/api/teams/${teamId}`),
            api(`/api/teams/${teamId}/history`),
        ]);
        state.team = teamResponse.data;
        state.history = historyResponse.data;
        state.selectedVersion = null;
        closeModal("version-modal");
        try { localStorage.setItem("jojo-active-team", String(teamId)); } catch { /* Preferência opcional. */ }
        renderTeamPicker();
        renderTeam();
        renderHistory();
        renderCatalog();
    } catch (error) {
        showToast(error.message, true);
        renderTeamPicker();
    } finally { setBusy(false); }
}

function renderTeam() {
    if (!state.team) {
        elements.emptyTeam.classList.remove("hidden");
        elements.teamContent.classList.add("hidden");
        elements.teamTitle.textContent = "Nenhuma equipe selecionada";
        elements.currentVersion.textContent = "—";
        elements.previousVersion.textContent = "—";
        return;
    }

    elements.emptyTeam.classList.add("hidden");
    elements.teamContent.classList.remove("hidden");
    elements.teamTitle.textContent = state.team.name;
    elements.teamName.value = state.team.name;
    elements.currentVersion.textContent = `V${state.team.currentVersion}`;
    elements.previousVersion.textContent = state.team.currentVersion > 1 ? `V${state.team.currentVersion - 1}` : "—";
    elements.memberCount.textContent = state.team.members.length;
    elements.teamSlots.innerHTML = "";

    state.team.members.forEach((member) => {
        const card = document.createElement("article");
        const isLeader = state.team.leaderCharacterId === member.characterId;
        card.className = `member-card${isLeader ? " leader" : ""}`;
        const image = imageMarkup(member.imageUrl, member.name);
        card.innerHTML = `
            <div class="member-image">${image}</div>
            <div class="member-info">
                <span class="member-position">POSIÇÃO ${String(member.position).padStart(2, "0")}</span>
                <h3>${escapeHtml(member.name)} ${isLeader ? "★" : ""}</h3>
                <p>${escapeHtml(member.stand)} · ${escapeHtml(member.partName)}</p>
            </div>
            <div class="member-actions">
                <button class="icon-button leader-button" type="button" title="Definir como líder" aria-label="Definir ${escapeHtml(member.name)} como líder" aria-pressed="${isLeader}">★</button>
                <button class="icon-button remove" type="button" title="Remover" aria-label="Remover ${escapeHtml(member.name)}">×</button>
            </div>
        `;
        card.querySelector(".leader-button").addEventListener("click", () => setLeader(member.characterId));
        card.querySelector(".remove").addEventListener("click", () => removeCharacter(member.characterId));
        bindImageFallback(card, member.name);
        elements.teamSlots.append(card);
    });

    for (let position = state.team.members.length + 1; position <= 6; position += 1) {
        const slot = document.createElement("div");
        slot.className = "empty-slot";
        slot.textContent = `Vaga ${String(position).padStart(2, "0")} disponível`;
        elements.teamSlots.append(slot);
    }
}

async function addCharacter(character) {
    if (state.busy) return;
    if (!state.team) {
        showToast("Crie uma equipe antes de adicionar personagens.", true);
        return;
    }
    setBusy(true);
    try {
        const response = await api(`/api/teams/${state.team.id}/members`, {
            method: "POST",
            body: JSON.stringify({ character }),
        });
        state.team = response.data;
        await refreshAfterMutation();
        showToast(`${character.name} entrou na equipe.`);
    } catch (error) {
        showToast(error.message, true);
    } finally { setBusy(false); }
}

async function removeCharacter(characterId) {
    if (state.busy || !state.team) return;
    setBusy(true);
    try {
        const response = await api(`/api/teams/${state.team.id}/members/${encodeURIComponent(characterId)}`, {
            method: "DELETE",
        });
        state.team = response.data;
        await refreshAfterMutation();
        showToast("Personagem removido. A versão anterior continua no histórico.");
    } catch (error) {
        showToast(error.message, true);
    } finally { setBusy(false); }
}

async function setLeader(characterId) {
    if (state.busy || !state.team || state.team.leaderCharacterId === characterId) return;
    setBusy(true);
    try {
        const response = await api(`/api/teams/${state.team.id}`, {
            method: "PUT",
            body: JSON.stringify({ leaderCharacterId: characterId, reason: "Líder da equipe alterado" }),
        });
        state.team = response.data;
        await refreshAfterMutation();
        showToast("Novo líder definido.");
    } catch (error) {
        showToast(error.message, true);
    } finally { setBusy(false); }
}

async function saveTeamName() {
    if (!state.team || state.busy) return;
    const name = elements.teamName.value.trim();
    if (name === state.team.name) return;
    setBusy(true);
    try {
        const response = await api(`/api/teams/${state.team.id}`, {
            method: "PUT",
            body: JSON.stringify({ name, reason: `Equipe renomeada para ${name}` }),
        });
        state.team = response.data;
        await refreshAfterMutation();
        showToast("Nome atualizado.");
    } catch (error) {
        showToast(error.message, true);
    } finally { setBusy(false); }
}

async function refreshAfterMutation() {
    state.selectedVersion = null;
    state.history = [];
    renderTeam();
    renderHistory();
    renderCatalog();
    const historyResponse = await api(`/api/teams/${state.team.id}/history`);
    state.history = historyResponse.data;
    await loadTeams();
    renderTeam();
    renderHistory();
    renderCatalog();
}

function renderHistory() {
    elements.historyList.innerHTML = "";
    if (!state.history.length) {
        elements.historyList.innerHTML = '<div class="history-empty">O histórico aparecerá aqui.</div>';
        return;
    }

    state.history.forEach((version) => {
        const button = document.createElement("button");
        const isCurrent = version.version_number === state.team.currentVersion;
        const isPrevious = version.version_number === state.team.currentVersion - 1;
        button.className = `history-item ${isCurrent ? "current" : ""} ${version.action === "rollback" ? "rollback" : ""}`;
        button.type = "button";
        button.innerHTML = `
            <span class="history-number">V${version.version_number}</span>
            <span class="history-copy">
                <strong>${escapeHtml(version.reason)}</strong>
                ${isCurrent ? '<em class="history-label">Atual</em>' : isPrevious ? '<em class="history-label">Anterior</em>' : ""}
                <span>${formatDate(version.created_at)} · ${translateAction(version.action)}</span>
            </span>
        `;
        button.addEventListener("click", () => openVersion(version));
        elements.historyList.append(button);
    });
}

function openVersion(version) {
    if (state.busy || !state.team) return;
    state.selectedVersion = version;
    elements.versionModalCode.textContent = `LINHA DO TEMPO // VERSÃO ${version.version_number}`;
    elements.versionModalTitle.textContent = version.snapshot.name;
    elements.versionReason.textContent = version.reason;
    elements.versionMembers.innerHTML = "";

    if (!version.snapshot.members.length) {
        elements.versionMembers.innerHTML = '<div class="version-empty">Essa versão ainda não possuía membros.</div>';
    } else {
        version.snapshot.members.forEach((member) => {
            const item = document.createElement("div");
            item.className = "version-member";
            item.innerHTML = `
                <strong>${member.position}. ${escapeHtml(member.name)}${version.snapshot.leaderCharacterId === member.characterId ? " ★" : ""}</strong>
                <span>${escapeHtml(member.stand)}</span>
            `;
            elements.versionMembers.append(item);
        });
    }

    const isCurrent = version.version_number === state.team.currentVersion;
    elements.rollbackButton.disabled = isCurrent;
    elements.rollbackButton.textContent = isCurrent ? "Esta já é a versão atual" : "Restaurar esta versão";
    openModal("version-modal");
}

async function rollbackSelectedVersion() {
    if (!state.selectedVersion || !state.team || state.busy) return;
    const version = state.selectedVersion.version_number;
    const confirmed = window.confirm(`Restaurar a equipe para a versão ${version}? Uma nova versão de rollback será criada.`);
    if (!confirmed) return;
    setBusy(true);
    try {
        const response = await api(`/api/teams/${state.team.id}/rollback/${version}`, {
            method: "POST",
            body: JSON.stringify({}),
        });
        state.team = response.data;
        closeModal("version-modal");
        await refreshAfterMutation();
        showToast(`Rollback concluído. A versão ${version} foi restaurada sem apagar o histórico.`);
    } catch (error) {
        showToast(error.message, true);
    } finally { setBusy(false); }
}

function openTeamModal() {
    if (state.busy) return;
    openModal("team-modal");
    elements.newTeamName.focus();
}

function openModal(id) {
    const dialog = document.getElementById(id);
    dialog.classList.remove("hidden");
    if (!dialog.open) dialog.showModal();
}

function closeModal(id) {
    const dialog = document.getElementById(id);
    if (dialog.open) dialog.close();
    dialog.classList.add("hidden");
}

let toastTimer;
function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle("error", isError);
    elements.toast.classList.remove("hidden");
    toastTimer = setTimeout(() => elements.toast.classList.add("hidden"), 3500);
}

function initials(name) {
    return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function imageMarkup(url, name, lazy = false) {
    const safe = JojoSite.safeUrl(url);
    return safe
        ? `<img src="${escapeHtml(safe)}" alt="${escapeHtml(name)}" ${lazy ? 'loading="lazy"' : ""}>`
        : `<span class="initials">${escapeHtml(initials(name))}</span>`;
}

function bindImageFallback(container, name) {
    container.querySelectorAll("img").forEach((img) => img.addEventListener("error", () => {
        const placeholder = document.createElement("span");
        placeholder.className = "initials";
        placeholder.textContent = initials(name);
        img.replaceWith(placeholder);
    }, { once: true }));
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDate(value) {
    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

function translateAction(action) {
    return {
        create: "criação",
        add_member: "personagem adicionado",
        remove_member: "personagem removido",
        rename: "renomeação",
        update: "atualização",
        reorder: "reordenação",
        rollback: "rollback",
    }[action] || action;
}

initialize();
