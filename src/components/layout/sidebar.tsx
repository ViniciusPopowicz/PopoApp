'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, House, Users, Package, Syringe, ClipboardList, Calendar, Bell, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { label: 'Início', href: '/', icon: House },
  { label: 'Clientes', href: '/clientes', icon: Users },
  { label: 'Produtos', href: '/produtos', icon: Package },
  { label: 'Procedimentos', href: '/procedimentos', icon: Syringe },
  { label: 'Atendimentos', href: '/atendimentos', icon: ClipboardList },
  { label: 'Agenda', href: '/agenda', icon: Calendar },
  { label: 'Lembretes', href: '/lembretes', icon: Bell },
  { label: 'Financeiro', href: '/financeiro', icon: DollarSign },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black"
          />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            className="fixed inset-y-0 left-0 z-50 w-full max-w-sm md:w-[280px] bg-card border-r shadow-xl flex flex-col"
          >
            <div className="h-16 flex items-center justify-between px-4 border-b">
              <span className="font-semibold text-lg text-primary">PopoApp</span>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    tabIndex={0}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
