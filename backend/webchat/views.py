# backend/webchat/views.py
import uuid
from django.http import StreamingHttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .serializers import WebchatMessageSerializer
from .sessions import WebchatSessionManager
from .supabase_repo import WebchatSupabaseRepo
from core.auth import APIKeyAuthentication  # Assumption: An API key auth class exists
from billing.rate_limit import WebchatRateLimiter  # Assumption: A rate limiter for webchat exists
from agents.runtime import AgentRuntime # Assumption: This is the main entrypoint for the AI

class WebchatMessageView(APIView):
    """
    Handles incoming messages from the webchat SDK.
    - Validates the request
    - Manages sessions
    - Stores the message
    - Invokes the AI agent runtime
    - Streams the response back
    """
    authentication_classes = [APIKeyAuthentication]
    throttle_classes = [WebchatRateLimiter]

    def post(self, request):
        serializer = WebchatMessageSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        agent_id = validated_data['agent_id']
        message_content = validated_data['message']

        # Use the service repo for system-level operations
        repo = WebchatSupabaseRepo()
        
        # 1. Validate agent and get workspace context
        agent_details = repo.get_agent_details(agent_id=agent_id)
        if not agent_details or not agent_details.get("ai_enabled"):
            return Response({"error": "Agent not found or is disabled."}, status=status.HTTP_404_NOT_FOUND)
        
        workspace_id = agent_details['workspace_id']
        
        # 2. Manage Session
        session_manager = WebchatSessionManager(repo)
        session = session_manager.get_or_create_session(
            agent_id=agent_id,
            workspace_id=workspace_id,
            session_id=validated_data.get('session_id')
        )

        # 3. Store inbound message in canonical format
        inbound_message = {
            "workspace_id": workspace_id,
            "agent_id": agent_id,
            "channel": "webchat",
            "external_user_id": session['external_user_id'],
            "direction": "inbound",
            "message_type": "text",
            "content": message_content,
            "raw_payload": validated_data.get('metadata', {}),
        }
        repo.create_chat_message(inbound_message)

        # 4. Forward to agent runtime and stream response
        # This assumes AgentRuntime can handle streaming output.
        try:
            runtime = AgentRuntime(workspace_id=workspace_id, agent_id=agent_id, user_jwt=request.auth)
            
            def stream_generator():
                # The runtime needs to be adapted to yield chunks of the response
                # This is a conceptual implementation.
                stream = runtime.stream_chat_response(
                    session_id=session['id'],
                    message_content=message_content
                )
                
                assistant_reply_content = ""
                for chunk in stream:
                    # Assuming chunk is a string or bytes
                    assistant_reply_content += chunk
                    yield chunk

                # 5. Persist assistant reply after streaming is complete
                outbound_message = {
                    "workspace_id": workspace_id,
                    "agent_id": agent_id,
                    "channel": "webchat",
                    "external_user_id": session['external_user_id'],
                    "direction": "outbound",
                    "message_type": "text",
                    "content": assistant_reply_content,
                    "raw_payload": {"source": "ai_reply"},
                }
                repo.create_chat_message(outbound_message)

            # Return a streaming response
            response = StreamingHttpResponse(stream_generator(), content_type='text/event-stream')
            response['X-Session-ID'] = session['id']
            return response

        except Exception as e:
            # Log the error properly in a real scenario
            print(f"Error during agent runtime invocation: {e}")
            return Response({"error": "An error occurred while processing your message."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)