import { ClientWorkspace } from '@/components/clientes/client-workspace';

interface ClientePageProps {
  params: Promise<{ id: string }>;
}

export default async function ClienteDetailPage({ params }: ClientePageProps) {
  const { id } = await params;

  return <ClientWorkspace clientId={id} />;
}
