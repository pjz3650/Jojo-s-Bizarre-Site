/* Conteúdo mínimo para a apresentação quando a AniList não responder.
   Não inventa imagens, links de perfis nem estatísticas da API. */
window.JOJO_ARCHIVE_FALLBACK = (() => {
  const rows = [
    ["Phantom Blood", "Jonathan Joestar", "Hamon"],
    ["Battle Tendency", "Joseph Joestar", "Hamon"],
    ["Stardust Crusaders", "Jotaro Kujo", "Star Platinum"],
    ["Diamond Is Unbreakable", "Josuke Higashikata", "Crazy Diamond"],
    ["Golden Wind", "Giorno Giovanna", "Gold Experience"],
    ["Stone Ocean", "Jolyne Cujoh", "Stone Free"],
  ];
  const personagens = rows.map(([part, name, stand], index) => ({
    id: `local-${index + 1}`,
    name: { full: name, native: "" }, image: {}, stand,
    description: `${name} é o protagonista de ${part}.`,
    favourites: null, siteUrl: "",
  }));
  const partes = rows.map(([name], index) => ({
    id: `local-${index + 1}`, title: { english: name },
    coverImage: {}, siteUrl: "/protagonistas", startDate: {},
    characters: { nodes: [personagens[index]] },
  }));
  const destaque = {
    title: { english: "JoJo's Bizarre Adventure" }, coverImage: {}, startDate: {},
    description: "Uma saga que atravessa gerações. Conheça as partes, os personagens e os protagonistas que carregam a vontade dos Joestar. Em Minhas equipes, escolha seus personagens e acompanhe cada mudança da formação.",
  };
  return { personagens, partes, destaque };
})();
