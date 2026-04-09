import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.engine import URL

DB_HOST = os.getenv('DB_HOST', '127.0.0.1')
DB_PORT = int(os.getenv('DB_PORT', '5432'))
DB_NAME = os.getenv('DB_NAME', 'shield_db')
DB_USER = os.getenv('DB_USER', 'shield')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'Shield@2026#Secure')

# Use URL.create so special chars in password (@ # etc.) are handled correctly
_db_url = URL.create(
    drivername='postgresql+asyncpg',
    username=DB_USER,
    password=DB_PASSWORD,
    host=DB_HOST,
    port=DB_PORT,
    database=DB_NAME,
)

engine = create_async_engine(
    _db_url, echo=False, pool_size=5, max_overflow=10,
    connect_args={"ssl": os.getenv("DB_SSL", "false").lower() == "true"}
)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

