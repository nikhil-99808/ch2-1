from pydantic import BaseModel, Field


class ProcessInput(BaseModel):
    pid: str = Field(min_length=1, max_length=16)
    activity: str = Field(default="", max_length=100)
    arrival: float = Field(ge=0)
    burst: float = Field(gt=0)


class ScheduleRequest(BaseModel):
    processes: list[ProcessInput] = Field(min_length=1, max_length=50)
    quantum: float = Field(gt=0, le=100000)


class AskRequest(BaseModel):
    question: str = Field(min_length=2, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=8)


class QuizRequest(BaseModel):
    topic: str = Field(default="Round Robin CPU scheduling", min_length=2, max_length=300)
    count: int = Field(default=5, ge=3, le=10)
