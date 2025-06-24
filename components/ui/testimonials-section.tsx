"use client";

import { useEffect, useState } from 'react';
import { InfiniteMovingCards } from "./infinite-moving-cards";

export function TestimonialsSection() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <section id="testimonials" className="py-20 bg-white dark:bg-black">
        <div className="container mx-auto px-4">
          <div className="text-center py-12 px-4">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Don&apos;t just take our word for it
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Join thousands of candidates who aced their interviews
            </p>
          </div>
        </div>
      </section>
    );
  }
  const testimonials = [
    {
      quote:
        "PrepBettr completely transformed my interview preparation. The AI feedback was spot on and helped me land my dream job at Google!",
      name: "Sarah Johnson",
      title: "Software Engineer at Google",
    },
    {
      quote:
        "I was struggling with technical interviews, but after using PrepBettr for just two weeks, I aced 5 out of 6 interviews. Highly recommended!",
      name: "Michael Chen",
      title: "Full Stack Developer",
    },
    {
      quote:
        "The behavioral interview practice was a game-changer for me. The AI picked up on things I didn't even realize I was doing.",
      name: "Emily Rodriguez",
      title: "Product Manager",
    },
    {
      quote:
        "As someone who gets nervous during interviews, the realistic practice sessions helped build my confidence tremendously.",
      name: "David Kim",
      title: "Data Scientist",
    },
    {
      quote:
        "Worth every penny! The system design practice alone was worth the subscription cost.",
      name: "Alex Thompson",
      title: "Senior Software Engineer at Amazon",
    },
  ];
  return (
    <section id="testimonials" className="py-20 bg-white dark:bg-black">
      <div className="container mx-auto px-4 overflow-visible">
        <div className="text-center py-12 px-4">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Dont just take our word for it
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Join thousands of candidates who aced their interviews
          </p>
        </div>
        <div className="relative mt-8">
          <InfiniteMovingCards
            items={testimonials}
            direction="right"
            speed="normal"
            pauseOnHover={true}
            className="py-8"
          />
        </div>
      </div>
    </section>
  );
}
