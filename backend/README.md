# Tamm Backend - Django Agent Runtime

This directory contains the Django backend for the Tamm AI Social Commerce Copilot, serving as the AI Brain and Orchestration Layer.

## Stage 1: Foundation Setup
- Supabase JWT authentication and user context extraction.
- Workspace context resolution and membership enforcement.
- Health check endpoint: `/api/health`.

## Stage 2: Agent Runtime API
- Implements the core Agent Runtime API with streaming responses.
- Loads agent configuration from Supabase.
- Calls AI models (OpenAI streaming).
- Persists conversation messages to Supabase.

## Stage 3: Knowledge + Message Intelligence + Training Pipeline
- Implements Knowledge Ingestion API (`POST /api/v1/knowledge/ingest`).
- Handles file upload, text extraction, chunking, and routing for embedding preparation.
- Implements Message Intelligence (topic, intent, sentiment extraction) for chat messages.
- Prepares for RAG by generating and storing embeddings.

---

### Setup Instructions

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Create and activate a Python virtual environment:**
    ```bash
    python -m venv venv
    .\venv\Scripts\activate   # On Windows
    source venv/bin/activate # On macOS/Linux
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure Environment Variables:**
    Create a `.env` file in the `backend/` directory by copying `.env.example` and filling in your Supabase and OpenAI credentials.
    ```bash
    cp .env.example .env
    # Open .env and fill in:
    # DJANGO_SECRET_KEY
    # SUPABASE_JWT_SECRET
    # SUPABASE_URL
    # SUPABASE_ANON_KEY
    # OPENAI_API_KEY
    # DATABASE_URL
    ```

5.  **Run Django Migrations (Optional for this stage):**
    While this stage does NOT use Django models or migrations, future stages might. For a complete setup, you would typically run:
    ```bash
    python manage.py migrate
    ```
    However, for Stage 1 & 2, this is not strictly necessary as we are not using Django's ORM for our data.

6.  **Run the Django Development Server:**
    ```bash
    python manage.py runserver
    ```
    The server will typically run on `http://127.0.0.1:8000/`.

---

### API Endpoints

#### 1. Health Check (Stage 1)

**GET** `/api/health`

-   Requires `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>`
-   Requires `X-Workspace-ID: <workspace_uuid>`

**Example Response:**
```json
{
  "status": "ok",
  "user_id": "uuid_from_jwt",
  "workspace_id": "uuid_from_header"
}
```

#### 2. AI Chat Runtime (Stage 2)

**POST** `/api/v1/ai/chat`

-   **Headers:**
    -   `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>`
    -   `X-Workspace-ID: <workspace_uuid>`
    -   `Content-Type: application/json`
    -   `Accept: text/event-stream` (Crucial for SSE)

-   **Request Body Example:**
    ```json
    {
      "agent_id": "YOUR_AGENT_UUID",
      "conversation_id": null, // or "YOUR_EXISTING_CONVERSATION_UUID"
      "channel": "playground",
      "message": {
        "type": "text",
        "content": "Hello, how can you help me today?"
      },
      "options": {
        "mode": "live" // or "test"
      }
    }
    ```

-   **Curl Example (Streaming - Successful):**
    You will need to replace `YOUR_SUPABASE_ACCESS_TOKEN`, `YOUR_WORKSPACE_UUID`, `YOUR_AGENT_UUID`, and optionally `YOUR_EXISTING_CONVERSATION_UUID` with actual values. Ensure your workspace has credits.

    ```bash
    curl -X POST \
      http://127.0.0.1:8000/api/v1/ai/chat \
      -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
      -H "X-Workspace-ID: YOUR_WORKSPACE_UUID" \
      -H "Content-Type: application/json" \
      -H "Accept: text/event-stream" \
      -d '{
            "agent_id": "YOUR_AGENT_UUID",
            "conversation_id": null,
            "channel": "playground",
            "message": {
              "type": "text",
              "content": "Tell me a joke about AI."
            },
            "options": {
              "mode": "live"
            }
          }'
    ```
    Expected SSE Response (example):
    ```
    event: start
    data: {"conversation_id":"<new_conversation_uuid>","agent_id":"YOUR_AGENT_UUID"}
    ... (token events) ...
    event: end
    data: {"status":"ok"}
    ```

