"use client";

import Image from "next/image";
import { motion } from "framer-motion";

// Import all logos
const logos = [
  { src: "/brand_slide/logo_airbnb.svg", alt: "Airbnb" },
  { src: "/brand_slide/logo_amazon.svg", alt: "Amazon" },
  { src: "/brand_slide/logo_anthropic.svg", alt: "Anthropic" },
  { src: "/brand_slide/logo_canva.svg", alt: "Canva" },
  { src: "/brand_slide/logo_citi.svg", alt: "Citi" },
  { src: "/brand_slide/logo_fedex.svg", alt: "FedEx" },
  { src: "/brand_slide/logo_github.svg", alt: "GitHub" },
  { src: "/brand_slide/logo_google.svg", alt: "Google" },
  { src: "/brand_slide/logo_meta.svg", alt: "Meta" },
  { src: "/brand_slide/logo_microsoft.svg", alt: "Microsoft" },
  { src: "/brand_slide/logo_shopify.svg", alt: "Shopify" },
  { src: "/brand_slide/logo_steam.svg", alt: "Steam" },
  { src: "/brand_slide/logo_tesla.svg", alt: "Tesla" },
  { src: "/brand_slide/logo_twitch.svg", alt: "Twitch" },
  { src: "/brand_slide/logo_ups.svg", alt: "UPS" },
  { src: "/brand_slide/logo_redis.svg", alt: "Redis" },
  { src: "/brand_slide/logo_uber.svg", alt: "Uber" },
  { src: "/brand_slide/logo_walmart.svg", alt: "Walmart" },
];

const BrandSlide = () => {
  // Duplicate the logos array to create a seamless loop
  const duplicatedLogos = [...logos, ...logos, ...logos];

  return (
    <div className="py-12 bg-black">
      <div className="relative w-full overflow-hidden">
        <motion.div
          className="flex items-center"
          animate={{
            x: [0, -1000], // Adjust this value based on your logos' total width
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          {duplicatedLogos.map((logo, index) => (
            <div key={`${logo.alt}-${index}`} className="mx-12 flex-shrink-0">
              <Image
                src={logo.src}
                alt={logo.alt}
                width={120}
                height={48}
                className="h-12 w-auto object-contain"
                priority={index < 6}
              />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default BrandSlide;