'use client';

import { useState, useEffect, useRef } from 'react';
import { CHAT_TEAM_COLORS } from '@/lib/constants';
import { BrutalButton } from '@/components/ui';

export default function ChatPanel({ chats, draftKey, draftId }) {
  const [open, setOpen] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const prevCountRef = useRef(chats.length);
  const messagesRef = useRef(null);

  // Track new messages when collapsed
  useEffect(() => {
    const incoming = chats.length - prevCountRef.current;
    if (incoming > 0 && !open) {
      setUnread((n) => n + incoming);
    }
    prevCountRef.current = chats.length;
  }, [chats.length, open]);

  // Scroll to bottom on open or new message when visible
  useEffect(() => {
    if (open && messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [chats, open]);

  const expand = () => { setOpen(true); setUnread(0); };

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
    } catch {}
    setSending(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Collapsed pill
  if (!open) {
    return (
      <button
        onClick={expand}
        className="flex items-center gap-2 px-4 py-2 border-2 border-brand-700 bg-brand-900 hover:border-frh-yellow/60 transition-colors font-ui text-xs uppercase tracking-wide text-gray-400 hover:text-frh-cream"
        aria-label="Open chat"
      >
        <span>Chat</span>
        {unread > 0 && (
          <span className="bg-frh-yellow text-black font-bold font-mono text-[10px] px-1.5 py-0.5 rounded-sm min-w-[18px] text-center">
            {unread}
          </span>
        )}
        <span className="text-gray-600 text-[10px]">▲</span>
      </button>
    );
  }

  return (
    <div className="border-2 border-brand-700">
      {/* Title bar with collapse button */}
      <div className="flex items-center justify-between px-3 py-2 bg-brand-900 border-b-2 border-brand-700">
        <span className="font-ui text-xs uppercase tracking-widest text-gray-400">AIM Event Log</span>
        <button
          onClick={() => setOpen(false)}
          className="font-ui text-[10px] uppercase tracking-wide text-gray-600 hover:text-frh-cream transition-colors px-2 py-0.5 border border-brand-600 hover:border-gray-400"
          aria-label="Collapse chat"
        >
          ▼ Collapse
        </button>
      </div>

      <div className="p-3 bg-brand-950/40">
        <div className="flex flex-col h-52">
          <div ref={messagesRef} className="flex-1 overflow-y-auto space-y-1.5 pr-1 mb-2 bg-brand-950/60 border border-brand-700 p-2 font-mono">
            {chats.length === 0
              ? <p className="text-xs text-gray-700 text-center py-4">No messages yet</p>
              : chats.map((msg) => (
                <div key={msg.id} className="flex items-start gap-2">
                  <span className={`font-mono font-bold text-[10px] uppercase shrink-0 pt-0.5 ${CHAT_TEAM_COLORS[msg.team] ?? 'text-gray-500'}`}>
                    {msg.senderName}
                  </span>
                  <span className="text-xs text-gray-300 break-words min-w-0">&gt; {msg.message}</span>
                </div>
              ))}
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
            <BrutalButton onClick={send} disabled={sending || !message.trim()} size="sm" className="shrink-0 px-4">
              {sending ? '…' : 'Send'}
            </BrutalButton>
          </div>
        </div>
      </div>
    </div>
  );
}
