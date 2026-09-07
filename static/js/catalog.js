/* Catálogo único para a página inicial e o Team Builder. */
window.JojoCatalog = (() => {
  const PARTS_URL = "/api/catalog/parts";
  const CHARACTERS_URL = "/api/catalog/characters";
  const STORAGE_KEY = "jojo-catalog-part";

  async function request(url) {
    // Mesmo no modo offline, a API Flask responde com a base local.
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Não foi possível carregar o catálogo.");
    return body;
  }

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR").trim();
  }

  function filter(characters, query) {
    const search = normalize(query);
    return characters.filter((character) => !search
      || normalize(character.name).includes(search)
      || normalize(character.stand).includes(search));
  }

  function initialPart(parts) {
    const requested = new URLSearchParams(window.location.search).get("part");
    let remembered;
    try { remembered = localStorage.getItem(STORAGE_KEY); } catch { /* Preferência opcional. */ }
    return [requested, remembered, "3", parts[0]?.id]
      .find((id) => parts.some((part) => part.id === id));
  }

  function populateParts(select, parts) {
    const selected = initialPart(parts);
    select.replaceChildren();
    parts.forEach((part) => {
      const option = document.createElement("option");
      option.value = part.id;
      option.textContent = part.name;
      option.selected = part.id === selected;
      select.append(option);
    });
  }

  function rememberPart(part) {
    try { localStorage.setItem(STORAGE_KEY, part); } catch { /* Preferência opcional. */ }
    const url = new URL(window.location.href);
    url.searchParams.set("part", part);
    window.history.replaceState(null, "", url);
  }

  function teamUrl(character) {
    const params = new URLSearchParams({ part: character.partId, q: character.name });
    return `/equipes?${params}#catalog-title`;
  }

  return {
    parts: () => request(PARTS_URL),
    characters: (part) => request(`${CHARACTERS_URL}?${new URLSearchParams({ part })}`),
    initialSearch: () => new URLSearchParams(window.location.search).get("q") || "",
    populateParts, rememberPart, filter, normalize, teamUrl,
  };
})();
