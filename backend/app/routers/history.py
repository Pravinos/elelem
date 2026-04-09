from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal

from app.services.database import append_messages, create_chat, delete_chat, get_chat, list_chats


router = APIRouter()


class HistoryMessageIn(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class CreateHistoryRequest(BaseModel):
    model: str
    messages: list[HistoryMessageIn] = Field(default_factory=list)


class UpdateHistoryRequest(BaseModel):
    messages: list[HistoryMessageIn] = Field(default_factory=list)


@router.get("/history")
async def get_history():
    return await list_chats()


@router.post("/history")
async def create_history(payload: CreateHistoryRequest):
    return await create_chat(
        payload.model,
        [message.model_dump() for message in payload.messages],
    )


@router.get("/history/{chat_id}")
async def get_history_chat(chat_id: str):
    chat = await get_chat(chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


@router.put("/history/{chat_id}")
async def update_history_chat(chat_id: str, payload: UpdateHistoryRequest):
    chat = await append_messages(
        chat_id,
        [message.model_dump() for message in payload.messages],
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


@router.delete("/history/{chat_id}")
async def delete_history_chat(chat_id: str):
    deleted = await delete_chat(chat_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"deleted": chat_id}
