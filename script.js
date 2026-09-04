const API_URL = "https://graphql.anilist.co";
const ANIME_PROCURADO = "JoJo's Bizarre Adventure";

const CONSULTA = `
  query ($nome: String) {
    Page(page: 1, perPage: 25) {
      media(search: $nome, type: ANIME, sort: SEARCH_MATCH) {
        id
        title {
          romaji
          english
        }
        characters(page: 1, perPage: 25) {
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

function obterContainer() {
  let container = document.querySelector("#cards-personagens");

  if (!container) {
    const pagina = document.createElement("main");
    pagina.className = "pagina-personagens";

    const titulo = document.createElement("h1");
    titulo.textContent = "Personagens de JoJo";

    container = document.createElement("section");
    container.id = "cards-personagens";
    container.className = "grade-personagens";
    container.setAttribute("aria-live", "polite");

    pagina.append(titulo, container);
    document.body.append(pagina);
  }

  return container;
}

function adicionarEstilos() {
  if (document.querySelector("#estilos-personagens")) return;

  const estilos = document.createElement("style");
  estilos.id = "estilos-personagens";
  estilos.textContent = `
    .pagina-personagens {
      width: min(1200px, calc(100% - 32px));
      margin: 40px auto;
      font-family: Inter, system-ui, sans-serif;
    }

    .pagina-personagens h1 {
      margin-bottom: 24px;
      text-align: center;
    }

    .grade-personagens {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 24px;
    }

    .card-personagem {
      overflow: hidden;
      border: 1px solid #ded7eb;
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 10px 24px rgb(55 27 88 / 12%);
    }

    .card-personagem__imagem {
      width: 100%;
      height: 320px;
      display: block;
      object-fit: cover;
      background: #ece7f2;
    }

    .card-personagem__conteudo {
      padding: 18px;
    }

    .card-personagem h2 {
      margin: 0 0 4px;
      font-size: 1.25rem;
    }

    .card-personagem__nome-nativo {
      min-height: 1.25em;
      margin: 0 0 14px;
      color: #6b6472;
    }

    .card-personagem__dados {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-bottom: 14px;
    }

    .card-personagem__dado {
      padding: 5px 8px;
      border-radius: 6px;
      background: #f1edf6;
      color: #403747;
      font-size: 0.82rem;
    }

    .card-personagem__descricao {
      color: #4d4652;
      line-height: 1.5;
    }

    .card-personagem__link {
      display: inline-block;
      margin-top: 4px;
      color: #6d28d9;
      font-weight: 700;
      text-decoration: none;
    }

    .card-personagem__link:hover {
      text-decoration: underline;
    }

    .mensagem-personagens {
      grid-column: 1 / -1;
      padding: 24px;
      border-radius: 12px;
      text-align: center;
      background: #f1edf6;
    }

    .mensagem-personagens--erro {
      color: #8b1d1d;
      background: #fee2e2;
    }
  `;

  document.head.append(estilos);
}

function limparDescricao(descricao) {
  if (!descricao) return "Descrição não informada pela API.";

  const documento = new DOMParser().parseFromString(descricao, "text/html");
  const texto = documento.body.textContent
    .replace(/~!/g, "")
    .replace(/!~/g, "")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return texto.length > 260 ? `${texto.slice(0, 257)}...` : texto;
}

function formatarAniversario(data) {
  if (!data || (!data.day && !data.month && !data.year)) return null;

  const partes = [];

  if (data.day) partes.push(String(data.day));
  if (data.month) partes.push(nomesMeses[data.month - 1]);
  if (data.year) partes.push(String(data.year));

  return partes.join(" de ");
}

function adicionarDado(lista, rotulo, valor) {
  if (valor === null || valor === undefined || valor === "") return;

  const item = document.createElement("span");
  item.className = "card-personagem__dado";
  item.textContent = `${rotulo}: ${valor}`;
  lista.append(item);
}

function criarCard(personagem) {
  const card = document.createElement("article");
  card.className = "card-personagem";

  const imagem = document.createElement("img");
  imagem.className = "card-personagem__imagem";
  imagem.src = personagem.image?.large ?? "";
  imagem.alt = `Imagem de ${personagem.name.full}`;
  imagem.loading = "lazy";

  const conteudo = document.createElement("div");
  conteudo.className = "card-personagem__conteudo";

  const nome = document.createElement("h2");
  nome.textContent = personagem.name.full;

  const nomeNativo = document.createElement("p");
  nomeNativo.className = "card-personagem__nome-nativo";
  nomeNativo.textContent = personagem.name.native ?? "";

  const dados = document.createElement("div");
  dados.className = "card-personagem__dados";
  adicionarDado(dados, "Gênero", traducaoGenero[personagem.gender] ?? personagem.gender);
  adicionarDado(dados, "Idade", personagem.age);
  adicionarDado(dados, "Aniversário", formatarAniversario(personagem.dateOfBirth));
  adicionarDado(dados, "Tipo sanguíneo", personagem.bloodType);
  adicionarDado(dados, "Favoritos", personagem.favourites?.toLocaleString("pt-BR"));

  const descricao = document.createElement("p");
  descricao.className = "card-personagem__descricao";
  descricao.textContent = limparDescricao(personagem.description);

  conteudo.append(nome, nomeNativo, dados, descricao);

  if (personagem.siteUrl) {
    const link = document.createElement("a");
    link.className = "card-personagem__link";
    link.href = personagem.siteUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Ver no AniList →";
    conteudo.append(link);
  }

  card.append(imagem, conteudo);
  return card;
}

function mostrarMensagem(container, texto, erro = false) {
  container.replaceChildren();

  const mensagem = document.createElement("p");
  mensagem.className = `mensagem-personagens${erro ? " mensagem-personagens--erro" : ""}`;
  mensagem.textContent = texto;
  container.append(mensagem);
}

async function buscarPersonagens() {
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

  const animes = resultado.data?.Page?.media ?? [];

  if (!animes.length) {
    throw new Error("Nenhum anime da franquia foi encontrado no AniList.");
  }

  const personagensPorId = new Map();

  for (const anime of animes) {
    for (const personagem of anime.characters?.nodes ?? []) {
      personagensPorId.set(personagem.id, personagem);
    }
  }

  return [...personagensPorId.values()].sort((personagemA, personagemB) => {
    const diferencaFavoritos = (personagemB.favourites ?? 0) - (personagemA.favourites ?? 0);
    return diferencaFavoritos || personagemA.name.full.localeCompare(personagemB.name.full);
  });
}

async function carregarCards() {
  adicionarEstilos();
  const container = obterContainer();
  mostrarMensagem(container, "Carregando personagens...");

  try {
    const personagens = await buscarPersonagens();

    if (!personagens.length) {
      mostrarMensagem(container, "Nenhum personagem foi encontrado.");
      return;
    }

    container.replaceChildren(...personagens.map(criarCard));
  } catch (erro) {
    console.error("Erro ao carregar personagens:", erro);
    mostrarMensagem(
      container,
      "Não foi possível carregar os personagens. Tente novamente em instantes.",
      true,
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", carregarCards);
} else {
  carregarCards();
}
