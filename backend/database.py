import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 1. Look for a cloud database environment variable first. 
# 2. If missing, use a completely renamed local filename (expenses_v2.db) to force a clean reset.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./expenses_v2.db")

# PostgreSQL connection strings from cloud providers often start with "postgresql://",
# but SQLAlchemy requires "postgresql+psycopg2://" to communicate properly.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

# SQLite requires extra thread arguments, PostgreSQL does not.
if "sqlite" in DATABASE_URL:
    connect_args = {"check_same_thread": False}
else:
    connect_args = {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# DB Dependency injection session helper
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
