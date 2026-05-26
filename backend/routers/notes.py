from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import database

router = APIRouter(prefix="/notes", tags=["notes"])

class NoteRequest(BaseModel):
    username: str
    content: str

class TaskRequest(BaseModel):
    username: str
    title: str

class TaskToggleRequest(BaseModel):
    username: str

@router.post("/add")
async def add_note(req: NoteRequest):
    user = await database.get_user_by_username(req.username)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    note_id = await database.add_note(user["id"], req.content)
    return {"status": "ok", "id": note_id}

@router.get("/get/{username}")
async def get_notes(username: str):
    user = await database.get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    notes = await database.get_notes(user["id"])
    return {"notes": notes}

@router.delete("/delete/{note_id}")
async def delete_note(note_id: int, username: str):
    user = await database.get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    await database.delete_note(note_id, user["id"])
    return {"status": "ok"}

@router.post("/tasks/add")
async def add_task(req: TaskRequest):
    user = await database.get_user_by_username(req.username)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    task_id = await database.add_task(user["id"], req.title)
    return {"status": "ok", "id": task_id}

@router.get("/tasks/get/{username}")
async def get_tasks(username: str):
    user = await database.get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    tasks = await database.get_tasks(user["id"])
    return {"tasks": tasks}

@router.post("/tasks/toggle/{task_id}")
async def toggle_task(task_id: int, req: TaskToggleRequest):
    user = await database.get_user_by_username(req.username)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    await database.toggle_task(task_id, user["id"])
    return {"status": "ok"}

@router.delete("/tasks/delete/{task_id}")
async def delete_task(task_id: int, username: str):
    user = await database.get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    await database.delete_task(task_id, user["id"])
    return {"status": "ok"}