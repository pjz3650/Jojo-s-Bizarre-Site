const API_URL = "https://graphql.anilist.co";

const PARTES = [
  { numero: "01", nome: "Phantom Blood", personagem: "Jonathan Joestar", stand: "Hamon" },
  { numero: "02", nome: "Battle Tendency", personagem: "Joseph Joestar", stand: "Hamon" },
  { numero: "03", nome: "Stardust Crusaders", personagem: "Jotaro Kujo", stand: "Star Platinum" },
  { numero: "04", nome: "Diamond Is Unbreakable", personagem: "Josuke Higashikata", stand: "Crazy Diamond" },
  { numero: "05", nome: "Golden Wind", personagem: "Giorno Giovanna", stand: "Gold Experience" },
  { numero: "06", nome: "Stone Ocean", personagem: "Jolyne Cujoh", stand: "Stone Free" },
];

const dados = {};
const el = {};

function mapear() {
  el.cabecalho = document.querySelector("#cabecalho");
  el.botaoMenu = document.querySelector("#botaoMenu");
  el.navegacao = document.querySelector("#navegacao");
  el.parte = document.querySelector("#protagonistaParte");
  el.numero = document.querySelector("#protagonistaNumero");
  el.nome = document.querySelector("#protagonistaNome");
  el.nativo = document.querySelector("#protagonistaNativo");
  el.stand = document.querySelector("#protagonistaStand");
  el.descricao = document.querySelector("#protagonistaDescricao");
  el.imagem = document.querySelector("#protagonistaImagem");
  el.dados = document.querySelector("#protagonistaDados");
  el.link = document.querySelector("#protagonistaLink");
  el.tabs = document.querySelector("#protagonistaTabs");
  el.contador = document.querySelector("#contador");
}

function limparDescricao(texto, limite = 500) {
  if (!texto) return "Descrição não informada pela API.";
  const doc = new DOMParser().parseFromString(texto, "text/html");
  const limpo = doc.body.textContent.replace(/~!/g, "").replace(/!~/g, "").replace(/[*_`#]/g, "").replace(/\s+/g, " ").trim();
  return limpo.length > limite ? `${limpo.slice(0, limite - 3)}...` : limpo;
}

function formatarData(data) {
  if (!data || (!data.day && !data.month && !data.year)) return null;
  return [data.day, data.month, data.year].filter(Boolean).join(" / ");
}

async function buscarProtagonistas() {
  const aliases = PARTES.map((p, i) => `p${i}: Character(search: "${p.personagem}") { id name { full native } image { large } description(asHtml: false) gender age dateOfBirth { day month year } bloodType favourites siteUrl }`).join("\n");
  const query = `query { ${aliases} }`;
  const resultado = await JojoSite.fetchJson(API_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  PARTES.forEach((parte, i) => {
    const personagem = resultado.data?.[`p${i}`];
    if (personagem) dados[parte.numero] = { ...parte, ...personagem };
  });
}

function criarDado(rotulo, valor) {
  if (!valor) return null;
  const item = document.createElement("div");
  item.className = "protagonista-dado";
  const label = document.createElement("span");
  const content = document.createElement("strong");
  label.textContent = rotulo;
  content.textContent = valor;
  item.append(label, content);
  return item;
}

function renderizarFicha(parte) {
  el.parte.textContent = `PART ${parte.numero} · ${parte.nome.toUpperCase()}`;
  el.numero.textContent = parte.numero;
  el.nome.textContent = parte.name?.full || parte.personagem;
  el.nativo.textContent = parte.name?.native || "";
  el.stand.textContent = `${parte.stand === "Hamon" ? "TÉCNICA" : "STAND"} / ${parte.stand}`;
  el.descricao.textContent = limparDescricao(parte.description, 620);
  JojoSite.setImage(el.imagem, parte.image?.large, parte.personagem);
  el.link.href = JojoSite.safeUrl(parte.siteUrl) || "#";
  el.link.hidden = !JojoSite.safeUrl(parte.siteUrl);
  el.contador.textContent = `${parte.numero} / 06`;

  el.dados.replaceChildren();
  const genero = { Male: "Masculino", Female: "Feminino", "Non-binary": "Não binário" }[parte.gender] || parte.gender;
  [
    criarDado("Gênero", genero),
    criarDado("Idade", parte.age),
    criarDado("Nascimento", formatarData(parte.dateOfBirth)),
    criarDado("Tipo sanguíneo", parte.bloodType),
  ].filter(Boolean).forEach((item) => el.dados.append(item));

  el.tabs.querySelectorAll("button").forEach((botao) => {
    botao.classList.toggle("ativo", botao.dataset.parte === parte.numero);
    botao.setAttribute("aria-pressed", String(botao.dataset.parte === parte.numero));
  });
}

function renderizarTabs() {
  el.tabs.replaceChildren();
  PARTES.forEach((parte) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "protagonista-tab";
    botao.dataset.parte = parte.numero;
    botao.innerHTML = `<span>${parte.numero}</span><strong>${parte.personagem}</strong><small>${parte.nome}</small>`;
    botao.addEventListener("click", () => {
      const personagem = dados[parte.numero];
      if (personagem) renderizarFicha(personagem);
    });
    el.tabs.append(botao);
  });
}

async function iniciar() {
  mapear();
  PARTES.forEach((parte, index) => {
    dados[parte.numero] = { ...parte, ...JOJO_ARCHIVE_FALLBACK.personagens[index] };
  });
  renderizarTabs();
  renderizarFicha(dados["01"]);
  const status = document.querySelector("#archive-status");
  status.textContent = "Consultando informações da AniList...";
  try {
    await buscarProtagonistas();
    const selected = el.tabs.querySelector(".ativo")?.dataset.parte || "01";
    renderizarFicha(dados[selected]);
    status.textContent = "Dados da AniList; fichas locais completam informações indisponíveis.";
  } catch (erro) {
    status.textContent = "Exibindo fichas locais. Imagens e informações extras dependem da AniList.";
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
else iniciar();
