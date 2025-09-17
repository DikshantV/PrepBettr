"use client";
import React from "react";
import { cn } from "@/lib/utils";
import createGlobe from "cobe";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { IconBrandYoutubeFilled } from "@tabler/icons-react";
import TimelineCompact from "./TimelineCompact";


export function FeaturesSectionDemo() {
  const features = [
    {
      title: "Hack job hunting",
      description:
        "Manage your entire application pipeline with a single click.",
      skeleton: <SkeletonOne />,
      className:
        "col-span-1 lg:col-span-4 border-b lg:border-r dark:border-neutral-800",
    },
    {
      title: "Mock interviews",
      description:
        "Practice with AI-generated questions tailored to your target role and get instant feedback.",
      skeleton: <SkeletonTwo />,
      className: "border-b col-span-1 lg:col-span-2 dark:border-neutral-800",
    },
    {
      title: "Watch our AI on YouTube",
      description:
        "Learn how to land your next role in just 30* days",
      skeleton: <SkeletonThree />,
      className:
        "col-span-1 lg:col-span-3 lg:border-r  dark:border-neutral-800",
    },
    {
      title: "Used by Learners Everywhere",
      description:
        "Join thousands of users who trust PrepBettr to advance their careers.",
      skeleton: <SkeletonFour />,
      className: "col-span-1 lg:col-span-3 border-b lg:border-none",
    },
  ];
  return (
    <div className="relative z-20 py-10 lg:py-40 max-w-7xl mx-auto bg-black">
      <div className="px-8">
        <h4 className="text-3xl lg:text-5xl lg:leading-tight max-w-5xl mx-auto text-center tracking-tight font-medium text-black dark:text-white">
          Packed with everything you need
        </h4>

        <p className="text-sm lg:text-base  max-w-2xl  my-4 mx-auto text-neutral-500 text-center font-normal dark:text-neutral-300">
          From ATS Resume Optimizer, Cover Letter Generator, Auto-Apply and Smart Tracker, 
          Everything you need to master your job application process
        </p>
      </div>

      <div className="relative ">
        <div className="grid grid-cols-1 lg:grid-cols-6 mt-12 xl:border rounded-md dark:border-neutral-800">
          {features.map((feature) => (
            <FeatureCard key={feature.title} className={feature.className}>
              <FeatureTitle>{feature.title}</FeatureTitle>
              <FeatureDescription>{feature.description}</FeatureDescription>
              <div className=" h-full w-full">{feature.skeleton}</div>
            </FeatureCard>
          ))}
        </div>
      </div>
    </div>
  );
}

const FeatureCard = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn(`p-4 sm:p-8 relative overflow-hidden`, className)}>
      {children}
    </div>
  );
};

const FeatureTitle = ({ children }: { children?: React.ReactNode }) => {
  return (
    <p className=" max-w-5xl mx-auto text-left tracking-tight text-black dark:text-white text-xl md:text-2xl md:leading-snug">
      {children}
    </p>
  );
};

const FeatureDescription = ({ children }: { children?: React.ReactNode }) => {
  return (
    <p
      className={cn(
        "text-sm md:text-base  max-w-4xl text-left mx-auto",
        "text-neutral-500 text-center font-normal dark:text-neutral-300",
        "text-left max-w-sm mx-0 md:text-sm my-2"
      )}
    >
      {children}
    </p>
  );
};

export const SkeletonOne = () => {
  return (
    <div className="relative flex py-8 px-2 gap-10 h-full">
      <div className="w-full  p-5  mx-auto bg-transparent shadow-2xl group h-full">
        <div className="flex flex-1 w-full h-full flex-col space-y-2  ">
          {/* TODO */}
          <img
            src="/ProductMockup2.png"
            alt="header"
            width={800}
            height={800}
            className="h-full w-full aspect-square object-cover object-left-top rounded-sm"
          />
        </div>
      </div>

      <div className="absolute bottom-0 z-40 inset-x-0 h-60 bg-gradient-to-t from-white dark:from-black via-white dark:via-black to-transparent w-full pointer-events-none" />
      <div className="absolute top-0 z-40 inset-x-0 h-60 bg-gradient-to-b from-white dark:from-black via-transparent to-transparent w-full pointer-events-none" />
    </div>
  );
};