-   **Curl Example (Streaming - Blocked by No Credits):**
    Ensure your workspace has 0 credits (or use the example above until credits run out).

    ```bash
    curl -X POST \
      http://127.0.0.1:8000/api/v1/ai/chat \
      -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
      -H "X-Workspace-ID: YOUR_WORKSPACE_UUID" \
      -H "Content-Type: application/json" \
      -H "Accept: text/event-stream" \
      -d '{
            "agent_id": "YOUR_AGENT_UUID",
            "conversation_id": null,
            "channel": "playground",
            "message": {
              "type": "text",
              "content": "What is the capital of France?"
            },
            "options": {
              "mode": "live"
            }
          }'
    ```
    Expected SSE Error Response:
    ```
    event: error
    data: {"message":"Insufficient credits to perform this AI operation.","code":"PAYMENT_REQUIRED"}
    ```
    And HTTP Status: 402 Payment Required.

-   **Curl Example (Rate Limited):**
    Send many requests rapidly to `/api/v1/ai/chat` (e.g., more than 60 in a minute) to trigger the rate limit.

    ```bash
    curl -X POST \
      http://127.0.0.1:8000/api/v1/ai/chat \
      -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
      -H "X-Workspace-ID: YOUR_WORKSPACE_UUID" \
      -H "Content-Type: application/json" \
      -H "Accept: text/event-stream" \
      -d '{
            "agent_id": "YOUR_AGENT_UUID",
            "conversation_id": null,
            "channel": "playground",
            "message": {
              "type": "text",
              "content": "Fast request!"
            },
            "options": {
              "mode": "live"
            }
          }'
    ```
    Expected HTTP Status: 429 Too Many Requests (with `Retry-After` header).

#### 3. Knowledge Ingest API (Stage 3)

**POST** `/api/v1/knowledge/ingest`

-   **Headers:**
    -   `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>`
    -   `X-Workspace-ID: <workspace_uuid>`
    -   `Content-Type: multipart/form-data`

-   **Form Data Fields:**
    -   `agent_id`: `YOUR_AGENT_UUID` (UUID of the agent to train)
    -   `source_type`: `file | message | external`
    -   `file`: (Optional, for `source_type=file`) The file to upload (e.g., `document.pdf`, `data.csv`, `text.txt`)
    -   `metadata`: (Optional, JSON string) Additional metadata, e.g., `{"source_name": "My Document", "author": "John Doe", "text_content": "Raw text if source_type is message/external"}`

-   **Curl Example (File Ingestion - PDF):**
    Replace `YOUR_SUPABASE_ACCESS_TOKEN`, `YOUR_WORKSPACE_UUID`, `YOUR_AGENT_UUID`, and provide an actual file path.

    ```bash
    curl -X POST \
      http://127.0.0.1:8000/api/v1/knowledge/ingest \
      -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
      -H "X-Workspace-ID: YOUR_WORKSPACE_UUID" \
      -F "agent_id=YOUR_AGENT_UUID" \
      -F "source_type=file" \
      -F "file=@/path/to/your/document.pdf;type=application/pdf" \
      -F 'metadata={"source_name": "Product Manual", "category": "documentation"}'
    ```

-   **Curl Example (Message/Text Ingestion):**
    Replace `YOUR_SUPABASE_ACCESS_TOKEN`, `YOUR_WORKSPACE_UUID`, `YOUR_AGENT_UUID`.

    ```bash
    curl -X POST \
      http://127.0.0.1:8000/api/v1/knowledge/ingest \
      -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
      -H "X-Workspace-ID: YOUR_WORKSPACE_UUID" \
      -H "Content-Type: multipart/form-data" \
      -F "agent_id=YOUR_AGENT_UUID" \
      -F "source_type=message" \
      -F 'metadata={"source_name": "Customer Feedback", "text_content": "The new feature is amazing, I love it!", "sentiment_expected": "Positive"}'
    ```

