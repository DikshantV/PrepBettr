import dynamic from 'next/dynamic';

export const FloatingNav = dynamic(() => import('./floating-navbar').then(mod => ({ default: mod.FloatingNav })), {
  ssr: true,
  loading: () => (
    <div className="fixed left-1/2 top-6 z-50 w-full max-w-6xl -translate-x-1/2 transform px-4">
      <div className="mx-auto flex w-full items-center justify-between rounded-full px-6 py-3 bg-transparent border border-transparent">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
          <span className="text-xl font-bold text-black dark:text-white">
            PrepBettr
          </span>
        </div>
        
        {/* Placeholder for navigation items */}
        <div className="hidden md:flex items-center space-x-8">
          <div className="w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded opacity-50" />
          <div className="w-20 h-5 bg-gray-200 dark:bg-gray-700 rounded opacity-50" />
          <div className="w-24 h-5 bg-gray-200 dark:bg-gray-700 rounded opacity-50" />
        </div>
        
        {/* Sign In Button placeholder */}
        <div className="ml-auto">
          <div className="relative inline-flex h-10 items-center justify-center overflow-hidden rounded-full p-[1px]">
            <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-6 py-2 text-sm font-medium text-white backdrop-blur-3xl">
              Sign In
            </span>
          </div>
        </div>
      </div>
    </div>
  )
});
