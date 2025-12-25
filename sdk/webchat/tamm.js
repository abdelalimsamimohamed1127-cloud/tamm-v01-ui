// sdk/webchat/tamm.js

(function(window) {
    "use strict";

    let config = {
        workspaceId: null,
        agentId: null,
        apiKey: null,
        apiBase: 'https://your-backend-domain.com/api/v1', // This should be configured for the production environment
    };

    let state = {
        sessionId: null,
    };

    // --- Private Methods ---

    async function handleStreamingResponse(response, onMessageCallback) {
        if (!response.body) {
            console.error("Streaming response not supported.");
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            
            // Assuming server-sent events (SSE) or simple chunked text
            // This logic can be made more robust depending on the streaming format
            let lines = buffer.split('\n');
            buffer = lines.pop(); // Keep the last, possibly incomplete line

            for (const line of lines) {
                if (line.startsWith('data: ')) { // SSE format
                    onMessageCallback(line.substring(6));
                } else if (line) { // Simple chunked text
                    onMessageCallback(line);
                }
            }
        }

        if (buffer && onMessageCallback) {
            onMessageCallback(buffer); // Process any remaining text
        }
    }


    // --- Public SDK Methods ---

    const Tamm = {
        init: function(userConfig) {
            config = { ...config, ...userConfig };
            console.log("Tamm SDK Initialized.");
        },

        open: function() {
            // This is a placeholder for UI logic which is out of scope for this stage.
            // In a real scenario, this would render and show the chat widget.
            console.log("Tamm.open() called. UI rendering is not implemented in this version.");
        },

        send: async function(message, callbacks = {}) {
            const { onMessage, onError } = callbacks;

            if (!config.agentId || !config.apiKey) {
                const errorMsg = "Tamm SDK not initialized. Please call Tamm.init({ workspaceId, agentId, apiKey }).";
                console.error(errorMsg);
                if (onError) onError(new Error(errorMsg));
                return;
            }

            const payload = {
                agent_id: config.agentId,
                session_id: state.sessionId,
                message: message,
                metadata: {
                    page_url: window.location.href,
                    referrer: document.referrer,
                }
            };

            try {
                const response = await fetch(`${config.apiBase}/webchat/message`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.apiKey}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`API request failed with status ${response.status}`);
                }
                
                // The backend needs to return the session_id in a header for the SDK to pick it up.
                // Assumption: The session ID is returned in a custom header e.g., 'X-Session-ID'.
                const responseSessionId = response.headers.get('X-Session-ID');
                if (responseSessionId) {
                    state.sessionId = responseSessionId;
                }

                if (onMessage) {
                    await handleStreamingResponse(response, onMessage);
                }

            } catch (error) {
                console.error("Tamm.send failed:", error);
                if (onError) onError(error);
            }
        },

        onMessage: function(callback) {
            // This is a conceptual registration. The actual message handling is
            // passed into the `send` method to correlate request and response streams.
            // This could be implemented with a more robust event emitter if needed.
            console.log("Tamm.onMessage handler registered. Pass this callback to the `send` method.");
        }
    };

    window.Tamm = Tamm;

})(window);