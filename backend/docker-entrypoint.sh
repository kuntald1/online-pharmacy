#!/bin/sh
set -e
echo "Waiting for database..."
python -c "
import time, sys
from sqlalchemy import create_engine
from app.core.config import settings
for attempt in range(30):
    try:
        engine = create_engine(settings.DATABASE_URL)
        conn = engine.connect()
        conn.close()
        print('Database is ready')
        sys.exit(0)
    except Exception as e:
        print(f'  attempt {attempt + 1}/30: {e}')
        time.sleep(2)
print('Database never became ready')
sys.exit(1)
"
echo "Running migrations..."
alembic upgrade head
echo "Starting app..."
exec "$@"
