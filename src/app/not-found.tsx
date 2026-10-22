import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
      <h2 className="text-4xl font-bold text-primary mb-4">404 - Página Não Encontrada</h2>
      <p className="text-muted-foreground mb-8">A página que você está procurando não existe ou foi movida.</p>
      <Button asChild>
        <Link href="/">Voltar para o Início</Link>
      </Button>
    </div>
  );
}
