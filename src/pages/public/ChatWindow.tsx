import { useEffect, useMemo, useState, type FormEvent, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
// import { useChat } from "ai/react"; // REMOVE THIS IMPORT
import { getAgent } from '@/services/agents'; // Import agent service
import { getAgentChannel } from '@/services/channels'; // Import channels service
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { runAgentStream, AgentRuntimeRequest } from '@/lib/agentRuntime'; // NEW IMPORT

type Msg = { role: 'user' | 'assistant' | 'system'; content: string }; // Moved here for local usage

export default function ChatWindow() {
  const { agentId } = useParams();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get("mode") === "embed";

  const [agentName, setAgentName] = useState("Chat");
  const [isVerifyingChannel, setIsVerifyingChannel] = useState(true);
  const [isChannelActive, setIsChannelActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Reimplementing useChat state
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const streamingAssistantMessageContentRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Effect for loading agent name and verifying channel status
  useEffect(() => {
    let active = true;
    async function loadAgentAndChannel() {
      if (!agentId) {
        setIsVerifyingChannel(false);
        setIsChannelActive(false);
        return;
      }

      setIsVerifyingChannel(true);

      // 1. Fetch Agent Name
      const agentData = await getAgent(agentId);

      if (!active) return;
      if (!agentData) {
        console.error("Failed to load agent: Agent not found");
        setAgentName("Chat");
      } else {
        setAgentName(agentData.name);
      }

      // 2. Verify Webchat Channel is Active
      const channelData = await getAgentChannel(agentId, "webchat");
      
      if (!active) return;
      if (!channelData) {
        console.warn("Webchat channel not configured or error fetching.");
        setIsChannelActive(false);
      } else {
        // As per schema, is_active is now in the config blob for webchat
        const isActive = channelData.config?.is_active === true && channelData.status !== 'disconnected';
        setIsChannelActive(isActive);
      }
      
      setIsVerifyingChannel(false);
    }

    void loadAgentAndChannel();
    return () => {
      active = false;
    };
  }, [agentId]);

  // Original useEffect for session ID
  useEffect(() => {
    // Generate a visitor_id, but we'll call it sessionId to match existing code
    const key = "tamm_visitor_id"; 
    let visitorId = localStorage.getItem(key);
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(key, visitorId);
    }
    setSessionId(visitorId);
  }, []);

  // REMOVE THIS useEffect for authHeaders - no longer needed for runAgentStream
  // useEffect(() => {
  //   let active = true;
  //   async function loadHeaders() {
  //     if (!isSupabaseConfigured) return;
  //     const { data } = await supabase.auth.getSession();
  //     if (!active) return;
  //     const accessToken = data?.session?.access_token;
  //     const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  //
  //     const headers: Record<string, string> = {
  //       "Content-Type": "application/json",
  //     };
  //
  //     if (accessToken) {
  //       headers.Authorization = `Bearer ${accessToken}`;
  //     } else if (anonKey) {
  //       headers.apikey = anonKey;
  //     }
  //
  //     setAuthHeaders(headers);
  //   }
  //
  //   void loadHeaders();
  //   return () => {
  //     active = false;
  //   };
  // }, []);


  // Reimplement handleInputChange
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);

  // Reimplement stop (if possible, or just set isLoading to false)
  const stop = useCallback(() => {
    // If runAgentStream supported AbortController, we'd call abortControllerRef.current.abort();
    setIsLoading(false);
    abortControllerRef.current?.abort(); // Attempt to abort if controller exists
  }, []);

  // Reimplement handleSubmit logic
  const handleFormSubmit = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault(); // Prevent default form submission

    const trimmedInput = input.trim();
    if (!trimmedInput || !agentId || !sessionId || isLoading) {
      return;
    }

    setIsLoading(true);
    setChatError(null); // Clear previous errors

    const userMessage: Msg = { role: 'user', content: trimmedInput };
    setMessages((prevMessages) => [...prevMessages, userMessage]); // Add user message

    const placeholderAssistantMessage: Msg = { role: 'assistant', content: '' };
    setMessages((prevMessages) => [...prevMessages, placeholderAssistantMessage]); // Add placeholder

    streamingAssistantMessageContentRef.current = ''; // Reset for new message
    setInput(''); // Clear input field

    const request: AgentRuntimeRequest = {
      agent_id: agentId,
      message: trimmedInput,
      session_id: sessionId,
      mode: "live", // Assuming "live" mode for public chat
    };

    // Create a new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Modify runAgentStream to accept AbortSignal if needed
      // For now, assuming it doesn't take AbortSignal and will just complete
      await runAgentStream(request, (event) => {
        if (event.type === "token" && event.content) {
          streamingAssistantMessageContentRef.current += event.content;
          setMessages((prevMessages) => {
            const newMessages = [...prevMessages];
            newMessages[newMessages.length - 1] = {
              ...newMessages[newMessages.length - 1],
              content: streamingAssistantMessageContentRef.current,
            };
            return newMessages;
          });
        } else if (event.type === "error" && event.content) {
          console.error("Error from agent runtime:", event.content);
          setChatError(`Agent Error: ${event.content}`);
          setMessages((prevMessages) => {
            const newMessages = [...prevMessages];
            newMessages[newMessages.length - 1] = {
              ...newMessages[newMessages.length - 1],
              content: `Error: ${event.content}`, // Display error in chat
            };
            return newMessages;
          });
        }
        // 'done' event implicitly handled when stream ends
      });
    } catch (e: any) {
      // This catch block will only execute if runAgentStream throws,
      // which it's designed not to do (NEVER throw unhandled errors).
      // However, network issues could still manifest here for the wrapper.
      console.error("Unhandled error calling runAgentStream:", e);
      setChatError(`Communication Error: ${e.message || "Unknown error"}`);
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        newMessages[newMessages.length - 1] = {
          ...newMessages[newMessages.length - 1],
          content: `Error contacting agent: ${e.message || "Please try again."}`,
        };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null; // Clear controller
    }
  }, [agentId, sessionId, input, isLoading]);


  const avatarLetter = useMemo(() => agentName.charAt(0).toUpperCase(), [agentName]);

  return (
    <div
      className={`bg-background text-foreground flex flex-col ${
        isEmbed ? "h-full w-full" : "h-screen w-screen"
      }`}
    >
      {!isEmbed && (
        <header className="flex items-center gap-3 px-4 py-3 border-b">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center">
            {avatarLetter}
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{agentName}</p>
            <p className="text-xs text-muted-foreground">Powered by Tamm</p>
          </div>
        </header>
      )}

      <main
        className={`flex-1 overflow-y-auto bg-muted/30 space-y-3 ${
          isEmbed ? "p-3" : "p-4"
        }`}
      >
        {isVerifyingChannel ? (
          <div className="text-sm text-muted-foreground">Verifying channel...</div>
        ) : !isChannelActive ? (
          <div className="text-sm text-center text-muted-foreground p-4">
            This chat is currently unavailable.
          </div>
        ) : messages.length === 0 && !isLoading ? (
          <div className="text-sm text-muted-foreground">
            Ask a question to start the conversation.
          </div>
        ) : (
          messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-white shadow-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {chatError ? <p className="text-xs text-destructive">{chatError}</p> : null}
      </main>

      <footer className={`border-t bg-background ${isEmbed ? "p-2" : "p-3"}`}>
        <form className="flex gap-2" onSubmit={handleFormSubmit}>
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            disabled={!agentId || !sessionId || isLoading || !isChannelActive || isVerifyingChannel}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleFormSubmit();
              }
            }}
          />
          {isLoading ? (
            <Button type="button" variant="secondary" onClick={stop}>
              Stop
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!agentId || !sessionId || isLoading || !input.trim() || !isChannelActive || isVerifyingChannel}
            >
              Send
            </Button>
          )}
        </form>
      </footer>
    </div>
  );
}
