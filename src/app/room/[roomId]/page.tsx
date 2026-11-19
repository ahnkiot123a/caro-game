import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RoomView } from '@/components/room/RoomView';
import { isValidRoomId, normalizeRoomId } from '@/utils/validation';

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

export async function generateMetadata({ params }: RoomPageProps): Promise<Metadata> {
  const { roomId } = await params;
  return { title: `Room ${normalizeRoomId(roomId)}` };
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId: raw } = await params;
  const roomId = normalizeRoomId(raw);
  if (!isValidRoomId(roomId)) notFound();

  return <RoomView key={roomId} roomId={roomId} />;
}