export const SkeletonThree = () => {
  return (
    <a
      href="https://www.youtube.com/watch?v=RPa3_AD1_Vs"
      target="__blank"
      className="relative flex gap-10  h-full group/image"
    >
      <div className="w-full  mx-auto bg-transparent dark:bg-transparent group h-full">
        <div className="flex flex-1 w-full h-full flex-col space-y-2  relative">
          {/* TODO */}
          <IconBrandYoutubeFilled className="h-20 w-20 absolute z-10 inset-0 text-red-500 m-auto " />
          <img
            src="/YTThumbnail.png"
            alt="YouTube video thumbnail"
            width={800}
            height={800}
            className="h-full w-full aspect-square object-cover object-center rounded-sm blur-none group-hover/image:blur-md transition-all duration-200"
          />
        </div>
      </div>
    </a>
  );
};

export const SkeletonTwo = () => {
  return (
    <div className="relative flex flex-col items-center justify-center h-full w-full">
      <TimelineCompact />
    </div>
  );
};

export const SkeletonFour = () => {
  return (
    <div className="h-60 md:h-60  flex flex-col items-center justify-center relative bg-transparent dark:bg-transparent mt-10">
      <Globe className="absolute left-1/2 transform -translate-x-1/2 translate-y-32" />
    </div>
  );
};

export const Globe = ({ className }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let phi = 0;

    if (!canvasRef.current) return;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 600 * 2,
      height: 600 * 2,
      phi: 0,
      theta: 0,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.3, 0.3, 0.3],
      markerColor: [0.1, 0.8, 1],
      glowColor: [1, 1, 1],
      markers: [
        // longitude latitude
        { location: [37.7595, -122.4367], size: 0.03 }, // San Francisco
        { location: [40.7128, -74.006], size: 0.1 }, // New York
        { location: [51.5074, -0.1278], size: 0.08 }, // London
        { location: [48.8566, 2.3522], size: 0.06 }, // Paris
        { location: [35.6762, 139.6503], size: 0.09 }, // Tokyo
        { location: [55.7558, 37.6176], size: 0.05 }, // Moscow
        { location: [-33.8688, 151.2093], size: 0.07 }, // Sydney
        { location: [19.4326, -99.1332], size: 0.04 }, // Mexico City
        { location: [-23.5505, -46.6333], size: 0.06 }, // São Paulo
        { location: [28.6139, 77.209], size: 0.08 }, // New Delhi
        { location: [39.9042, 116.4074], size: 0.07 }, // Beijing
        { location: [1.3521, 103.8198], size: 0.05 }, // Singapore
        { location: [25.2048, 55.2708], size: 0.04 }, // Dubai
        { location: [-26.2041, 28.0473], size: 0.06 }, // Johannesburg
        { location: [52.3676, 4.9041], size: 0.05 }, // Amsterdam
        { location: [59.9311, 10.7583], size: 0.04 }, // Oslo
        { location: [41.9028, 12.4964], size: 0.05 }, // Rome
        { location: [50.1109, 8.6821], size: 0.04 }, // Frankfurt
        { location: [43.6532, -79.3832], size: 0.06 }, // Toronto
        { location: [49.2827, -123.1207], size: 0.05 }, // Vancouver
        { location: [-34.6037, -58.3816], size: 0.07 }, // Buenos Aires
        { location: [30.0444, 31.2357], size: 0.05 }, // Cairo
        { location: [13.7563, 100.5018], size: 0.06 }, // Bangkok
        { location: [60.1699, 24.9384], size: 0.04 }, // Helsinki
        { location: [-1.2921, 36.8219], size: 0.05 }, // Nairobi
      ],
      onRender: (state) => {
        // Called on every animation frame.
        // `state` will be an empty object, return updated params.
        state.phi = phi;
        phi += 0.01;
      },
    });

    return () => {
      globe.destroy();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: 600, height: 600, maxWidth: "100%", aspectRatio: 1 }}
      className={className}
    />
  );
};

// Export alias for backward compatibility
export const BentoGridFeatures = FeaturesSectionDemo;
