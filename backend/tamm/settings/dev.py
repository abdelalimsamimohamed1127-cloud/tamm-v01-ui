from .base import *

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ['127.0.0.1', 'localhost']

# Override database settings for development if needed, e.g. using sqlite3
# Or ensure DATABASE_URL is set in .env for development
import dj_database_url

DATABASES = {
    'default': dj_database_url.config(
        default=os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/postgres'),
        conn_max_age=600
    )
}

# Development specific middleware
# Example: 'debug_toolbar.middleware.DebugToolbarMiddleware',

# Development specific installed apps
# Example: 'debug_toolbar',
