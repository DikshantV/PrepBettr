'use client';

import { Home, MessageSquare, BarChart, DollarSign } from 'lucide-react';
import { FloatingNav } from '@/components/ui/floating-navbar';

export function SiteNavigation() {
  const navItems = [
    {
      name: 'Home',
      link: '/',
      icon: <Home className="h-5 w-5" />,
    },
    {
      name: 'Features',
      link: '#features',
      icon: <BarChart className="h-5 w-5" />,
    },
    {
      name: 'Testimonials',
      link: '#testimonials',
      icon: <MessageSquare className="h-5 w-5" />,
    },
    {
      name: 'Pricing',
      link: '#pricing',
      icon: <DollarSign className="h-5 w-5" />,
    }
  ];

  return <FloatingNav navItems={navItems} />;
}
