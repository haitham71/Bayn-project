import { useEffect, useRef, useState } from 'react';
import { getProjectConversation, getMessages, openChatSocket } from '../services/chatService';

// Loads a project's team conversation + history and keeps it live over the chat
// WebSocket. Returns { messages, loading, error, send }.
export function useTeamChat(projectId) {
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const wsRef = useRef(null);
  const convIdRef = useRef(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    setError(false);

    getProjectConversation(projectId)
      .then(async (conv) => {
        if (!alive) return;
        convIdRef.current = conv.id;
        setMembers(conv.members || []);
        const history = await getMessages(conv.id).catch(() => []);
        if (!alive) return;
        setMessages(history || []);

        // Live updates — the backend broadcasts every message (including our own)
        // to all room members, so we render straight from the socket.
        const ws = openChatSocket((frame) => {
          if (frame?.event === 'new_message' && frame.data?.conversation_id === conv.id) {
            setMessages((prev) =>
              prev.some((m) => m.id === frame.data.id) ? prev : [...prev, frame.data],
            );
          }
        });
        wsRef.current = ws;
      })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      convIdRef.current = null;
    };
  }, [projectId]);

  // Sends a message over the socket. Returns false if the socket isn't ready.
  function send(content, mentionedUserIds = []) {
    const ws = wsRef.current;
    const conversationId = convIdRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !conversationId) return false;
    ws.send(
      JSON.stringify({
        conversation_id: conversationId,
        content,
        mentioned_user_ids: mentionedUserIds,
      }),
    );
    return true;
  }

  return { messages, members, loading, error, send };
}
