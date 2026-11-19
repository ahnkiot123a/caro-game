'use client';

import { useCallback, useEffect, useState } from 'react';
import { getStoredNickname, storeNickname } from '@/lib/identity';
import { sanitizeName } from '@/utils/validation';

/** Nickname persisted in localStorage. `ready` is false until read on the client. */
export function useNickname() {
  const [nickname, setNicknameState] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setNicknameState(getStoredNickname());
    setReady(true);
  }, []);

  const setNickname = useCallback((value: string) => {
    const clean = sanitizeName(value);
    storeNickname(clean);
    setNicknameState(clean);
    return clean;
  }, []);

  return { nickname, setNickname, ready };
}