#### 4. Channel Event API (Stage 4)

**POST** `/api/v1/channels/event`

-   **Headers:**
    -   `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>`
    -   `X-Workspace-ID: <workspace_uuid>`
    -   `Content-Type: application/json`

-   **Request Body Example (from Edge Function):**
    ```json
    {
      "event": "message_received",
      "workspace_id": "YOUR_WORKSPACE_UUID",
      "agent_id": "YOUR_AGENT_UUID",
      "message_id": "UUID_OF_SUPABASE_MESSAGE",
      "channel": "whatsapp",
      "external_user_id": "whatsapp_user_id_or_phone_number",
      "message": {
        "type": "text",
        "content": "Hello AI agent!"
      }
    }
    ```

-   **Curl Example:**
    Replace placeholders with actual values.

    ```bash
    curl -X POST \
      http://127.0.0.1:8000/api/v1/channels/event \
      -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
      -H "X-Workspace-ID: YOUR_WORKSPACE_UUID" \
      -H "Content-Type: application/json" \
      -d '{
            "event": "message_received",
            "workspace_id": "YOUR_WORKSPACE_UUID",
            "agent_id": "YOUR_AGENT_UUID",
            "message_id": "MESSAGE_UUID_FROM_SUPABASE",
            "channel": "whatsapp",
            "external_user_id": "whatsapp_user_id_or_phone_number",
            "message": {
              "type": "text",
              "content": "Hi, I need help with my order."
            }
          }'
    ```

#### 5. Channel Send API (Stage 4)

**POST** `/api/v1/channels/send`

-   **Headers:**
    -   `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>`
    -   `X-Workspace-ID: <workspace_uuid>`
    -   `Content-Type: application/json`

-   **Request Body Example (from UI/AI):**
    ```json
    {
      "conversation_id": "YOUR_CONVERSATION_UUID",
      "agent_id": "YOUR_AGENT_UUID",
      "channel": "whatsapp",
      "external_user_id": "whatsapp_user_id_or_phone_number",
      "content": "Thank you for contacting support! How may I assist you?",
      "message_type": "text"
    }
    ```

-   **Curl Example:**
    Replace placeholders.

    ```bash
    curl -X POST \
      http://127.0.0.1:8000/api/v1/channels/send \
      -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
      -H "X-Workspace-ID: YOUR_WORKSPACE_UUID" \
      -H "Content-Type: application/json" \
      -d '{
            "conversation_id": "YOUR_CONVERSATION_UUID",
            "agent_id": "YOUR_AGENT_UUID",
            "channel": "whatsapp",
            "external_user_id": "whatsapp_user_id_or_phone_number",
            "content": "Your query has been forwarded to a human agent.",
            "message_type": "text"
          }'
    ```

#### 6. Copilot Insights Chat API (Stage 7.5)

**POST** `/api/v1/copilot/insights/chat`

-   **Headers:**
    -   `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>`
    -   `X-Workspace-ID: <workspace_uuid>`
    -   `Content-Type: application/json`

-   **Request Body Example:**
    ```json
    {
      "question": "Why did the number of complaints increase this week?",
      "context": {
        "page": "analytics",
        "range": "7d",
        "agent_id": "YOUR_AGENT_UUID"
      }
    }
    ```

-   **Curl Example:**
    Replace placeholders.

    ```bash
    curl -X POST \
      http://127.0.0.1:8000/api/v1/copilot/insights/chat \
      -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
      -H "X-Workspace-ID: YOUR_WORKSPACE_UUID" \
      -H "Content-Type: application/json" \
      -d '{
            "question": "Why did the number of complaints increase this week?",
            "context": {
              "page": "analytics",
              "range": "7d",
              "agent_id": "YOUR_AGENT_UUID"
            }
          }'
    ```
---
