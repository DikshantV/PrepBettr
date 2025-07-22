import { ReactNode } from 'react';

interface MarketingLayoutProps {
  children: ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    // Override the pattern background with a solid background for marketing pages
    <div className="min-h-screen bg-white dark:bg-black" style={{ backgroundImage: 'none' }}>
      {children}
    </div>
  );
}
