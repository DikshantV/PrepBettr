'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spotlight } from '@/components/ui/spotlight';
import BanterLoader from '@/components/ui/BanterLoader';
import { TestimonialsSection } from '@/components/ui/testimonials-section';
import { FeaturesSection } from '@/components/ui/features-section';
import { BentoGridFeatures } from '@/components/ui/bento-grid-features';
// Dynamic import for MacbookScroll component that requires DOM and scroll APIs
const MacbookScroll = dynamic(() => import('@/components/ui/macbook-scroll').then(mod => ({ default: mod.MacbookScroll })), {
  ssr: false,
  loading: () => (
    <div className="relative w-full overflow-visible" style={{ minHeight: '500px' }}>
      <div className="flex items-center justify-center h-80">
        <BanterLoader />
      </div>
    </div>
  )
});
// Dynamic import for BrandSlide component that requires framer-motion
const BrandSlide = dynamic(() => import('@/components/BrandSlide'), {
  ssr: false,
  loading: () => (
    <div className="py-12 bg-black">
      <div className="flex items-center justify-center">
        <BanterLoader />
      </div>
    </div>
  )
});
import FAQSection from '@/components/FAQsection';
import Image from 'next/image';

const SiteNavigation = dynamic(
  () => import('@/components/SiteNavigation').then((mod) => mod.SiteNavigation),
  { ssr: false }
);

