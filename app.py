import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, render_template, request

from database import close_db, get_db, init_db
from jojo_client import JojoCatalogClient


BASE_DIR = Path(__file__).resolve().parent


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        DATABASE=str(Path(app.instance_path) / "jojo_team_builder.db"),
        JIKAN_BASE_URL=os.getenv("JIKAN_BASE_URL", "https://api.jikan.moe/v4"),
        JOJO_API_FORCE_FALLBACK=os.getenv("JOJO_API_FORCE_FALLBACK", "0") == "1",
        JSON_SORT_KEYS=False,
    )

    if test_config:
        app.config.update(test_config)

    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    app.teardown_appcontext(close_db)

    with app.app_context():
        init_db()

    catalog = JojoCatalogClient(
        base_url=app.config["JIKAN_BASE_URL"],
        fallback_path=BASE_DIR / "data" / "fallback_characters.json",
        force_fallback=app.config["JOJO_API_FORCE_FALLBACK"],
    )

    @app.get("/")
    @app.get("/index.html")
    def index():
        return render_template("index.html", page="inicio")

    @app.get("/protagonistas")
    @app.get("/protagonistas.html")
    def protagonistas():
        return render_template("protagonistas.html", page="protagonistas")

    @app.get("/equipes")
    def equipes():
        return render_template("equipes.html", page="equipes")

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "jojo-team-builder"})

    @app.get("/api/catalog/parts")
    def list_parts():
        return jsonify({"data": catalog.list_parts()})

    @app.get("/api/catalog/characters")
    def list_characters():
        part_id = request.args.get("part", "3")
        query = request.args.get("q", "").strip()
        characters, source = catalog.get_characters(part_id)

        if query:
            normalized_query = query.casefold()
            characters = [
                character
                for character in characters
                if normalized_query in character["name"].casefold()
                or normalized_query in character.get("stand", "").casefold()
            ]

        return jsonify(
            {
                "data": characters,
                "meta": {
                    "source": source,
                    "count": len(characters),
                    "part": part_id,
                },
            }
        )

    @app.get("/api/teams")
    def list_teams():
        db = get_db()
        rows = db.execute(
            """
            SELECT id, name, current_version, created_at, updated_at
            FROM teams
            ORDER BY updated_at DESC
            """
        ).fetchall()
        return jsonify({"data": [dict(row) for row in rows]})

    @app.post("/api/teams")
    def create_team():
        payload = request.get_json(silent=True) or {}
        name = payload.get("name", "").strip()
        if not name:
            return error_response("O nome da equipe é obrigatório.", 400)

        now = utc_now()
        db = get_db()
        cursor = db.execute(
            """
            INSERT INTO teams (name, leader_character_id, current_version, created_at, updated_at)
            VALUES (?, NULL, 0, ?, ?)
            """,
            (name, now, now),
        )
        team_id = cursor.lastrowid
        save_version(db, team_id, "create", "Equipe criada")
        db.commit()
        return jsonify({"data": serialize_team(db, team_id)}), 201

    @app.get("/api/teams/<int:team_id>")
    def get_team(team_id):
        db = get_db()
        team = serialize_team(db, team_id)
        if not team:
            return error_response("Equipe não encontrada.", 404)
        return jsonify({"data": team})

    @app.put("/api/teams/<int:team_id>")
    def update_team(team_id):
        payload = request.get_json(silent=True) or {}
        db = get_db()
        current = serialize_team(db, team_id)
        if not current:
            return error_response("Equipe não encontrada.", 404)

        name = payload.get("name", current["name"])
        name = name.strip() if isinstance(name, str) else ""
        if not name:
            return error_response("O nome da equipe é obrigatório.", 400)

        leader_id = payload.get("leaderCharacterId", current["leaderCharacterId"])
        member_ids = {member["characterId"] for member in current["members"]}
        if leader_id is not None and str(leader_id) not in member_ids:
            return error_response("O líder precisa fazer parte da equipe.", 400)

        leader_id = str(leader_id) if leader_id is not None else None
        changed_name = name != current["name"]
        changed_leader = leader_id != current["leaderCharacterId"]
        if not changed_name and not changed_leader:
            return jsonify({"data": current})

        db.execute(
            """
            UPDATE teams
            SET name = ?, leader_character_id = ?, updated_at = ?
            WHERE id = ?
            """,
            (name, leader_id, utc_now(), team_id),
        )
        action = "rename" if changed_name and not changed_leader else "update"
        reason = payload.get("reason") or "Dados da equipe atualizados"
        save_version(db, team_id, action, reason)
        db.commit()
        return jsonify({"data": serialize_team(db, team_id)})

    @app.post("/api/teams/<int:team_id>/members")
    def add_member(team_id):
        payload = request.get_json(silent=True) or {}
        character = payload.get("character") or {}
        character_id = str(character.get("id", "")).strip()
        name = str(character.get("name", "")).strip()
        if not character_id or not name:
            return error_response("Personagem inválido.", 400)

        db = get_db()
        team = serialize_team(db, team_id)
        if not team:
            return error_response("Equipe não encontrada.", 404)
        if len(team["members"]) >= 6:
            return error_response("A equipe pode ter no máximo 6 personagens.", 400)
        if any(member["characterId"] == character_id for member in team["members"]):
            return error_response("Esse personagem já está na equipe.", 409)

        next_position = len(team["members"]) + 1
        db.execute(
            """
            INSERT INTO team_members (
                team_id, character_id, name, image_url, stand_name,
                part_name, character_role, position
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                team_id,
                character_id,
                name,
                character.get("imageUrl", ""),
                character.get("stand", "Stand não informado"),
                character.get("partName", "Parte não informada"),
                character.get("role", "Supporting"),
                next_position,
            ),
        )

        if not team["members"]:
            db.execute(
                "UPDATE teams SET leader_character_id = ?, updated_at = ? WHERE id = ?",
                (character_id, utc_now(), team_id),
            )
        else:
            db.execute("UPDATE teams SET updated_at = ? WHERE id = ?", (utc_now(), team_id))

        save_version(db, team_id, "add_member", f"{name} adicionado à equipe")
        db.commit()
        return jsonify({"data": serialize_team(db, team_id)}), 201

    @app.delete("/api/teams/<int:team_id>/members/<string:character_id>")
    def remove_member(team_id, character_id):
        db = get_db()
        team = serialize_team(db, team_id)
        if not team:
            return error_response("Equipe não encontrada.", 404)

        member = next(
            (item for item in team["members"] if item["characterId"] == character_id),
            None,
        )
        if not member:
            return error_response("Personagem não encontrado na equipe.", 404)

        db.execute(
            "DELETE FROM team_members WHERE team_id = ? AND character_id = ?",
            (team_id, character_id),
        )
        db.execute(
            """
            UPDATE team_members
            SET position = position - 1
            WHERE team_id = ? AND position > ?
            """,
            (team_id, member["position"]),
        )
        if team["leaderCharacterId"] == character_id:
            next_leader = db.execute(
                """
                SELECT character_id FROM team_members
                WHERE team_id = ? ORDER BY position LIMIT 1
                """,
                (team_id,),
            ).fetchone()
            next_leader_id = next_leader["character_id"] if next_leader else None
            db.execute(
                "UPDATE teams SET leader_character_id = ?, updated_at = ? WHERE id = ?",
                (next_leader_id, utc_now(), team_id),
            )
        else:
            db.execute("UPDATE teams SET updated_at = ? WHERE id = ?", (utc_now(), team_id))

        save_version(
            db,
            team_id,
            "remove_member",
            f"{member['name']} removido da equipe",
        )
        db.commit()
        return jsonify({"data": serialize_team(db, team_id)})

    @app.put("/api/teams/<int:team_id>/members/order")
    def reorder_members(team_id):
        payload = request.get_json(silent=True) or {}
        character_ids = [str(item) for item in payload.get("characterIds", [])]
        db = get_db()
        team = serialize_team(db, team_id)
        if not team:
            return error_response("Equipe não encontrada.", 404)

        existing_ids = [member["characterId"] for member in team["members"]]
        if sorted(character_ids) != sorted(existing_ids):
            return error_response("A ordem precisa conter todos os membros da equipe.", 400)

        for position, character_id in enumerate(character_ids, start=1):
            db.execute(
                "UPDATE team_members SET position = ? WHERE team_id = ? AND character_id = ?",
                (position, team_id, character_id),
            )
        db.execute("UPDATE teams SET updated_at = ? WHERE id = ?", (utc_now(), team_id))
        save_version(db, team_id, "reorder", "Ordem dos personagens alterada")
        db.commit()
        return jsonify({"data": serialize_team(db, team_id)})

    @app.get("/api/teams/<int:team_id>/history")
    def get_history(team_id):
        db = get_db()
        if not serialize_team(db, team_id):
            return error_response("Equipe não encontrada.", 404)
        rows = db.execute(
            """
            SELECT id, version_number, action, reason, snapshot_json, created_at
            FROM team_versions
            WHERE team_id = ?
            ORDER BY version_number DESC
            """,
            (team_id,),
        ).fetchall()
        history = []
        for row in rows:
            item = dict(row)
            item["snapshot"] = json.loads(item.pop("snapshot_json"))
            history.append(item)
        return jsonify({"data": history})

    @app.get("/api/teams/<int:team_id>/history/<int:version_number>")
    def get_version(team_id, version_number):
        db = get_db()
        row = db.execute(
            """
            SELECT id, version_number, action, reason, snapshot_json, created_at
            FROM team_versions
            WHERE team_id = ? AND version_number = ?
            """,
            (team_id, version_number),
        ).fetchone()
        if not row:
            return error_response("Versão não encontrada.", 404)
        item = dict(row)
        item["snapshot"] = json.loads(item.pop("snapshot_json"))
        return jsonify({"data": item})

    @app.post("/api/teams/<int:team_id>/rollback/<int:version_number>")
    def rollback_team(team_id, version_number):
        db = get_db()
        current = serialize_team(db, team_id)
        if not current:
            return error_response("Equipe não encontrada.", 404)

        row = db.execute(
            """
            SELECT snapshot_json FROM team_versions
            WHERE team_id = ? AND version_number = ?
            """,
            (team_id, version_number),
        ).fetchone()
        if not row:
            return error_response("Versão não encontrada.", 404)

        snapshot = json.loads(row["snapshot_json"])
        db.execute(
            """
            UPDATE teams
            SET name = ?, leader_character_id = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                snapshot["name"],
                snapshot.get("leaderCharacterId"),
                utc_now(),
                team_id,
            ),
        )
        db.execute("DELETE FROM team_members WHERE team_id = ?", (team_id,))
        for member in snapshot.get("members", []):
            db.execute(
                """
                INSERT INTO team_members (
                    team_id, character_id, name, image_url, stand_name,
                    part_name, character_role, position
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    team_id,
                    member["characterId"],
                    member["name"],
                    member.get("imageUrl", ""),
                    member.get("stand", "Stand não informado"),
                    member.get("partName", "Parte não informada"),
                    member.get("role", "Supporting"),
                    member["position"],
                ),
            )

        reason = f"Rollback realizado para a versão {version_number}"
        save_version(db, team_id, "rollback", reason)
        db.commit()
        return jsonify(
            {
                "data": serialize_team(db, team_id),
                "meta": {"restoredFromVersion": version_number},
            }
        )

    return app


def serialize_team(db, team_id):
    row = db.execute(
        """
        SELECT id, name, leader_character_id, current_version, created_at, updated_at
        FROM teams WHERE id = ?
        """,
        (team_id,),
    ).fetchone()
    if not row:
        return None

    team = dict(row)
    members = db.execute(
        """
        SELECT character_id, name, image_url, stand_name, part_name,
               character_role, position
        FROM team_members
        WHERE team_id = ?
        ORDER BY position
        """,
        (team_id,),
    ).fetchall()
    team["leaderCharacterId"] = team.pop("leader_character_id")
    team["currentVersion"] = team.pop("current_version")
    team["createdAt"] = team.pop("created_at")
    team["updatedAt"] = team.pop("updated_at")
    team["members"] = [
        {
            "characterId": member["character_id"],
            "name": member["name"],
            "imageUrl": member["image_url"],
            "stand": member["stand_name"],
            "partName": member["part_name"],
            "role": member["character_role"],
            "position": member["position"],
        }
        for member in members
    ]
    return team


def save_version(db, team_id, action, reason):
    current = db.execute(
        "SELECT current_version FROM teams WHERE id = ?",
        (team_id,),
    ).fetchone()
    next_version = current["current_version"] + 1
    db.execute(
        "UPDATE teams SET current_version = ? WHERE id = ?",
        (next_version, team_id),
    )
    snapshot = serialize_team(db, team_id)
    db.execute(
        """
        INSERT INTO team_versions (
            team_id, version_number, action, reason, snapshot_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            team_id,
            next_version,
            action,
            reason,
            json.dumps(snapshot, ensure_ascii=False),
            utc_now(),
        ),
    )


def error_response(message, status):
    return jsonify({"error": message}), status


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
