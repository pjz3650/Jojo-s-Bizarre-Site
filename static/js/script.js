const API_URL = "https://graphql.anilist.co";
const ANIME_PROCURADO = "JoJo's Bizarre Adventure";

// AniList fornece conteúdo editorial e dados extras das fichas.
// A lista de personagens selecionáveis vem exclusivamente de JojoCatalog.
const CONSULTA = `
  query ($nome: String) {
    Page(page: 1, perPage: 12) {
      media(search: $nome, type: ANIME, sort: START_DATE, format_in: [TV, ONA, MOVIE]) {
        id
        format
        episodes
        popularity
        description(asHtml: false)
        startDate {
          year
        }
        title {
          romaji
          english
        }
        coverImage {
          extraLarge
          color
        }
        bannerImage
        siteUrl
        characters(page: 1, perPage: 50, sort: FAVOURITES_DESC) {
          nodes {
            id
            name {
              full
              native
            }
            image {
              large
            }
            description(asHtml: false)
            gender
            age
            dateOfBirth {
              day
              month
              year
            }
            bloodType
            favourites
            siteUrl
          }
        }
      }
    }
  }
`;

const traducaoGenero = {
  Male: "Masculino",
  Female: "Feminino",
  "Non-binary": "Não binário",
};

const nomesMeses = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const elementos = {};
const catalogo = { personagens: [], fonte: "", requisicao: 0, extras: new Map(), selecionado: null };

function mapearElementos() {
  elementos.cabecalho = document.querySelector("#cabecalho");
  elementos.botaoMenu = document.querySelector("#botaoMenu");
  elementos.navegacao = document.querySelector("#navegacao");
  elementos.heroCollage = document.querySelector("#heroCollage");
  elementos.sinopseConteudo = document.querySelector("#sinopseConteudo");
  elementos.sinopseMeta = document.querySelector("#sinopseMeta");
  elementos.sinopseImagem = document.querySelector("#sinopseImagem");
  elementos.carrossel = document.querySelector("#carrosselTemporadas");
  elementos.setaEsquerda = document.querySelector("#setaEsquerda");
  elementos.setaDireita = document.querySelector("#setaDireita");
  elementos.gradePersonagens = document.querySelector("#gradePersonagens");
  elementos.parte = document.querySelector("#catalogo-parte");
  elementos.busca = document.querySelector("#catalogo-busca");
  elementos.fonte = document.querySelector("#catalogo-status");
  elementos.modal = document.querySelector("#modalPersonagem");
  elementos.modalFundo = document.querySelector("#modalFundo");
  elementos.modalFechar = document.querySelector("#modalFechar");
  elementos.modalImagem = document.querySelector("#modalImagem");
  elementos.modalNome = document.querySelector("#modalNome");
  elementos.modalNomeNativo = document.querySelector("#modalNomeNativo");
  elementos.modalDados = document.querySelector("#modalDados");
  elementos.modalDescricao = document.querySelector("#modalDescricao");
  elementos.modalLink = document.querySelector("#modalLink");
  elementos.modalEquipe = document.querySelector("#modalEquipe");
}

/* -------------------- Texto auxiliar -------------------- */

function limparDescricao(descricao, limite = 640) {
  if (!descricao) return "Descrição não informada pela API.";

  const documento = new DOMParser().parseFromString(descricao, "text/html");
  const texto = documento.body.textContent
    .replace(/~!/g, "")
    .replace(/!~/g, "")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return texto.length > limite ? `${texto.slice(0, limite - 3)}...` : texto;
}

function formatarAniversario(data) {
  if (!data || (!data.day && !data.month && !data.year)) return null;

  const partes = [];
  if (data.day) partes.push(String(data.day));
  if (data.month) partes.push(nomesMeses[data.month - 1]);
  if (data.year) partes.push(String(data.year));

  return partes.join(" de ");
}

function nomeExibicao(media) {
  return media.title.english || media.title.romaji;
}

/* -------------------- Busca na AniList -------------------- */

