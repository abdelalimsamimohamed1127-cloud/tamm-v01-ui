# Tamm Webchat SDK

This SDK allows you to embed a Tamm-powered AI agent on your website.

## Installation

```html
<script src="https://path/to/your/sdk/tamm.js"></script>
```

## Usage

```javascript
// 1. Initialize the SDK
Tamm.init({
  workspaceId: 'YOUR_WORKSPACE_ID',
  agentId: 'YOUR_AGENT_ID',
  apiKey: 'YOUR_PUBLIC_API_KEY'
});

// 2. Open the chat widget (if you have a UI)
// Tamm.open(); 

// 3. Send a message
Tamm.send("Hello, I have a question about my order.");

// 4. Handle responses
// (Assuming the SDK will expose a way to listen to messages)
Tamm.onMessage((message) => {
  console.log("Assistant says:", message);
});
```

## API Reference

### `Tamm.init(config)`
Initializes the SDK.

*   `config` (object):
    *   `workspaceId` (string): Your workspace ID.
    *   `agentId` (string): The agent ID to connect to.
    *   `apiKey` (string): Your public API key.

### `Tamm.send(message)`
Sends a message to the agent.

*   `message` (string): The message content to send.
