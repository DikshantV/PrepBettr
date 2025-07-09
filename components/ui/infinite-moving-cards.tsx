"use client";

import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

export const InfiniteMovingCards = ({
  items,
  direction = "left",
  speed = "slow",
  pauseOnHover = true,
  className,
}: {
  items: {
    quote: string;
    name: string;
    title: string;
  }[];
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow";
  pauseOnHover?: boolean;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [start, setStart] = useState(false);

  const getDirection = useCallback(() => {
    if (containerRef.current) {
      if (direction === "left") {
        containerRef.current.style.setProperty(
          "--animation-direction",
          "forwards"
        );
      } else {
        containerRef.current.style.setProperty(
          "--animation-direction",
          "reverse"
        );
      }
    }
  }, [direction]);

  const getSpeed = useCallback(() => {
    if (containerRef.current) {
      if (speed === "fast") {
        containerRef.current.style.setProperty("--animation-duration", "20s");
      } else if (speed === "normal") {
        containerRef.current.style.setProperty("--animation-duration", "40s");
      } else {
        containerRef.current.style.setProperty("--animation-duration", "80s");
      }
    }
  }, [speed]);

  const addAnimation = useCallback(() => {
    if (containerRef.current && scrollerRef.current) {
      const scrollerContent = Array.from(scrollerRef.current.children);

      scrollerContent.forEach((item) => {
        const duplicatedItem = item.cloneNode(true);
        if (scrollerRef.current) {
          scrollerRef.current.appendChild(duplicatedItem);
        }
      });

      getDirection();
      getSpeed();
      setStart(true);
    }
  }, [containerRef, scrollerRef, getDirection, getSpeed]);

  useEffect(() => {
    addAnimation();
  }, [addAnimation]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "scroller relative z-20 max-w-7xl overflow-hidden",
        className,
        start && "data-[animated=true]"
      )}
      data-direction={direction}
      data-speed={speed}
      data-animated="true"
    >
      <ul
        ref={scrollerRef}
        className={cn(
          "scroller__inner flex min-w-full shrink-0 gap-4 py-4 w-max flex-nowrap",
          pauseOnHover && "hover:[animation-play-state:paused]"
        )}
      >
        {items.map((item, idx) => (
          <li
            key={item.name + idx}
            className="w-[350px] max-w-full relative rounded-2xl border border-neutral-200 dark:border-neutral-800 px-8 py-6 md:w-[450px] bg-white dark:bg-black list-none"
            style={{ listStyle: 'none' }}
          >
            <div className="quote-container">
              <div
                aria-hidden="true"
                className="user-select-none -z-1 pointer-events-none absolute -left-0.5 -top-0.5 h-[calc(100%_+_4px)] w-[calc(100%_+_4px)]"
              ></div>
              <span className="relative z-20 text-sm leading-[1.6] text-neutral-700 dark:text-neutral-300 font-normal">
                {item.quote}
              </span>
              <div className="relative z-20 mt-6 flex flex-row items-center">
                <span className="flex flex-col gap-1">
                  <span className="text-sm leading-[1.6] text-neutral-900 dark:text-white font-normal">
                    {item.name}
                  </span>
                  <span className="text-sm leading-[1.6] text-neutral-500 dark:text-neutral-400 font-normal">
                    {item.title}
                  </span>
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Add the following CSS to your global CSS file or a CSS module
// .scroller {
//   --animation-duration: 40s;
//   --animation-direction: forwards;
// }


// .scroller[data-animated="true"] {
//   overflow: hidden;
//   -webkit-mask: linear-gradient(
//     90deg,
//     transparent,
//     white 20%,
//     white 80%,
//     transparent
//   );
//   mask: linear-gradient(90deg, transparent, white 20%, white 80%, transparent);
// }


// .scroller[data-animated="true"] .scroller__inner {
//   width: max-content;
//   flex-wrap: nowrap;
//   animation: scroll var(--animation-duration, 40s) var(--animation-direction, forwards) linear infinite;
// }

// @keyframes scroll {
//   to {
//     transform: translate(calc(-50% - 0.5rem));
//   }
// }
