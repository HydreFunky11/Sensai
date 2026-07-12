from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from db.database import get_db
from db import models
from core import security
from core.rate_limiter import limiter_strict

router = APIRouter(prefix="/auth", tags=["auth"])

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

@router.post("/register", response_model=Token, dependencies=[Depends(limiter_strict)])
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email déjà enregistré")
    
    hashed_password = security.get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = security.create_access_token(data={"sub": new_user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token, dependencies=[Depends(limiter_strict)])
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not security.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = security.create_access_token(data={"sub": db_user.email})
    return {"access_token": access_token, "token_type": "bearer"}

from api.deps import get_current_user

from typing import Optional

class UserMe(BaseModel):
    id: int
    email: str
    is_premium: bool

    class Config:
        from_attributes = True

@router.get("/me", response_model=UserMe)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user

class ProfileUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None

@router.put("/me", response_model=UserMe)
def update_profile(
    profile_data: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if profile_data.email:
        # Check if email is already registered by another user
        existing_user = db.query(models.User).filter(
            models.User.email == profile_data.email, 
            models.User.id != current_user.id
        ).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Cette adresse email est déjà utilisée par un autre compte.")
        current_user.email = profile_data.email

    if profile_data.password:
        current_user.hashed_password = security.get_password_hash(profile_data.password)

    db.commit()
    db.refresh(current_user)
    return current_user
