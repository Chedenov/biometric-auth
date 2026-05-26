from fastapi import APIRouter, HTTPException
import database

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/logs/{username}")
async def get_logs(username: str):
    user = await database.get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    logs = await database.get_logs(user["id"])
    return {"logs": logs}

@router.get("/all")
async def get_all_users():
    return {"message": "ok"}