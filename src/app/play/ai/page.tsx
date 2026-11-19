import type { Metadata } from 'next';
import { AiGameView } from '@/components/ai/AiGameView';

export const metadata: Metadata = { title: 'Play vs Computer' };

export default function PlayAiPage() {
  return <AiGameView />;
}
