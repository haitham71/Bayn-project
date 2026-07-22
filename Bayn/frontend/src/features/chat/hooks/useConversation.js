import { useEffect, useRef, useState } from 'react';
import { getMessages, openChatSocket, markConversationRead } from '../services/chatService';

// Loads a conversation's history by id and keeps it live over the chat
// WebSocket. Generic — used for direct messages (the team chat has its own
// project-aware hook). Returns { messages, loading, send }.
export function useConversation(conversationId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return undefined;
    }
    let alive = true;
    setLoading(true);

    getMessages(conversationId)
      .catch(() => [])
      .then((history) => {
        if (!alive) return;
        setMessages(history || []);
        markConversationRead(conversationId).catch(() => {});
        const ws = openChatSocket((frame) => {
          if (frame?.event === 'new_message' && frame.data?.conversation_id === conversationId) {
            setMessages((prev) =>
              prev.some((m) => m.id === frame.data.id) ? prev : [...prev, frame.data],
            );
          }
        });
        wsRef.current = ws;
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [conversationId]);

  function send(content) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !conversationId) return false;
    ws.send(JSON.stringify({ conversation_id: conversationId, content, mentioned_user_ids: [] }));
    return true;
  }

  return { messages, loading, send };
}
