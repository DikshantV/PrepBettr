'use client';

import { cn } from "@/lib/utils";
import { TextHoverEffect } from "./text-hover-effect";
import {
  IconAdjustmentsBolt,
  IconCloud,
  IconCurrencyDollar,
  IconEaseInOut,
  IconHeart,
  IconHelp,
  IconRouteAltLeft,
  IconTerminal2,
} from "@tabler/icons-react";

export function FeaturesSection() {
  const features = [
    {
      title: "AI-Powered Interviews",
      description: "Practice with our advanced AI that simulates real interview scenarios across various domains.",
      icon: <IconTerminal2 className="w-6 h-6" />,
    },
    {
      title: "Instant Feedback",
      description: "Get detailed analysis of your answers, including suggestions for improvement.",
      icon: <IconEaseInOut className="w-6 h-6" />,
    },
    {
      title: "Affordable Pricing",
      description: "High-quality interview preparation at a fraction of the cost of human coaches.",
      icon: <IconCurrencyDollar className="w-6 h-6" />,
    },
    {
      title: "Available 24/7",
      description: "Practice anytime, anywhere - our AI is always ready for your next session.",
      icon: <IconCloud className="w-6 h-6" />,
    },
    {
      title: "Multiple Domains",
      description: "Covering technical, behavioral, and system design interviews.",
      icon: <IconRouteAltLeft className="w-6 h-6" />,
    },
    {
      title: "Expert Support",
      description: "Our team is here to help you with any questions or issues.",
      icon: <IconHelp className="w-6 h-6" />,
    },
    {
      title: "Progress Tracking",
      description: "Monitor your improvement with detailed analytics and insights.",
      icon: <IconAdjustmentsBolt className="w-6 h-6" />,
    },
    {
      title: "And much more",
      description: "Join thousands of successful candidates who aced their interviews with us.",
      icon: <IconHeart className="w-6 h-6" />,
    },
  ];
  
  return (
    <section id="features" className="pt-6 pb-20 bg-white dark:bg-black">
      <div id="features" className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-16 px-2">
          <h2 className="text-2xl md:text-5xl font-bold mb-6 flex flex-wrap justify-center items-baseline gap-2">
            <span>Why Choose</span>
            <TextHoverEffect 
              text="PrepBettr" 
              className="text-transparent bg-gradient-to-b from-neutral-900 to-neutral-600 dark:from-neutral-100 dark:to-neutral-300 text-sm md:text-base relative top-0.5 scale-50 origin-left px-1"
            />
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-300">
            Everything you need to ace your next interview in one place
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 relative z-10">
          {features.map((feature, index) => (
            <Feature key={feature.title} {...feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

const Feature = ({
  title,
  description,
  icon,
  index,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
}) => {
  return (
    <div
      className={cn(
        "flex flex-col lg:border-r py-10 relative group/feature dark:border-neutral-800",
        (index === 0 || index === 4) && "lg:border-l dark:border-neutral-800",
        index < 4 && "lg:border-b dark:border-neutral-800"
      )}
    >
      {index < 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      {index >= 4 && (
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-b from-neutral-100 dark:from-neutral-800 to-transparent pointer-events-none" />
      )}
      <div className="mb-4 relative z-10 px-10 text-neutral-600 dark:text-neutral-400">
        {icon}
      </div>
      <div className="text-lg font-bold mb-2 relative z-10 px-10">
        <div className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full bg-neutral-300 dark:bg-neutral-700 group-hover/feature:bg-blue-500 transition-all duration-200 origin-center" />
        <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block text-neutral-800 dark:text-neutral-100">
          {title}
        </span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-300 max-w-xs relative z-10 px-10">
        {description}
      </p>
    </div>
  );
};
