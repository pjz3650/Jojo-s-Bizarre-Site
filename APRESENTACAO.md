# Roteiro — aplicação prática de histórico e rollback

## 1. Mostrar o site

Abra o site pelo Flask. Mostre o hero, as temporadas e os protagonistas. Clique em **Minhas equipes**.

Diga: “Usamos dados de personagens de JoJo para montar equipes. Nosso sistema registra as mudanças dessas equipes e permite recuperar uma formação anterior.”

O que é versionado são os **dados da equipe**, não o código-fonte, o layout inteiro nem a base das APIs externas.

## 2. Representar as versões

Crie uma equipe nova para começar em V1:

| Ação | Versão | Formação |
| --- | --- | --- |
| Criar `Cruzados` | V1 | Vazia |
| Adicionar Jotaro Kujo | V2 | Jotaro |
| Adicionar Joseph Joestar | V3 | Jotaro e Joseph |
| Remover Jotaro | V4 | Joseph |

Mostre os registros no histórico. Abra V2: ela ainda contém Jotaro, mesmo que ele tenha sido removido da formação atual.

Diga: “Cada versão tem um número, uma ação, uma descrição, uma data e uma cópia completa da equipe em JSON. Essa cópia é um snapshot: inclui nome, líder e membros com suas posições.”

Mostre `save_version()` em `app.py` e `team_versions` em `schema.sql`. O banco é `instance/jojo_team_builder.db`.

## 3. Identificar atual e anterior

Na V4, a faixa da formação mostra **Atual V4 / Anterior V3**. O histórico marca as duas.

Diga: “O banco mantém `current_version` em `teams`. A API entrega esse valor como `currentVersion`. Como a numeração é sequencial e não apagamos versões, a anterior é esse número menos um. A V1 não tem anterior.”

## 4. Relacionar ao conceito

Abra **V2**, clique em **Restaurar esta versão** e confirme. Jotaro volta, Joseph sai e surge **V5**.

Diga: “Recuperamos o snapshot da V2 e aplicamos seus dados à equipe. Criamos a V5 para registrar essa restauração, mantendo as versões anteriores para consulta.”

| Informação após restaurar | Valor |
| --- | --- |
| Versão atual | V5 |
| Versão anterior à atual | V4 |
| Fonte da restauração | V2 |

Mostre que V3 e V4 ainda podem ser abertas. O histórico permite entender mudanças; snapshots permitem recuperar estados anteriores. Não é o comando SQL `ROLLBACK`: é a restauração de dados já salvos pela aplicação.

Uma queda da API não impede o uso das equipes e do histórico. Para evitar a espera das consultas, inicie com `JOJO_API_FORCE_FALLBACK=1`, conforme o README.
