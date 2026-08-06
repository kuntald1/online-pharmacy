from pydantic import BaseModel


class ProfileOut(BaseModel):
    id: int
    name: str
    email: str | None = None
    phone: str
    profile_image_url: str | None = None
    role: str

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    profile_image_url: str | None = None
