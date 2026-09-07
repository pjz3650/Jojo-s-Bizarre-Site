/* Comportamentos compartilhados; nenhum dado de equipe passa pela AniList. */
(() => {
  const header = document.querySelector("#cabecalho");
  const menu = document.querySelector("#botaoMenu");
  const navigation = document.querySelector("#navegacao");
  const setMenu = (open) => {
    navigation.classList.toggle("navegacao--aberta", open);
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-label", open ? "Fechar menu de navegação" : "Abrir menu de navegação");
  };
  const updateHeader = () => header.classList.toggle("cabecalho--solido",
    document.body.classList.contains("pagina-equipes") || window.scrollY > 40);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
  menu.addEventListener("click", () => setMenu(menu.getAttribute("aria-expanded") !== "true"));
  navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      menu.focus();
    }
  });

  function safeUrl(value) {
    if (!value || value === "#") return "";
    try {
      const url = new URL(value, window.location.origin);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  }

  function setImage(element, url, fallback = "Sem imagem") {
    const source = safeUrl(url);
    element.dataset.imageSource = source;
    element.style.backgroundImage = "none";
    element.classList.add("imagem-sem-foto");
    element.textContent = fallback;
    if (!source) return;
    const photo = new Image();
    photo.onload = () => {
      if (element.dataset.imageSource !== source) return;
      element.style.backgroundImage = `url("${source.replaceAll('"', '%22')}")`;
      element.classList.remove("imagem-sem-foto");
      element.textContent = "";
    };
    photo.src = source;
  }

  async function fetchJson(url, options = {}) {
    if (document.body.dataset.offline === "true") throw new Error("Base local ativada.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) throw new Error(`A API respondeu com o status ${response.status}.`);
      const result = await response.json();
      if (result.errors?.length) throw new Error("A API não retornou os dados esperados.");
      return result;
    } finally { clearTimeout(timer); }
  }

  window.JojoSite = { safeUrl, setImage, fetchJson };
})();
