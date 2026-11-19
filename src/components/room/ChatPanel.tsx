'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { MAX_CHAT_LENGTH } from '@/lib/constants';
import { socketService } from '@/services/socketService';
import { useGameStore } from '@/store/gameStore';
import { cn, formatTime } from '@/utils/format';

interface ChatPanelProps {
  roomId: string;
  playerId: string;
  className?: string;
}

export function ChatPanel({ roomId, playerId, className }: ChatPanelProps) {
  const messages = useGameStore((s) => s.chat);
  const pushToast = useGameStore((s) => s.pushToast);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    const result = await socketService.sendChat(roomId, content);
    setSending(false);
    if (result.ok) setDraft('');
    else pushToast(result.error ?? 'Message not sent.', 'error');
  };

  return (
    <Card className={cn('flex min-h-0 flex-col', className)}>
      <CardHeader>
        <CardTitle>Chat</CardTitle>
        <span className="text-xs text-slate-500">
          {messages.filter((m) => m.type === 'user').length} msgs
        </span>
      </CardHeader>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">No messages yet. Say hi 👋</p>
        )}
        {messages.map((message) => {
          if (message.type === 'system') {
            return (
              <p key={message.id} className="animate-fade-in text-center text-xs text-slate-500">
                {message.content} · {formatTime(message.createdAt)}
              </p>
            );
          }
          const mine = message.playerId === playerId;
          return (
            <div
              key={message.id}
              className={cn('animate-fade-in flex flex-col', mine ? 'items-end' : 'items-start')}
            >
              <div className="mb-0.5 flex items-baseline gap-2 text-xs">
                <span className={cn('font-semibold', mine ? 'text-indigo-300' : 'text-slate-300')}>
                  {mine ? 'You' : message.playerName}
                </span>
                <time
                  className="text-slate-500"
                  dateTime={new Date(message.createdAt).toISOString()}
                >
                  {formatTime(message.createdAt)}
                </time>
              </div>
              <p
                className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap',
                  mine
                    ? 'rounded-br-sm bg-indigo-500/90 text-white'
                    : 'rounded-bl-sm bg-slate-800 text-slate-100',
                )}
              >
                {message.content}
              </p>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-slate-800 p-3">
        <Input
          aria-label="Chat message"
          placeholder="Type a message…"
          value={draft}
          maxLength={MAX_CHAT_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          className="h-10"
        />
        <Button type="submit" disabled={!draft.trim()} loading={sending}>
          Send
        </Button>
      </form>
    </Card>
  );
}
