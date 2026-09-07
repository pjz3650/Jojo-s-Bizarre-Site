const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../static/js/catalog.js"), "utf8");
const characters = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/fallback_characters.json"), "utf8"));

function setup(search = "", remembered = null) {
  const calls = [];
  const window = { location: { search, href: `http://localhost/${search}` }, history: { replaceState() {} } };
  const localStorage = { getItem: () => remembered, setItem() {} };
  const fetch = async (url) => {
    calls.push(url);
    const part = new URL(url, "http://localhost").searchParams.get("part");
    return { ok: true, json: async () => ({ data: characters.filter((c) => c.partId === part), meta: { source: "Base local de contingência" } }) };
  };
  const context = vm.createContext({ window, localStorage, URL, URLSearchParams, fetch });
  vm.runInContext(source, context);
  return { catalog: window.JojoCatalog, calls, context };
}

test("o catálogo compartilhado usa a API local em todas as partes", async () => {
  const { catalog, calls } = setup();
  for (const part of ["1-2", "3", "4", "5", "6"]) {
    const home = await catalog.characters(part);
    const teams = await catalog.characters(part);
    assert.deepEqual(home, teams);
    assert.equal(home.data.length, characters.filter((c) => c.partId === part).length);
  }
  assert.equal(calls.length, 10);
  assert.ok(calls.every((url) => url.startsWith("/api/catalog/characters?part=")));
});

test("a busca por nome/Stand não corta o catálogo nos primeiros 24", () => {
  const { catalog } = setup();
  const larger = Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: `Personagem ${i}`, stand: "Técnica" }));
  assert.equal(catalog.filter(larger, "").length, 30);
  assert.equal(catalog.filter(larger, "tecnica").length, 30);
  assert.equal(catalog.filter(characters, "  STAR PLATINUM  ")[0].id, "jotaro-kujo");
  assert.equal(catalog.filter(characters, "JOTARO")[0].id, "jotaro-kujo");
});

test("o link da ficha abre a mesma parte e o mesmo personagem nas equipes", () => {
  const { catalog } = setup();
  for (const character of characters) {
    const url = new URL(catalog.teamUrl(character), "http://localhost");
    assert.equal(url.pathname, "/equipes");
    assert.equal(url.searchParams.get("part"), character.partId);
    assert.equal(url.searchParams.get("q"), character.name);
    assert.equal(url.hash, "#catalog-title");
  }
});

test("bloquear localStorage não bloqueia a consulta do catálogo", async () => {
  const { catalog, context } = setup("?q=Jotaro");
  context.localStorage = { getItem() { throw Error("bloqueado"); }, setItem() { throw Error("bloqueado"); } };
  assert.doesNotThrow(() => catalog.rememberPart("3"));
  assert.equal(catalog.initialSearch(), "Jotaro");
  assert.ok((await catalog.characters("3")).data.length > 0);
});
