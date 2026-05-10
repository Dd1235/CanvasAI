from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from canvasai.api.routes import active_recall, chat, documents, health, sessions, ws, resources
from canvasai.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(sessions.router)
    app.include_router(chat.router)
    app.include_router(active_recall.router)
    app.include_router(documents.router)
    app.include_router(ws.router)
    app.include_router(resources.router)
    
    return app


app = create_app()