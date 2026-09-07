import json
import re
import unicodedata
from threading import Lock

import requests


PARTS = {
    "1-2": {"name": "Phantom Blood + Battle Tendency", "anime_id": 14719},
    "3": {"name": "Stardust Crusaders", "anime_id": 20899},
    "4": {"name": "Diamond Is Unbreakable", "anime_id": 31933},
    "5": {"name": "Golden Wind", "anime_id": 37991},
    "6": {"name": "Stone Ocean", "anime_id": 48661},
}


CHARACTER_OVERRIDES = {
    "Kuujou, Joutarou": ("Jotaro Kujo", "Star Platinum"),
    "Joestar, Joseph": ("Joseph Joestar", "Hermit Purple"),
    "Brando, Dio": ("Dio Brando", "The World"),
    "Kakyoin, Noriaki": ("Noriaki Kakyoin", "Hierophant Green"),
    "Polnareff, Jean-Pierre": ("Jean Pierre Polnareff", "Silver Chariot"),
    "Avdol, Muhammad": ("Muhammad Avdol", "Magician's Red"),
    "Higashikata, Jousuke": ("Josuke Higashikata", "Crazy Diamond"),
    "Nijimura, Okuyasu": ("Okuyasu Nijimura", "The Hand"),
    "Hirose, Kouichi": ("Koichi Hirose", "Echoes"),
    "Kishibe, Rohan": ("Rohan Kishibe", "Heaven's Door"),
    "Kira, Yoshikage": ("Yoshikage Kira", "Killer Queen"),
    "Giovanna, Giorno": ("Giorno Giovanna", "Gold Experience"),
    "Bucciarati, Bruno": ("Bruno Bucciarati", "Sticky Fingers"),
    "Mista, Guido": ("Guido Mista", "Sex Pistols"),
    "Abbacchio, Leone": ("Leone Abbacchio", "Moody Blues"),
    "Ghirga, Narancia": ("Narancia Ghirga", "Aerosmith"),
    "Fugo, Pannacotta": ("Pannacotta Fugo", "Purple Haze"),
    "Cujoh, Jolyne": ("Jolyne Cujoh", "Stone Free"),
    "Costello, Ermes": ("Ermes Costello", "Kiss"),
    "F.F.": ("Foo Fighters", "Foo Fighters"),
    "Report, Weather": ("Weather Report", "Weather Report"),
    "Anasui, Narciso": ("Narciso Anasui", "Diver Down"),
    "Pucci, Enrico": ("Enrico Pucci", "Whitesnake"),
}


STANDS_BY_CHARACTER = {
    "Jotaro Kujo": "Star Platinum",
    "Joseph Joestar": "Hermit Purple",
    "Dio Brando": "The World",
    "DIO": "The World",
    "Noriaki Kakyoin": "Hierophant Green",
    "Jean Pierre Polnareff": "Silver Chariot",
    "Muhammad Avdol": "Magician's Red",
    "Iggy": "The Fool",
    "Josuke Higashikata": "Crazy Diamond",
    "Okuyasu Nijimura": "The Hand",
    "Koichi Hirose": "Echoes",
    "Rohan Kishibe": "Heaven's Door",
    "Yoshikage Kira": "Killer Queen",
    "Giorno Giovanna": "Gold Experience",
    "Bruno Bucciarati": "Sticky Fingers",
    "Guido Mista": "Sex Pistols",
    "Leone Abbacchio": "Moody Blues",
    "Narancia Ghirga": "Aerosmith",
    "Pannacotta Fugo": "Purple Haze",
    "Diavolo": "King Crimson",
    "Jolyne Cujoh": "Stone Free",
    "Ermes Costello": "Kiss",
    "Foo Fighters": "Foo Fighters",
    "Weather Report": "Weather Report",
    "Narciso Anasui": "Diver Down",
    "Enrico Pucci": "Whitesnake",
}


class JojoCatalogClient:
    def __init__(self, base_url, fallback_path, force_fallback=False):
        self.base_url = base_url.rstrip("/")
        self.force_fallback = force_fallback
        self._cache = {}
        self._locks = {part_id: Lock() for part_id in PARTS}
        with open(fallback_path, encoding="utf-8") as fallback_file:
            self.fallback_characters = json.load(fallback_file)

    def list_parts(self):
        return [
            {"id": part_id, "name": values["name"]}
            for part_id, values in PARTS.items()
        ]

    def get_characters(self, part_id):
        if part_id not in PARTS:
            part_id = "3"
        # Duas páginas abertas juntas recebem a mesma consulta/cache por parte,
        # inclusive se a primeira consulta cair na base de contingência.
        with self._locks[part_id]:
            return self._get_characters_cached(part_id)

    def _get_characters_cached(self, part_id):
        if part_id in self._cache:
            return self._cache[part_id]

        if not self.force_fallback:
            try:
                characters = self._fetch_from_jikan(part_id)
                if characters:
                    result = (characters, "Jikan API")
                    self._cache[part_id] = result
                    return result
            except requests.RequestException:
                pass

        fallback = [
            character
            for character in self.fallback_characters
            if character["partId"] == part_id
        ]
        result = (fallback, "Base local de contingência")
        self._cache[part_id] = result
        return result

    def _fetch_from_jikan(self, part_id):
        part = PARTS[part_id]
        response = requests.get(
            f"{self.base_url}/anime/{part['anime_id']}/characters",
            timeout=5,
        )
        response.raise_for_status()
        items = response.json().get("data", [])

        characters = []
        seen = set()
        for item in items:
            character = item.get("character", {})
            raw_name = character.get("name", "Personagem desconhecido")
            override = CHARACTER_OVERRIDES.get(raw_name)
            name = override[0] if override else raw_name
            stand = override[1] if override else STANDS_BY_CHARACTER.get(name, "Stand não informado")
            character_id = slugify(name)
            if character_id in seen:
                continue
            seen.add(character_id)
            characters.append(
                {
                    "id": character_id,
                    "externalId": character.get("mal_id"),
                    "name": name,
                    "imageUrl": character.get("images", {})
                    .get("jpg", {})
                    .get("image_url", ""),
                    "stand": stand,
                    "partId": part_id,
                    "partName": part["name"],
                    "role": translate_role(item.get("role", "Supporting")),
                }
            )

        characters.sort(key=lambda character: (character["role"] != "Principal", character["name"]))
        return characters


def slugify(value):
    value = unicodedata.normalize("NFKD", value)
    value = "".join(character for character in value if not unicodedata.combining(character))
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return value


def translate_role(role):
    return "Principal" if role == "Main" else "Coadjuvante"
