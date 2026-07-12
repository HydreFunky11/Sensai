import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db.database import Base, get_db
from main import app

# Utiliser SQLite en mémoire pour isoler et accélérer les tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db():
    # Créer les tables en mémoire
    Base.metadata.create_all(bind=engine)
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()
    # Détruire les tables pour laisser la base propre
    Base.metadata.drop_all(bind=engine)

from core.rate_limiter import limiter_general, limiter_strict

@pytest.fixture(scope="function")
def client(db):
    # Surcharger la dépendance get_db pour injecter la base de test dans FastAPI
    def override_get_db():
        try:
            yield db
        finally:
            pass

    # Surcharger les rate limiters pour éviter les blocages de requêtes en rafale lors des tests
    async def dummy_limiter():
        return

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[limiter_general] = dummy_limiter
    app.dependency_overrides[limiter_strict] = dummy_limiter
    
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
