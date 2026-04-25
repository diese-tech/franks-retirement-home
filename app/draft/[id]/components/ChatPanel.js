'use client';

import { useState, useEffect, useRef } from 'react';
import { CHAT_TEAM_COLORS } from '@/lib/constants';

export default function ChatPanel({ chats, draftKey, draftId }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats]);

  const send = async () => {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    setMessage('');
    try {
      await fetch(`/api/drafts/${draftId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: draftKey, message: text }),
      });
      // SSE will push the new message within 1.5s
    } catch {}
    setSending(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="card flex flex-col h-64">
      <h3 className="font-display font-bold text-xs uppercase tracking-wider text-gray-500 mb-2 shrink-0">Draft Chat</h3>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 mb-2">
        {chats.length === 0
          ? <p className="text-xs text-gray-700 text-center py-4">No messages yet</p>
          : chats.map((msg) => (
            <div key={msg.id} className="flex items-start gap-2">
              <span className={`font-display font-bold text-[10px] uppercase shrink-0 pt-0.5 ${CHAT_TEAM_COLORS[msg.team] ?? 'text-gray-500'}`}>
                {msg.senderName}
              </span>
              <span className="text-xs text-gray-300 break-words min-w-0">{msg.message}</span>
            </div>
          ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 shrink-0">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Send a message… (Enter to send)"
          className="input-field flex-1 text-xs"
          maxLength={500}
        />
        <button onClick={send} disabled={sending || !message.trim()} className="btn-primary text-xs shrink-0 px-4">
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
