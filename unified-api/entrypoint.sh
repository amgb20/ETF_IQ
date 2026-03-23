#!/bin/sh
set -e

echo "Refreshing database collation version..."
python -c "
import asyncio, asyncpg, os
async def fix():
    url = os.environ['DATABASE_URL'].replace('postgresql+asyncpg://', 'postgresql://')
    conn = await asyncpg.connect(url)
    try:
        await conn.execute('ALTER DATABASE portfolioiq REFRESH COLLATION VERSION')
        print('Collation version refreshed.')
    except Exception as e:
        print(f'Collation refresh skipped: {e}')
    finally:
        await conn.close()
asyncio.run(fix())
" || echo "Collation refresh failed (non-fatal), continuing..."

echo "Running database migrations..."
alembic upgrade head

echo "Seeding ETF data..."
python seed.py

echo "Backfilling RAG chunks for existing data..."
python scripts/backfill_rag.py

echo "Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