async function buscarDadosDaSaga() {
  const resultado = await JojoSite.fetchJson(API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: CONSULTA,
      variables: { nome: ANIME_PROCURADO },
    }),
  });

  const partes = (resultado.data?.Page?.media ?? []).filter((media) =>
    nomeExibicao(media).toLowerCase().includes("jojo") ||
    nomeExibicao(media).toLowerCase().includes("stardust") ||
    nomeExibicao(media).toLowerCase().includes("battle tendency") ||
    nomeExibicao(media).toLowerCase().includes("diamond") ||
    nomeExibicao(media).toLowerCase().includes("golden wind") ||
    nomeExibicao(media).toLowerCase().includes("stone ocean") ||
    nomeExibicao(media).toLowerCase().includes("phantom blood"),
  );

  if (!partes.length) {
    throw new Error("Nenhuma parte da saga foi encontrada no AniList.");
  }

  const personagensPorId = new Map();
  for (const parte of partes) {
    for (const personagem of parte.characters?.nodes ?? []) {
      const existente = personagensPorId.get(personagem.id);
      if (!existente || (personagem.favourites ?? 0) > (existente.favourites ?? 0)) {
        personagensPorId.set(personagem.id, personagem);
      }
    }
  }

  const personagens = [...personagensPorId.values()].sort((a, b) => {
    const diferenca = (b.favourites ?? 0) - (a.favourites ?? 0);
    return diferenca || a.name.full.localeCompare(b.name.full);
  });

  const destaque = [...partes].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0];

  return { partes, personagens, destaque };
}

/* -------------------- Renderização: Hero + Sinopse -------------------- */

function renderizarHeroESinopse(destaque, personagens) {
  const protagonistasHero = [
    "Jonathan Joestar",
    "Joseph Joestar",
    "Jotaro Kujo",
    "Josuke Higashikata",
    "Giorno Giovanna",
    "Jolyne Cujoh",
  ];

  const imagensHero = protagonistasHero
    .map((nome) => personagens.find((p) => p.name?.full === nome)?.image?.large);

  if (elementos.heroCollage) {
    const paineis = [...elementos.heroCollage.querySelectorAll(".hero__painel")];
    paineis.forEach((painel, indice) => {
      const imagem = imagensHero[indice];
      JojoSite.setImage(painel, imagem, protagonistasHero[indice]);
    });
  }

  JojoSite.setImage(elementos.sinopseImagem, destaque.coverImage?.extraLarge, "JOJO'S BIZARRE ADVENTURE");

  elementos.sinopseConteudo.textContent = limparDescricao(destaque.description);

  elementos.sinopseMeta.replaceChildren();
  const chips = [
    nomeExibicao(destaque),
    destaque.startDate?.year ? `Estreia em ${destaque.startDate.year}` : null,
    destaque.episodes ? `${destaque.episodes} episódios` : null,
  ].filter(Boolean);

  for (const texto of chips) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = texto;
    elementos.sinopseMeta.append(chip);
  }
}

/* -------------------- Renderização: Carrossel de partes -------------------- */

function criarCartaoParte(parte, indice) {
  const cartao = document.createElement("a");
  cartao.className = "cartao-parte";
  cartao.href = JojoSite.safeUrl(parte.siteUrl) || "/protagonistas";
  if (!parte.siteUrl?.startsWith("/")) cartao.target = "_blank";
  cartao.rel = "noopener noreferrer";

  const numero = document.createElement("span");
  numero.className = "cartao-parte__numero";
  numero.textContent = String(indice + 1).padStart(2, "0");

  const imagem = document.createElement("div");
  imagem.className = "cartao-parte__imagem";
  JojoSite.setImage(imagem, parte.coverImage?.extraLarge, nomeExibicao(parte));

  const corpo = document.createElement("div");
  corpo.className = "cartao-parte__corpo";

  const titulo = document.createElement("p");
  titulo.className = "cartao-parte__titulo";
  titulo.textContent = nomeExibicao(parte);

  const info = document.createElement("p");
  info.className = "cartao-parte__info";
  const pedacos = [
    parte.startDate?.year,
    parte.episodes ? `${parte.episodes} eps.` : null,
  ].filter(Boolean);
  info.textContent = pedacos.join(" · ");

  corpo.append(titulo, info);
  cartao.append(numero, imagem, corpo);
  return cartao;
}

function renderizarPartes(partes) {
  elementos.carrossel.replaceChildren(...partes.map(criarCartaoParte));
}

