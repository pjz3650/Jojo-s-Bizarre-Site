# JoJo — Guia da saga + Team Builder

Projeto local em Python/Flask e SQLite, adaptado ao visual do arquivo `jojo-site-v3-hero-e-header-corrigidos.zip`. Não precisa de Node nem de compilação. Não contém publicação automática.

## Páginas

| Endereço | Conteúdo |
| --- | --- |
| `/` | Hero com colagem, sinopse, carrossel de temporadas, personagens e detalhes do front recebido. |
| `/protagonistas` | Fichas e seletor dos seis protagonistas do front recebido. |
| `/equipes` | Catálogo por parte, busca por nome/Stand, várias equipes, até seis membros, líder, renomeação, histórico e rollback da versão Python. |

O menu conecta as três páginas. A área de equipes segue a tipografia e as cores do novo front. **Atual** e **Anterior** aparecem na formação e no histórico. `/index.html` e `/protagonistas.html` também funcionam.

## Catálogo e equipes consistentes

A lista da página inicial e a de **Minhas equipes** usam a mesma API Python e o mesmo código de consulta/filtro em `static/js/catalog.js`. Na mesma parte e busca, os personagens têm os mesmos IDs, nomes, imagens, Stands e papéis. Todos os resultados daquela parte são exibidos, sem o antigo corte em 24 personagens.

As duas telas lembram a última parte selecionada. Ao abrir uma ficha no início, **Ver este personagem nas equipes** leva à parte correta com a busca preenchida. A inclusão exige uma equipe selecionada, uma vaga livre e que o personagem ainda não esteja nela.

A AniList fornece conteúdo editorial e biografias opcionais; ela não define mais a lista de personagens selecionáveis. Se cair, não substitui essa lista por outros personagens. O cache de cada parte é compartilhado no Python, incluindo a base de contingência.

## Executar no Windows

Instale Python 3.10 ou superior. Extraia todo o ZIP e abra `start.bat` dentro de `jojo-site-integrado`. Na primeira execução, ele cria um ambiente virtual e instala as dependências; essa instalação precisa de internet.

Ou execute no terminal, dentro da pasta do projeto:

```powershell
python -m venv venv
venv\Scripts\activate
python -m pip install -r requirements.txt
python app.py
```

Abra [o site local](http://127.0.0.1:5000) e clique em **Minhas equipes**. Mantenha o terminal aberto enquanto usa o site; encerre com `Ctrl+C`.

Não abra o HTML com duplo clique: as páginas são templates servidos pelo Flask, e as equipes precisam da API Python em execução.

## Executar no Linux ou macOS

Dentro da pasta do projeto:

```bash
sh start.sh
```

Ou crie/ative um ambiente virtual, instale `requirements.txt` e execute `python app.py`.

## Manter as equipes que você já tinha

O esquema do banco e os endpoints de equipes continuam iguais aos da versão Python anterior. Não é necessário migrar tabelas.

1. Pare o servidor antigo e faça uma cópia de segurança da pasta `instance` dele.
2. Antes de iniciar este projeto, copie essa pasta para dentro de `jojo-site-integrado`.
3. O caminho deve ficar `jojo-site-integrado/instance/jojo_team_builder.db`.
4. Inicie o novo projeto. **Minhas equipes** carregará as equipes e o histórico desse arquivo.

Se já executou o projeto novo, pare-o antes de substituir o banco e guarde uma cópia dele caso tenha criado equipes. Copiar um arquivo não mescla dois bancos existentes.

O ZIP não inclui banco de usuários nem ambiente virtual. Sem banco anterior, o Flask cria um banco vazio automaticamente. `localStorage` guarda preferências: última equipe aberta e parte selecionada. Equipes e versões ficam no SQLite.

## APIs e contingência

- **Conteúdo editorial e protagonistas:** mantêm as consultas AniList do front enviado. Há timeout de 8 segundos e fichas locais quando a API falha. Fotos externas dependem da conexão; quando indisponíveis, os nomes aparecem no lugar delas.
- **Catálogo do início e das equipes:** usam Jikan via a mesma API Python, timeout de 5 segundos e `data/fallback_characters.json` de contingência. A fonte aparece nas duas telas. Os nomes dos Stands são complementados pelo projeto.
- **Equipes e versões:** usam somente API Flask e SQLite local. Uma queda das APIs externas não impede alterações nem rollback. As fotos não ficam no banco: são guardados seus URLs.

Os dois catálogos usam os IDs do Python anterior. Dados extras AniList só complementam a ficha quando o nome corresponde; não substituem nome, Stand, imagem ou ID do catálogo. Os registros e snapshots já salvos não são reescritos.

Para apresentar sem depender das APIs, ative a base local antes de iniciar:

```powershell
# PowerShell, com o ambiente virtual ativado
$env:JOJO_API_FORCE_FALLBACK="1"
python app.py
```

```bat
REM Prompt de Comando
set JOJO_API_FORCE_FALLBACK=1
python app.py
```

```bash
# Linux/macOS
JOJO_API_FORCE_FALLBACK=1 python app.py
```

Esse modo vale para as três páginas. Fontes externas podem ser substituídas pelas fontes do sistema. Remova a variável ou defina `0` e reinicie para consultar as APIs novamente. O cache do catálogo de equipes dura até reiniciar o servidor.

## Demonstração

Veja [APRESENTACAO.md](APRESENTACAO.md). Em uma equipe nova:

1. Crie **Cruzados** → V1.
2. Adicione **Jotaro Kujo** → V2.
3. Adicione **Joseph Joestar** → V3.
4. Remova Jotaro → V4.
5. Abra V2 e clique em **Restaurar esta versão** → V5.

A atual será **V5**, a anterior **V4**, e a origem da restauração **V2**. Jotaro volta e V1–V4 continuam no histórico.

## Código e testes

Veja [ARCHITECTURE.md](ARCHITECTURE.md) para arquivos, tabelas e endpoints. Com o ambiente virtual ativado:

```bash
python -m unittest discover -s tests -v
```

Os testes usam bancos temporários e a base local: rotas, criação, duplicidade, limite de seis membros, busca, líder, ordem, remoção, renomeação, rollback e persistência ao reiniciar.

Também verificam que todos os personagens da base local podem ser adicionados com os mesmos dados e que consultas repetidas mantêm a mesma fonte. Para testar o módulo JavaScript compartilhado, opcionalmente com Node instalado: `node --test tests/catalog.test.cjs`. Node não é necessário para executar o site.

O projeto é uma demonstração local sem autenticação, iniciada em `127.0.0.1`. Não há configuração de hospedagem nem publicação em GitHub/GPT Pages.
