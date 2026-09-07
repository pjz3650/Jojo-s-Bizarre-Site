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

function configurarCabecalho() {
  const aoRolar = () => el.cabecalho.classList.toggle("cabecalho--solido", window.scrollY > 40);
  aoRolar();
  window.addEventListener("scroll", aoRolar, { passive: true });
  el.botaoMenu.addEventListener("click", () => {
    const aberto = el.navegacao.classList.toggle("navegacao--aberta");
    el.botaoMenu.setAttribute("aria-expanded", String(aberto));
  });
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
  const resposta = await fetch(API_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!resposta.ok) throw new Error(`AniList respondeu ${resposta.status}.`);
  const resultado = await resposta.json();
  if (resultado.errors?.length) throw new Error(resultado.errors.map((e) => e.message).join("; "));

  PARTES.forEach((parte, i) => {
    const personagem = resultado.data?.[`p${i}`];
    if (personagem) dados[parte.numero] = { ...parte, ...personagem };
  });
}

function criarDado(rotulo, valor) {
  if (!valor) return null;
  const item = document.createElement("div");
  item.className = "protagonista-dado";
  item.innerHTML = `<span>${rotulo}</span><strong>${valor}</strong>`;
  return item;
}

function renderizarFicha(parte) {
  el.parte.textContent = `PART ${parte.numero} · ${parte.nome.toUpperCase()}`;
  el.numero.textContent = parte.numero;
  el.nome.textContent = parte.name?.full || parte.personagem;
  el.nativo.textContent = parte.name?.native || "";
  el.stand.textContent = `STAND / ${parte.stand}`;
  el.descricao.textContent = limparDescricao(parte.description, 620);
  el.imagem.style.backgroundImage = parte.image?.large ? `url(${parte.image.large})` : "none";
  el.link.href = parte.siteUrl || "#";
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
  configurarCabecalho();
  renderizarTabs();
  try {
    await buscarProtagonistas();
    const primeiro = dados["01"] || Object.values(dados)[0];
    if (primeiro) renderizarFicha(primeiro);
  } catch (erro) {
    console.error(erro);
    el.descricao.textContent = "Não foi possível carregar os protagonistas agora. Tente novamente em instantes.";
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
else iniciar();