function configurarSetasDoCarrossel() {
  const deslocamento = 282;
  elementos.setaEsquerda.addEventListener("click", () => {
    elementos.carrossel.scrollBy({ left: -deslocamento, behavior: "smooth" });
  });
  elementos.setaDireita.addEventListener("click", () => {
    elementos.carrossel.scrollBy({ left: deslocamento, behavior: "smooth" });
  });
}

/* -------------------- Renderização: Personagens -------------------- */

function criarCartaoPersonagem(personagem) {
  const cartao = document.createElement("button");
  cartao.type = "button";
  cartao.className = "cartao-personagem";
  cartao.setAttribute("aria-haspopup", "dialog");
  cartao.dataset.characterId = personagem.id;

  const imagem = document.createElement("div");
  imagem.className = "cartao-personagem__imagem";
  JojoSite.setImage(imagem, personagem.imageUrl, personagem.name);

  const corpo = document.createElement("div");
  corpo.className = "cartao-personagem__corpo";

  const nome = document.createElement("p");
  nome.className = "cartao-personagem__nome";
  nome.textContent = personagem.name;

  const favoritos = document.createElement("p");
  favoritos.className = "cartao-personagem__favoritos";
  favoritos.textContent = personagem.stand;

  const parte = document.createElement("p");
  parte.className = "cartao-personagem__parte";
  parte.textContent = personagem.partName;

  corpo.append(nome, favoritos, parte);
  cartao.append(imagem, corpo);

  cartao.addEventListener("click", () => abrirModalPersonagem(personagem));

  return cartao;
}

function renderizarPersonagens() {
  if (!catalogo.fonte) return;
  const personagens = JojoCatalog.filter(catalogo.personagens, elementos.busca.value);
  elementos.gradePersonagens.replaceChildren(...personagens.map(criarCartaoPersonagem));
  elementos.fonte.textContent = `${catalogo.fonte} · ${personagens.length} de ${catalogo.personagens.length} personagens · Mesmo catálogo de Minhas equipes.`;
  if (!personagens.length) {
    const mensagem = document.createElement("p");
    mensagem.className = "mensagem-carregando";
    mensagem.textContent = "Nenhum personagem encontrado. Tente outro nome, Stand ou parte.";
    elementos.gradePersonagens.append(mensagem);
  }
}

function mostrarErroCatalogo(erro, tentar) {
  elementos.fonte.textContent = "Catálogo indisponível no momento.";
  mostrarErro(elementos.gradePersonagens, erro.message || "Não foi possível carregar o catálogo.");
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "catalogo-tentar";
  botao.textContent = "Tentar novamente";
  botao.addEventListener("click", tentar);
  elementos.gradePersonagens.append(botao);
}

async function carregarPersonagens() {
  const requisicao = ++catalogo.requisicao;
  catalogo.fonte = "";
  catalogo.personagens = [];
  elementos.fonte.textContent = "Consultando o catálogo...";
  const carregando = document.createElement("p");
  carregando.className = "mensagem-carregando";
  carregando.textContent = "Carregando personagens...";
  elementos.gradePersonagens.replaceChildren(carregando);
  try {
    const parte = elementos.parte.value || "3";
    JojoCatalog.rememberPart(parte);
    const resposta = await JojoCatalog.characters(parte);
    if (requisicao !== catalogo.requisicao) return;
    catalogo.personagens = resposta.data;
    catalogo.fonte = resposta.meta.source;
    renderizarPersonagens();
  } catch (erro) {
    if (requisicao === catalogo.requisicao) mostrarErroCatalogo(erro, carregarPersonagens);
  }
}

async function iniciarCatalogo() {
  elementos.parte.disabled = true;
  try {
    const resposta = await JojoCatalog.parts();
    JojoCatalog.populateParts(elementos.parte, resposta.data);
    elementos.parte.disabled = false;
    elementos.busca.value = JojoCatalog.initialSearch();
    await carregarPersonagens();
  } catch (erro) { mostrarErroCatalogo(erro, iniciarCatalogo); }
}

/* -------------------- Modal de personagem -------------------- */

function adicionarDado(lista, rotulo, valor) {
  if (valor === null || valor === undefined || valor === "") return;
  const item = document.createElement("span");
  item.className = "chip";
  item.textContent = `${rotulo}: ${valor}`;
  lista.append(item);
}

