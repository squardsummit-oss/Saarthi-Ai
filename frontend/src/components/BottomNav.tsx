'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, Map, MessageSquare } from 'lucide-react';

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/track', icon: FileText, label: 'Track' },
  { href: '/map', icon: Map, label: 'Map' },
  { href: '/feedback', icon: MessageSquare, label: 'Feedback' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={22} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
