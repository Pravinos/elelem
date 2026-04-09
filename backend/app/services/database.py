import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import uuid4

import aiosqlite


DB_PATH = os.getenv("DB_PATH", "./data/elelem.db")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _chat_title(messages: list[dict[str, str]]) -> str:
    for message in messages:
        if message.get("role") == "user":
            content = " ".join((message.get("content") or "").split())
            if content:
                return content[:40]
    return "new chat"


@asynccontextmanager
async def get_connection():
    connection = await aiosqlite.connect(DB_PATH)
    connection.row_factory = aiosqlite.Row
    await connection.execute("PRAGMA foreign_keys = ON;")
    try:
        yield connection
    finally:
        await connection.close()


async def init_database() -> None:
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    async with get_connection() as connection:
        await connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS chats (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              model TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
              id TEXT PRIMARY KEY,
              chat_id TEXT NOT NULL,
              role TEXT NOT NULL,
              content TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
            );
            """
        )
        await connection.commit()


async def list_chats() -> list[dict[str, str]]:
    async with get_connection() as connection:
        cursor = await connection.execute(
            """
            SELECT id, title, model, created_at, updated_at
            FROM chats
            ORDER BY updated_at DESC
            """
        )
        rows = await cursor.fetchall()

    return [
        {
            "id": row["id"],
            "title": row["title"],
            "model": row["model"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]


async def create_chat(model: str, messages: list[dict[str, str]]) -> dict[str, str]:
    chat_id = str(uuid4())
    timestamp = _now_iso()
    chat = {
        "id": chat_id,
        "title": _chat_title(messages),
        "model": model,
        "created_at": timestamp,
        "updated_at": timestamp,
    }

    async with get_connection() as connection:
        await connection.execute(
            """
            INSERT INTO chats (id, title, model, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (chat["id"], chat["title"], chat["model"], chat["created_at"], chat["updated_at"]),
        )

        for message in messages:
            await connection.execute(
                """
                INSERT INTO messages (id, chat_id, role, content, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (str(uuid4()), chat_id, message["role"], message["content"], _now_iso()),
            )

        await connection.commit()

    return chat


async def get_chat(chat_id: str) -> dict | None:
    async with get_connection() as connection:
        chat_cursor = await connection.execute(
            """
            SELECT id, title, model, created_at, updated_at
            FROM chats
            WHERE id = ?
            """,
            (chat_id,),
        )
        chat_row = await chat_cursor.fetchone()
        if not chat_row:
            return None

        message_cursor = await connection.execute(
            """
            SELECT id, role, content, created_at
            FROM messages
            WHERE chat_id = ?
            ORDER BY created_at ASC
            """,
            (chat_id,),
        )
        message_rows = await message_cursor.fetchall()

    return {
        "id": chat_row["id"],
        "title": chat_row["title"],
        "model": chat_row["model"],
        "created_at": chat_row["created_at"],
        "updated_at": chat_row["updated_at"],
        "messages": [
            {
                "id": row["id"],
                "role": row["role"],
                "content": row["content"],
                "created_at": row["created_at"],
            }
            for row in message_rows
        ],
    }


async def append_messages(chat_id: str, messages: list[dict[str, str]]) -> dict | None:
    async with get_connection() as connection:
        exists_cursor = await connection.execute("SELECT id FROM chats WHERE id = ?", (chat_id,))
        exists_row = await exists_cursor.fetchone()
        if not exists_row:
            return None

        for message in messages:
            await connection.execute(
                """
                INSERT INTO messages (id, chat_id, role, content, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (str(uuid4()), chat_id, message["role"], message["content"], _now_iso()),
            )

        await connection.execute(
            "UPDATE chats SET updated_at = ? WHERE id = ?",
            (_now_iso(), chat_id),
        )
        await connection.commit()

    return await get_chat(chat_id)


async def delete_chat(chat_id: str) -> bool:
    async with get_connection() as connection:
        cursor = await connection.execute("DELETE FROM chats WHERE id = ?", (chat_id,))
        await connection.commit()
        return cursor.rowcount > 0
