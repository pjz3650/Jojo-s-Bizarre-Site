import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import requests

from app import create_app
from jojo_client import JojoCatalogClient


class JojoTeamBuilderTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_directory = tempfile.TemporaryDirectory()
        database_path = Path(self.temp_directory.name) / "test.db"
        self.app = create_app(
            {
                "TESTING": True,
                "DATABASE": str(database_path),
                "JOJO_API_FORCE_FALLBACK": True,
            }
        )
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp_directory.cleanup()

    def test_health_endpoint(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "ok")

    def test_catalog_uses_fallback_when_configured(self):
        response = self.client.get("/api/catalog/characters?part=3")
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(body["meta"]["source"], "Base local de contingência")
        self.assertTrue(any(item["name"] == "Jotaro Kujo" for item in body["data"]))

    def test_team_history_and_rollback(self):
        created = self.client.post("/api/teams", json={"name": "Cruzados do Egito"})
        self.assertEqual(created.status_code, 201)
        team = created.get_json()["data"]
        team_id = team["id"]
        self.assertEqual(team["currentVersion"], 1)

        character = {
            "id": "jotaro-kujo",
            "name": "Jotaro Kujo",
            "imageUrl": "",
            "stand": "Star Platinum",
            "partName": "Stardust Crusaders",
            "role": "Principal",
        }
        added = self.client.post(
            f"/api/teams/{team_id}/members",
            json={"character": character},
        )
        self.assertEqual(added.status_code, 201)
        self.assertEqual(added.get_json()["data"]["currentVersion"], 2)

        renamed = self.client.put(
            f"/api/teams/{team_id}",
            json={"name": "Equipe Alterada"},
        )
        self.assertEqual(renamed.status_code, 200)
        self.assertEqual(renamed.get_json()["data"]["currentVersion"], 3)

        rollback = self.client.post(f"/api/teams/{team_id}/rollback/1", json={})
        restored = rollback.get_json()["data"]
        self.assertEqual(rollback.status_code, 200)
        self.assertEqual(restored["name"], "Cruzados do Egito")
        self.assertEqual(restored["members"], [])
        self.assertEqual(restored["currentVersion"], 4)

        history = self.client.get(f"/api/teams/{team_id}/history").get_json()["data"]
        self.assertEqual(len(history), 4)
        self.assertEqual(history[0]["action"], "rollback")
        self.assertEqual(history[0]["snapshot"]["name"], "Cruzados do Egito")

    def test_team_rejects_duplicate_member(self):
        team_id = self.client.post("/api/teams", json={"name": "Teste"}).get_json()["data"]["id"]
        character = {
            "id": "dio",
            "name": "DIO",
            "stand": "The World",
            "partName": "Stardust Crusaders",
        }
        self.client.post(f"/api/teams/{team_id}/members", json={"character": character})
        duplicate = self.client.post(
            f"/api/teams/{team_id}/members",
            json={"character": character},
        )
        self.assertEqual(duplicate.status_code, 409)

    def test_pages_share_navigation_and_preserve_team_controls(self):
        for route in ("/", "/index.html", "/protagonistas", "/protagonistas.html", "/equipes"):
            response = self.client.get(route)
            self.assertEqual(response.status_code, 200, route)
            self.assertIn('href="/equipes"', response.text)
            self.assertIn('href="/protagonistas"', response.text)
        page = self.client.get("/equipes").text
        for control in ("team-select", "part-filter", "character-search", "team-slots",
                        "history-list", "rollback-button", "current-version", "previous-version"):
            self.assertIn(f'id="{control}"', page)

    def test_existing_database_retains_snapshots_leader_and_order(self):
        # Reabrir o mesmo SQLite reproduz o uso do banco após atualizar o site.
        team_id = self.client.post("/api/teams", json={"name": "Cruzados"}).get_json()["data"]["id"]
        other_id = self.client.post("/api/teams", json={"name": "Outra equipe"}).get_json()["data"]["id"]
        characters = self.client.get("/api/catalog/characters?part=3").get_json()["data"][:2]
        for character in characters:
            self.client.post(f"/api/teams/{team_id}/members", json={"character": character})
        ids = [character["id"] for character in characters]
        self.client.put(f"/api/teams/{team_id}", json={"leaderCharacterId": ids[1]})
        order = self.client.put(f"/api/teams/{team_id}/members/order", json={"characterIds": ids[::-1]})
        snapshot = order.get_json()["data"]
        self.assertEqual(snapshot["currentVersion"], 5)
        self.assertEqual([m["characterId"] for m in snapshot["members"]], ids[::-1])
        self.client.put(f"/api/teams/{team_id}", json={"name": "Nome temporário"})
        removed = self.client.delete(f"/api/teams/{team_id}/members/{ids[1]}").get_json()["data"]
        self.assertEqual(removed["leaderCharacterId"], ids[0])
        self.assertEqual(removed["members"][0]["position"], 1)
        reopened = create_app({"TESTING": True, "DATABASE": self.app.config["DATABASE"],
                               "JOJO_API_FORCE_FALLBACK": True}).test_client()
        reopened.get("/")
        reopened.get("/protagonistas")
        reopened.get("/equipes")
        restored = reopened.post(f"/api/teams/{team_id}/rollback/5", json={}).get_json()["data"]
        self.assertEqual(restored["currentVersion"], 8)
        for key in ("name", "leaderCharacterId", "members"):
            self.assertEqual(restored[key], snapshot[key])
        history = reopened.get(f"/api/teams/{team_id}/history").get_json()["data"]
        self.assertEqual([v["version_number"] for v in history], list(range(8, 0, -1)))
        self.assertEqual(history[3]["snapshot"], snapshot)
        self.assertEqual(history[0]["action"], "rollback")
        other = reopened.get(f"/api/teams/{other_id}").get_json()["data"]
        self.assertEqual(other["currentVersion"], 1)
        self.assertEqual(other["members"], [])

    def test_six_member_limit_and_search(self):
        team_id = self.client.post("/api/teams", json={"name": "Seis vagas"}).get_json()["data"]["id"]
        characters = []
        for part in ("3", "4"):
            characters.extend(self.client.get(f"/api/catalog/characters?part={part}").get_json()["data"])
        for character in characters[:6]:
            added = self.client.post(f"/api/teams/{team_id}/members", json={"character": character})
            self.assertEqual(added.status_code, 201)
        rejected = self.client.post(f"/api/teams/{team_id}/members", json={"character": characters[6]})
        self.assertEqual(rejected.status_code, 400)
        history = self.client.get(f"/api/teams/{team_id}/history").get_json()["data"]
        self.assertEqual(len(history), 7)
        search = self.client.get("/api/catalog/characters?part=3&q=Star%20Platinum").get_json()["data"]
        self.assertEqual([character["name"] for character in search], ["Jotaro Kujo"])

    def test_every_local_catalog_character_can_be_added_with_the_same_data(self):
        parts = self.client.get("/api/catalog/parts").get_json()["data"]
        for part in parts:
            characters = self.client.get(f"/api/catalog/characters?part={part['id']}").get_json()["data"]
            # Uma equipe para cada personagem: o limite de seis não interfere
            # na verificação de disponibilidade de todo o catálogo.
            for character in characters:
                with self.subTest(part=part["id"], character=character["id"]):
                    team_id = self.client.post("/api/teams", json={"name": "Catálogo"}).get_json()["data"]["id"]
                    added = self.client.post(f"/api/teams/{team_id}/members", json={"character": character})
                    self.assertEqual(added.status_code, 201)
                    member = added.get_json()["data"]["members"][0]
                    self.assertEqual(member["characterId"], character["id"])
                    for key in ("name", "stand", "imageUrl", "partName", "role"):
                        self.assertEqual(member[key], character[key])

    def test_catalog_keeps_the_same_source_between_pages(self):
        fallback = Path(__file__).resolve().parents[1] / "data" / "fallback_characters.json"
        for live in (True, False):
            with self.subTest(live=live):
                catalog = JojoCatalogClient("https://example.invalid", fallback)
                result = [{"id": "jotaro-kujo", "name": "Jotaro Kujo"}]
                with patch.object(catalog, "_fetch_from_jikan", return_value=result) as upstream:
                    if not live:
                        upstream.side_effect = requests.Timeout("API indisponível")
                    first_page = catalog.get_characters("3")
                    second_page = catalog.get_characters("3")
                    self.assertEqual(first_page, second_page)
                    self.assertEqual(first_page[1], "Jikan API" if live else "Base local de contingência")
                    upstream.assert_called_once_with("3")


if __name__ == "__main__":
    unittest.main()
