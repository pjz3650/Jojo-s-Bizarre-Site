const API_URL = "https://graphql.anilist.co";
const ANIME_PROCURADO = "JoJo's Bizarre Adventure";

// Uma única consulta traz a lista de partes da saga (para o carrossel
// "Temporadas") e, aninhado em cada parte, o elenco de personagens
// (que depois é deduplicado e ordenado por popularidade).
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

function mapearElementos() {
  elementos.cabecalho = document.querySelector("#cabecalho");
  elementos.botaoMenu = document.querySelector("#botaoMenu");
  elementos.navegacao = document.querySelector("#navegacao");
  elementos.heroImagem = document.querySelector("#heroImagem");
  elementos.heroCollage = document.querySelector("#heroCollage");
  elementos.sinopseConteudo = document.querySelector("#sinopseConteudo");
  elementos.sinopseMeta = document.querySelector("#sinopseMeta");
  elementos.sinopseImagem = document.querySelector("#sinopseImagem");
  elementos.carrossel = document.querySelector("#carrosselTemporadas");
  elementos.setaEsquerda = document.querySelector("#setaEsquerda");
  elementos.setaDireita = document.querySelector("#setaDireita");
  elementos.gradePersonagens = document.querySelector("#gradePersonagens");
  elementos.modal = document.querySelector("#modalPersonagem");
  elementos.modalFundo = document.querySelector("#modalFundo");
  elementos.modalFechar = document.querySelector("#modalFechar");
  elementos.modalImagem = document.querySelector("#modalImagem");
  elementos.modalNome = document.querySelector("#modalNome");
  elementos.modalNomeNativo = document.querySelector("#modalNomeNativo");
  elementos.modalDados = document.querySelector("#modalDados");
  elementos.modalDescricao = document.querySelector("#modalDescricao");
  elementos.modalLink = document.querySelector("#modalLink");
}

/* -------------------- Cabeçalho e menu mobile -------------------- */

function configurarCabecalho() {
  const aoRolar = () => {
    elementos.cabecalho.classList.toggle("cabecalho--solido", window.scrollY > 40);
  };
  aoRolar();
  window.addEventListener("scroll", aoRolar, { passive: true });
}

function configurarMenuMobile() {
  elementos.botaoMenu.addEventListener("click", () => {
    const aberto = elementos.navegacao.classList.toggle("navegacao--aberta");
    elementos.botaoMenu.setAttribute("aria-expanded", String(aberto));
  });

  elementos.navegacao.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      elementos.navegacao.classList.remove("navegacao--aberta");
      elementos.botaoMenu.setAttribute("aria-expanded", "false");
    });
  });
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
  const resposta = await fetch(API_URL, {
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

  if (!resposta.ok) {
    throw new Error(`A API respondeu com o status ${resposta.status}.`);
  }

  const resultado = await resposta.json();

  if (resultado.errors?.length) {
    throw new Error(resultado.errors.map(({ message }) => message).join("; "));
  }

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
    .map((nome) => personagens.find((p) => p.name?.full === nome)?.image?.large)
    .filter(Boolean);

  if (elementos.heroCollage) {
    const paineis = [...elementos.heroCollage.querySelectorAll(".hero__painel")];
    paineis.forEach((painel, indice) => {
      const imagem = imagensHero[indice];
      if (imagem) painel.style.backgroundImage = `url(${imagem})`;
    });
  }

  if (destaque.coverImage?.extraLarge) {
    elementos.sinopseImagem.style.backgroundImage = `url(${destaque.coverImage.extraLarge})`;
  }

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
  cartao.href = parte.siteUrl;
  cartao.target = "_blank";
  cartao.rel = "noopener noreferrer";

  const numero = document.createElement("span");
  numero.className = "cartao-parte__numero";
  numero.textContent = String(indice + 1).padStart(2, "0");

  const imagem = document.createElement("div");
  imagem.className = "cartao-parte__imagem";
  if (parte.coverImage?.extraLarge) {
    imagem.style.backgroundImage = `url(${parte.coverImage.extraLarge})`;
  }

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

  const imagem = document.createElement("div");
  imagem.className = "cartao-personagem__imagem";
  if (personagem.image?.large) {
    imagem.style.backgroundImage = `url(${personagem.image.large})`;
  }

  const corpo = document.createElement("div");
  corpo.className = "cartao-personagem__corpo";

  const nome = document.createElement("p");
  nome.className = "cartao-personagem__nome";
  nome.textContent = personagem.name.full;

  const favoritos = document.createElement("p");
  favoritos.className = "cartao-personagem__favoritos";
  favoritos.textContent = `♥ ${(personagem.favourites ?? 0).toLocaleString("pt-BR")}`;

  corpo.append(nome, favoritos);
  cartao.append(imagem, corpo);

  cartao.addEventListener("click", () => abrirModalPersonagem(personagem));

  return cartao;
}

function renderizarPersonagens(personagens) {
  const principais = personagens.slice(0, 24);
  elementos.gradePersonagens.replaceChildren(...principais.map(criarCartaoPersonagem));
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

  elementos.modalImagem.style.backgroundImage = personagem.image?.large
    ? `url(${personagem.image.large})`
    : "none";
  elementos.modalNome.textContent = personagem.name.full;
  elementos.modalNomeNativo.textContent = personagem.name.native ?? "";

  elementos.modalDados.replaceChildren();
  adicionarDado(elementos.modalDados, "Gênero", traducaoGenero[personagem.gender] ?? personagem.gender);
  adicionarDado(elementos.modalDados, "Idade", personagem.age);
  adicionarDado(elementos.modalDados, "Aniversário", formatarAniversario(personagem.dateOfBirth));
  adicionarDado(elementos.modalDados, "Tipo sanguíneo", personagem.bloodType);

  elementos.modalDescricao.textContent = limparDescricao(personagem.description, 500);
  elementos.modalLink.href = personagem.siteUrl ?? "#";

  elementos.modal.hidden = false;
  document.body.style.overflow = "hidden";
  elementos.modalFechar.focus();
}

function fecharModalPersonagem() {
  elementos.modal.hidden = true;
  document.body.style.overflow = "";
  ultimoElementoFocado?.focus();
}

function configurarModal() {
  elementos.modalFechar.addEventListener("click", fecharModalPersonagem);
  elementos.modalFundo.addEventListener("click", fecharModalPersonagem);
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

async function iniciar() {
  mapearElementos();
  configurarCabecalho();
  configurarMenuMobile();
  configurarSetasDoCarrossel();
  configurarModal();

  try {
    const { partes, personagens, destaque } = await buscarDadosDaSaga();
    renderizarHeroESinopse(destaque, personagens);
    renderizarPartes(partes);
    renderizarPersonagens(personagens);
  } catch (erro) {
    console.error("Erro ao carregar dados da AniList:", erro);
    elementos.sinopseConteudo.textContent =
      "Não foi possível carregar a sinopse agora. Tente novamente em instantes.";
    mostrarErro(elementos.carrossel, "Não foi possível carregar as partes da saga.");
    mostrarErro(elementos.gradePersonagens, "Não foi possível carregar os personagens.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar);
} else {
  iniciar();
}
