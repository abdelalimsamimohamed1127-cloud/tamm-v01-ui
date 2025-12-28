// src/components/copilot/FloatingCopilotWidget.tsx

import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, MessageSquare } from 'lucide-react'; // Assuming lucide-react for icons
import { useAuth } from '@/contexts/AuthContext'; // Assuming AuthContext for user info
import { useWorkspace } from '@/hooks'; // Assuming WorkspaceContext for workspace_id

const FloatingCopilotWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { token } = useAuth(); // Get auth token from context
  const { activeWorkspace } = useWorkspace(); // Get active workspace from context
  const workspaceId = activeWorkspace?.id;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: ChatMessage = { id: Date.now().toString(), sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      if (!workspaceId) {
        throw new Error("Workspace ID not available. Cannot send message.");
      }
      if (!token) {
        throw new Error("Authentication token not available. Cannot send message.");
      }

      // Real API call to Django backend
      const response = await fetch('/api/v1/copilot/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Use the auth token
        },
        body: JSON.stringify({ question: input, workspace_id: workspaceId }) // workspace_id is expected by backend serializer
      });

      if (!response.ok) {
        let errorData = await response.json();
        throw new Error(errorData.detail || 'Copilot API failed');
      }

      const responseData = await response.json();
      
      let copilotText = "I'm sorry, I couldn't process that request."; // Default error
      let isError = false;

      // Handle different response structures based on CopilotPersona
      if (responseData.explanation) { // Paid plan analytics summary
        copilotText = `Explanation: ${responseData.explanation}\n\nReasons: ${responseData.reasons.join(', ')}\n\nSuggestions: ${responseData.suggestions.join(', ')}`;
      } else if (responseData.answer !== undefined) { // Free plan or general question (check for undefined to allow empty string answers)
        copilotText = responseData.answer;
        if (responseData.feature_limit) {
          copilotText = `(Feature Limit): ${copilotText}`;
        }
      } else {
        isError = true;
      }

      setMessages((prev) => [...prev, { id: Date.now().toString() + '-bot', sender: 'copilot', text: copilotText, isError }]);
    } catch (error: any) {
      console.error("Copilot chat error:", error);
      setMessages((prev) => [...prev, { id: Date.now().toString() + '-error', sender: 'copilot', text: `Error: ${error.message}`, isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={toggleChat}
        className="fixed bottom-8 right-8 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 z-50"
        aria-label="Open Copilot Chat"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-8 w-80 h-96 bg-white rounded-lg shadow-xl flex flex-col z-50 border border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <Bot size={20} className="mr-2 text-indigo-600" /> Tamm Copilot
            </h3>
            <button onClick={toggleChat} className="text-gray-500 hover:text-gray-700 focus:outline-none">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 text-sm">
                Type a question to get started. For example: "What is my total message volume?"
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-lg ${ 
                    message.sender === 'user'
                      ? 'bg-indigo-600 text-white'
                      : message.isError ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-gray-100 text-gray-800'
                  } shadow-sm text-sm`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[75%] px-4 py-2 rounded-lg bg-gray-100 text-gray-800 shadow-sm text-sm">
                  <div className="flex items-center">
                    <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-900 mr-2"></span>
                    Thinking...
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-gray-200 flex items-center">
            <input
              type="text"
              className="flex-1 border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2"
              placeholder="Ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                }
              }}
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              className="ml-2 bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              disabled={isLoading}
              aria-label="Send message"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingCopilotWidget;