export default function HomePage() {
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [isSignUpLoading, setIsSignUpLoading] = useState(false);
  const router = useRouter();

  const handleDashboardClick = () => {
    setIsDashboardLoading(true);
    router.push('/dashboard');
  };

  const handleSignUpClick = () => {
    setIsSignUpLoading(true);
    router.push('/sign-up');
  };

  // Clean up loader state on component unmount
  useEffect(() => {
    return () => {
      setIsDashboardLoading(false);
      setIsSignUpLoading(false);
    };
  }, []);

  return (
    <main className="min-h-screen bg-white dark:bg-black font-mona-sans relative">
      <Spotlight />
      <SiteNavigation onDashboardClick={handleDashboardClick} />
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-32 pb-32 md:pt-48 md:pb-48">
          <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-black">
            <div className="absolute inset-0 bg-[radial-gradient(circle_600px_at_50%_300px,#C9EBFF,transparent_70%)] dark:bg-[radial-gradient(circle_600px_at_50%_300px,#1a1a2e,transparent_70%)]"></div>
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent dark:from-black"></div>
          </div>
          <div className="container mx-auto px-8">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-3xl lg:text-5xl lg:leading-tight max-w-5xl mx-auto text-center tracking-tight font-bold text-black dark:text-white mb-12 pt-8">
                Ace Your Next Interview with AI
              </h1>
              <p className="text-xl md:text-2xl text-neutral-600 dark:text-neutral-300 mb-10 max-w-3xl mx-auto">
                Practice with our AI-powered interview simulator and land your dream job.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button 
                  onClick={handleSignUpClick}
                  className="relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50"
                >
                  <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                  <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-8 py-3 text-sm font-medium text-white backdrop-blur-3xl">
                    Get Started for Free
                  </span>
                </button>
                <Link 
                  href="#features" 
                  className="inline-flex h-12 items-center justify-center rounded-full border-2 border-neutral-300 bg-transparent px-8 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <FeaturesSection />

        {/* Brand Logos Section */}
        <section className="w-full bg-black py-12">
          <div className="container mx-auto px-4 text-center">
            <h3 className="text-xl font-medium mb-8 whitespace-nowrap text-white">
              300,000+ offers from the most exciting companies and organizations
            </h3>
            <BrandSlide />
          </div>
        </section>

        {/* Macbook Scroll Demo */}
        <div className="relative z-0 py-12">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl lg:text-5xl lg:leading-tight max-w-5xl mx-auto text-center tracking-tight font-medium text-black dark:text-white mb-12">
              Experience the Future of Interview Prep
            </h2>
            <p className="text-xl text-center text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto">
              Our AI-powered platform provides real-time feedback and personalized coaching to help you ace your next interview.
            </p>
            <div className="relative w-full overflow-visible" style={{ minHeight: '500px' }}>
            <MacbookScroll 
              src="/ProductMockup1.png" 
              showGradient={false}
            />
            </div>
          </div>
        </div>

        {/* Bento Grid Features Section */}
        <BentoGridFeatures />

        {/* Testimonials Section */}
        <div className="relative z-10">
          <TestimonialsSection />
        </div>

        {/* FAQ Section */}
        <div className="relative z-0 pt-4 pb-12 bg-white dark:bg-black">
          <FAQSection />
        </div>

        {/* Pricing Section */}
        <section id="pricing" className="relative isolate bg-white px-6 py-18 sm:py-18 lg:px-8 dark:bg-black">
          <div className="absolute inset-x-0 -top-3 -z-10 transform-gpu overflow-hidden px-36 blur-3xl" aria-hidden="true">
            <div className="mx-auto aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30" style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}></div>
          </div>
          <div className="mx-auto max-w-4xl text-center">
            <p className="mt-2 text-5xl font-semibold tracking-tight text-balance text-gray-900 dark:text-white sm:text-6xl">Choose the right plan for you</p>
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-lg font-medium text-pretty text-gray-600 dark:text-gray-300 sm:text-xl/8">From casual prep to competitive interviews, we&apos;ve got you covered. Choose the plan that fits your goals and start leveling up today.</p>
          <div className="mx-auto mt-16 grid max-w-lg grid-cols-1 items-center gap-y-6 sm:mt-20 sm:gap-y-0 lg:max-w-4xl lg:grid-cols-2">
            <div className="rounded-3xl rounded-t-3xl bg-white/60 p-8 ring-1 ring-gray-900/10 dark:bg-gray-900/50 dark:ring-white/10 sm:mx-8 sm:rounded-b-none sm:p-10 lg:mx-0 lg:rounded-tr-none lg:rounded-bl-3xl">
              <h3 id="tier-hobby" className="text-base/7 font-semibold text-indigo-600">Individual</h3>
              <p className="mt-4 flex items-baseline gap-x-2">
                <span className="text-5xl font-semibold tracking-tight text-gray-900 dark:text-white">$49</span>
                <span className="text-base text-gray-500 dark:text-gray-400">/month</span>
              </p>
              <p className="mt-6 text-base/7 text-gray-600 dark:text-gray-300">The perfect plan if you&apos;re getting started.</p>
              <ul role="list" className="mt-8 space-y-3 text-sm/6 text-gray-600 dark:text-gray-300 sm:mt-10">
                <li className="flex gap-x-3">
                  <svg className="h-6 w-5 flex-none text-indigo-600 dark:text-indigo-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" data-slot="icon">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  Unlimited voice interviews
                </li>
                <li className="flex gap-x-3">
                  <svg className="h-6 w-5 flex-none text-indigo-600 dark:text-indigo-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" data-slot="icon">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  Unlimited coding practice
                </li>
                <li className="flex gap-x-3">
                  <svg className="h-6 w-5 flex-none text-indigo-600 dark:text-indigo-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" data-slot="icon">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  Personalized interview paths
                </li>
                <li className="flex gap-x-3">
                  <svg className="h-6 w-5 flex-none text-indigo-600 dark:text-indigo-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" data-slot="icon">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  Analytics & weekly updates
                </li>
              </ul>
              <Link href="/sign-up" className="mt-8 block rounded-md px-3.5 py-2.5 text-center text-sm font-semibold text-indigo-600 ring-1 ring-indigo-200 ring-inset hover:ring-indigo-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:mt-10 dark:text-indigo-400 dark:ring-indigo-700 dark:hover:ring-indigo-600">Get started today</Link>
            </div>
            <div className="relative rounded-3xl bg-gray-900 p-8 shadow-2xl ring-1 ring-gray-900/10 dark:bg-gray-800 sm:p-10">
              <h3 id="tier-enterprise" className="text-base/7 font-semibold text-indigo-400">Enterprise</h3>
              <p className="mt-4 flex items-baseline gap-x-2">
                <span className="text-5xl font-semibold tracking-tight text-white">$199</span>
                <span className="text-base text-gray-400">/month</span>
              </p>
              <p className="mt-6 text-base/7 text-gray-300">Dedicated support and infrastructure for your company.</p>
              <ul role="list" className="mt-8 space-y-3 text-sm/6 text-gray-300 sm:mt-10">
                <li className="flex gap-x-3">
                  <svg className="h-6 w-5 flex-none text-indigo-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" data-slot="icon">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  Admin dashboard with cohort analytics
                </li>
                <li className="flex gap-x-3">
                  <svg className="h-6 w-5 flex-none text-indigo-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" data-slot="icon">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  Curriculum & LMS integrations
                </li>
                <li className="flex gap-x-3">
                  <svg className="h-6 w-5 flex-none text-indigo-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" data-slot="icon">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  Dedicated account manager
                </li>
                <li className="flex gap-x-3">
                  <svg className="h-6 w-5 flex-none text-indigo-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" data-slot="icon">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  API access for internal platforms
                </li>
                <li className="flex gap-x-3">
                  <svg className="h-6 w-5 flex-none text-indigo-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" data-slot="icon">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  Multi-language support (beta)
                </li>
                <li className="flex gap-x-3">
                  <svg className="h-6 w-5 flex-none text-indigo-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" data-slot="icon">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  Collaborative interview resources
                </li>
              </ul>
              <Link href="/contact" aria-describedby="tier-enterprise" className="mt-8 block rounded-md bg-indigo-500 px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-xs hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 sm:mt-10">Contact Sales</Link>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-18">
          <div className="relative max-w-4xl mx-auto px-4 text-center">
            <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 mb-6">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Join 1,000+ satisfied users
            </div>
            <h2 className="text-3xl lg:text-5xl lg:leading-tight max-w-5xl mx-auto text-center tracking-tight font-medium text-black dark:text-white mb-6">
              Ready to ace your next interview?
            </h2>
            <p className="text-xl text-neutral-600 dark:text-neutral-300 mb-8 max-w-2xl mx-auto">
              Join thousands of candidates who improved their interview skills with PrepBettr.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={handleSignUpClick}
                className="relative inline-flex h-14 items-center justify-center overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50"
              >
                <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-8 py-3 text-base font-medium text-white backdrop-blur-3xl">
                  Start Practicing Now
                </span>
              </button>
              <Link 
                href="#features" 
                className="inline-flex h-14 items-center justify-center rounded-full border-2 border-neutral-300 bg-transparent px-8 py-3 text-base font-medium text-neutral-700 transition-colors hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Learn more
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative overflow-hidden py-16 border-t border-neutral-200 dark:border-neutral-800">
          <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]">
            <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:16px_16px]"></div>
          </div>
          <div className="container mx-auto px-4 relative">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
              <div className="space-y-4">
                <div className="flex flex-col space-y-2 items-start">
                  <Image 
                    src="/logo.svg" 
                    alt="Logo" 
                    width={32}
                    height={32}
                    className="h-8 w-auto"
                  />
                  <span className="text-xl font-bold text-gray-900 dark:text-white">PrepBettr</span>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                  The most advanced AI-powered interview preparation platform.
                </p>
                <div className="flex space-x-4">
                  <a 
                    href="https://twitter.com/prepbettr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                    aria-label="Twitter"
                  >
                    <span className="sr-only">Twitter</span>
                    <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                    </svg>
                  </a>
                  <a 
                    href="https://github.com/prepbettr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                    aria-label="GitHub"
                  >
                    <span className="sr-only">GitHub</span>
                    <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.699 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                  </a>
                  <a 
                    href="https://linkedin.com/company/prepbettr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                    aria-label="LinkedIn"
                  >
                    <span className="sr-only">LinkedIn</span>
                    <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                    </svg>
                  </a>
                </div>
              </div>
              
              {[
                {
                  title: 'Product',
                  links: [
                    { name: 'Features', href: '#features' },
                    { name: 'Pricing', href: '#pricing' },
                    { name: 'Testimonials', href: '#testimonials' },
                  ]
                },
                {
                  title: 'Company',
                  links: [
                    { name: 'About Us', href: '/marketing/about' },
                    { name: 'Careers', href: '/marketing/careers' },
                    { name: 'Contact', href: 'mailto:contact@prepbettr.com' },
                  ]
                },
                {
                  title: 'Legal',
                  links: [
                    { name: 'Privacy Policy', href: '/marketing/privacy' },
                    { name: 'Terms of Service', href: '/marketing/terms' },
                    { name: 'Cookie Policy', href: '/marketing/cookies' },
                  ]
                }
              ].map((column, index) => (
                <div key={index}>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white tracking-wider uppercase">
                    {column.title}
                  </h3>
                  <ul className="mt-4 space-y-3">
                    {column.links.map((link, linkIndex) => (
                      <li key={linkIndex}>
                        <a 
                          href={link.href} 
                          className="text-base text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
                        >
                          {link.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            
            <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-800">
              <p className="text-sm text-center text-neutral-600 dark:text-neutral-400">
                &copy; {new Date().getFullYear()} PrepBettr. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
      
      {/* Loading Overlays */}
      {(isDashboardLoading || isSignUpLoading) && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <BanterLoader />
        </div>
      )}
    </main>
  );
}
