from pydantic import BaseModel, EmailStr, Field
from app.models.enums import UserRole


class SignupRequest(BaseModel):
    name: str
    phone: str
    email: EmailStr | None = None
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    phone: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: int
    name: str


class UserOut(BaseModel):
    id: int
    name: str
    phone: str
    email: str | None = None
    role: UserRole

    class Config:
        from_attributes = True


class SendOtpRequest(BaseModel):
    phone: str = Field(min_length=8, max_length=20)


class VerifyOtpRequest(BaseModel):
    phone: str
    code: str = Field(min_length=6, max_length=6)
