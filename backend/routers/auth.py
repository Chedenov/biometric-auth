from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import database
import os
import base64
import time

router = APIRouter(prefix="/auth", tags=["auth"])

# challenge + время создания
challenges = {}

def set_challenge(username: str, challenge: str):
    challenges[username] = {"challenge": challenge, "created_at": time.time()}

def get_challenge(username: str):
    data = challenges.get(username)
    if not data:
        return None
    # Удаляем если старше 5 минут
    if time.time() - data["created_at"] > 300:
        del challenges[username]
        return None
    return data["challenge"]

class RegisterBeginRequest(BaseModel):
    username: str
    email: str

class RegisterCompleteRequest(BaseModel):
    username: str
    credential_id: str
    public_key: str
    client_data: str
    attestation: str

class LoginBeginRequest(BaseModel):
    username: str

class LoginCompleteRequest(BaseModel):
    username: str
    credential_id: str
    client_data: str
    authenticator_data: str
    signature: str

@router.post("/register/begin")
async def register_begin(req: RegisterBeginRequest):
    existing = await database.get_user_by_username(req.username)
    if existing and existing.get("credential_id"):
        raise HTTPException(status_code=400, detail="Пользователь уже зарегистрирован")

    if not existing:
        user_id = await database.create_user(req.username, req.email)
    else:
        user_id = existing["id"]

    challenge = base64.b64encode(os.urandom(32)).decode()
    set_challenge(req.username, challenge)

    return {
        "challenge": challenge,
        "user_id": user_id,
        "username": req.username,
        "rp_name": "Biometric Auth",
    }

@router.post("/register/complete")
async def register_complete(req: RegisterCompleteRequest):
    challenge = get_challenge(req.username)
    if not challenge:
        raise HTTPException(status_code=400, detail="Сначала начните регистрацию")

    user = await database.get_user_by_username(req.username)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    await database.update_user_credential(
        user["id"],
        req.credential_id,
        req.public_key,
        0
    )

    del challenges[req.username]
    await database.log_event(user["id"], "register", True)

    return {"status": "ok", "message": "Регистрация успешна"}

@router.post("/login/begin")
async def login_begin(req: LoginBeginRequest):
    user = await database.get_user_by_username(req.username)
    if not user or not user.get("credential_id"):
        raise HTTPException(status_code=404, detail="Пользователь не найден или не зарегистрирован")

    challenge = base64.b64encode(os.urandom(32)).decode()
    set_challenge(req.username, challenge)

    return {
        "challenge": challenge,
        "credential_id": user["credential_id"],
    }

@router.post("/login/complete")
async def login_complete(req: LoginCompleteRequest):
    challenge = get_challenge(req.username)
    if not challenge:
        raise HTTPException(status_code=400, detail="Сначала начните вход")

    user = await database.get_user_by_username(req.username)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    del challenges[req.username]
    await database.log_event(user["id"], "login", True)

    return {
        "status": "ok",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
        }
    }

@router.get("/me/{username}")
async def get_me(username: str):
    user = await database.get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="Не найден")
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "created_at": user["created_at"],
    }