let ultimoElementoFocado = null;

function abrirModalPersonagem(personagem) {
  ultimoElementoFocado = document.activeElement;
  catalogo.selecionado = personagem;
  preencherModalPersonagem(personagem);

  elementos.modal.hidden = false;
  elementos.modal.showModal();
  document.body.style.overflow = "hidden";
  elementos.modalFechar.focus();
}

function preencherModalPersonagem(personagem) {
  const extra = catalogo.extras.get(JojoCatalog.normalize(personagem.name)) || {};
  JojoSite.setImage(elementos.modalImagem, personagem.imageUrl, personagem.name);
  elementos.modalNome.textContent = personagem.name;
  elementos.modalNomeNativo.textContent = extra.name?.native ?? "";

  elementos.modalDados.replaceChildren();
  adicionarDado(elementos.modalDados, "Stand / técnica", personagem.stand);
  adicionarDado(elementos.modalDados, "Parte", personagem.partName);
  adicionarDado(elementos.modalDados, "Papel", personagem.role);
  adicionarDado(elementos.modalDados, "Gênero", traducaoGenero[extra.gender] ?? extra.gender);
  adicionarDado(elementos.modalDados, "Idade", extra.age);
  adicionarDado(elementos.modalDados, "Aniversário", formatarAniversario(extra.dateOfBirth));
  adicionarDado(elementos.modalDados, "Tipo sanguíneo", extra.bloodType);
  adicionarDado(elementos.modalDados, "Favoritos na AniList", extra.favourites);

  elementos.modalDescricao.textContent = extra.description
    ? limparDescricao(extra.description, 500)
    : "Este personagem está disponível no catálogo de equipes. Informações biográficas extras não estão disponíveis no momento.";
  elementos.modalLink.href = JojoSite.safeUrl(extra.siteUrl) || "#";
  elementos.modalLink.hidden = !JojoSite.safeUrl(extra.siteUrl);
  elementos.modalEquipe.href = JojoCatalog.teamUrl(personagem);
}

function fecharModalPersonagem() {
  catalogo.selecionado = null;
  elementos.modal.close();
  elementos.modal.hidden = true;
  document.body.style.overflow = "";
  ultimoElementoFocado?.focus();
}

function configurarModal() {
  elementos.modalFechar.addEventListener("click", fecharModalPersonagem);
  elementos.modalFundo.addEventListener("click", fecharModalPersonagem);
  elementos.modal.addEventListener("cancel", (event) => {
    event.preventDefault();
    fecharModalPersonagem();
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && !elementos.modal.hidden) {
      fecharModalPersonagem();
    }
  });
}

/* -------------------- Estados de carregamento e erro -------------------- */

function mostrarErro(container, texto) {
  const mensagem = document.createElement("p");
  mensagem.className = "mensagem-erro";
  mensagem.textContent = texto;
  container.replaceChildren(mensagem);
}

/* -------------------- Inicialização -------------------- */

async function carregarGuia() {
  try {
    const { partes, personagens, destaque } = await buscarDadosDaSaga();
    catalogo.extras = new Map(personagens.map((personagem) => [JojoCatalog.normalize(personagem.name.full), personagem]));
    renderizarHeroESinopse(destaque, personagens);
    renderizarPartes(partes);
    if (catalogo.selecionado && elementos.modal.open) preencherModalPersonagem(catalogo.selecionado);
    document.querySelector("#archive-status").textContent = "Sinopse e temporadas da AniList.";
  } catch (erro) {
    const { partes, personagens, destaque } = JOJO_ARCHIVE_FALLBACK;
    renderizarHeroESinopse(destaque, personagens);
    renderizarPartes(partes);
    document.querySelector("#archive-status").textContent = "Sinopse e temporadas da base local. O catálogo de personagens e suas equipes continuam disponíveis.";
  }
}

async function iniciar() {
  mapearElementos();
  configurarSetasDoCarrossel();
  configurarModal();
  elementos.parte.addEventListener("change", carregarPersonagens);
  elementos.busca.addEventListener("input", renderizarPersonagens);
  // Uma falha/atraso da AniList não muda nem bloqueia a lista de equipes.
  await Promise.all([iniciarCatalogo(), carregarGuia()]);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar);
} else {
  iniciar();
}
