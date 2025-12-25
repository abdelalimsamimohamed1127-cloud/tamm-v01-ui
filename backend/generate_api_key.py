import os
import sys
import uuid
import hashlib
from supabase import create_client, Client

# Add backend directory to path to import Django settings
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tamm.settings.dev')

import django
django.setup()

from django.conf import settings
from external_api.supabase_repo import ExternalApiSupabaseRepo

def generate_and_store_api_key(workspace_id_str: str, scopes_str: str):
    """
    Generates a new API key, stores its hash and scopes in Supabase,
    and prints the raw API key.
    """
    try:
        workspace_id = uuid.UUID(workspace_id_str)
    except ValueError:
        print(f"Error: Invalid workspace_id format: {workspace_id_str}. Must be a valid UUID.")
        sys.exit(1)

    scopes = [s.strip() for s in scopes_str.split(',') if s.strip()]

    # Use the ExternalApiSupabaseRepo to generate and store the key
    repo = ExternalApiSupabaseRepo()
    
    try:
        raw_api_key = repo.create_api_key(workspace_id, scopes)
        print(f"\nSuccessfully generated API Key for workspace: {workspace_id}")
        print(f"Scopes: {', '.join(scopes)}")
        print(f"\n--- IMPORTANT: SAVE THIS KEY NOW ---")
        print(f"Raw API Key: {raw_api_key}")
        print(f"-------------------------------------\
")
        print("This key will not be shown again. Store it securely.")
    except Exception as e:
        print(f"Error generating or storing API key: {e}")
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python generate_api_key.py <workspace_uuid> <scope1,scope2,>")
        print("Example: python generate_api_key.py 12345678-1234-1234-1234-1234567890ab agent_run,event_ingest")
        sys.exit(1)
    
    workspace_id = sys.argv[1]
    scopes = sys.argv[2]
    
    generate_and_store_api_key(workspace_id, scopes)
