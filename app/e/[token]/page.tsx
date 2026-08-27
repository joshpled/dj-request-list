import GuestRequestApp from './GuestRequestApp';

export const dynamic = 'force-dynamic';

export default async function GuestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <GuestRequestApp token={token} />;
}

