'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { MAX_NAME_LENGTH } from '@/lib/constants';
import { sanitizeName } from '@/utils/validation';

interface NicknameGateProps {
  roomId: string;
  onSubmit: (name: string) => void;
}

/** Shown when someone opens an invite link before choosing a nickname. */
export function NicknameGate({ roomId, onSubmit }: NicknameGateProps) {
  const [name, setName] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = sanitizeName(name);
    if (clean) onSubmit(clean);
  };

  return (
    <Card className="mx-auto w-full max-w-md p-6">
      <h1 className="text-xl font-bold text-white">Join room {roomId}</h1>
      <p className="mt-1 text-sm text-slate-400">Pick a nickname to enter the room.</p>
      <form onSubmit={submit} className="mt-5 flex gap-2">
        <Input
          autoFocus
          placeholder="Your nickname"
          maxLength={MAX_NAME_LENGTH}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" size="lg" disabled={!sanitizeName(name)}>
          Enter
        </Button>
      </form>
    </Card>
  );
}
