"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Direction = "TOP" | "LEFT" | "BOTTOM" | "RIGHT";

const movingMap: Record<Direction, string> = {
  TOP: "radial-gradient(20.7% 50% at 50% 0%, hsl(271, 91%, 65%) 0%, rgba(124, 58, 237, 0) 100%)",
  LEFT: "radial-gradient(16.6% 43.1% at 0% 50%, hsl(271, 91%, 65%) 0%, rgba(124, 58, 237, 0) 100%)",
  BOTTOM:
    "radial-gradient(20.7% 50% at 50% 100%, hsl(271, 91%, 65%) 0%, rgba(124, 58, 237, 0) 100%)",
  RIGHT:
    "radial-gradient(16.2% 41.2% at 100% 50%, hsl(271, 91%, 65%) 0%, rgba(124, 58, 237, 0) 100%)",
};

const highlight =
  "radial-gradient(75% 181.2% at 50% 50%, #7c3aed 0%, rgba(124, 58, 237, 0) 100%)";

export function HoverBorderGradient({
  children,
  containerClassName,
  className,
  as: Element = "button",
  duration = 1,
  clockwise = true,
  ...props
}: React.PropsWithChildren<
  {
    as?: React.ElementType;
    containerClassName?: string;
    className?: string;
    duration?: number;
    clockwise?: boolean;
  } & React.HTMLAttributes<HTMLElement>
>) {
  const [hovered, setHovered] = useState<boolean>(false);
  const [direction, setDirection] = useState<Direction>("BOTTOM");

  const rotateDirection = (currentDirection: Direction): Direction => {
    const directions: Direction[] = ["TOP", "LEFT", "BOTTOM", "RIGHT"];
    const currentIndex = directions.indexOf(currentDirection);
    const nextIndex = clockwise
      ? (currentIndex - 1 + directions.length) % directions.length
      : (currentIndex + 1) % directions.length;
    return directions[nextIndex];
  };

  useEffect(() => {
    if (!hovered) {
      const directions: Direction[] = ["TOP", "LEFT", "BOTTOM", "RIGHT"];
      const interval = setInterval(() => {
        setDirection((prev) => {
          const currentIndex = directions.indexOf(prev);
          const nextIndex = clockwise
            ? (currentIndex - 1 + directions.length) % directions.length
            : (currentIndex + 1) % directions.length;
          return directions[nextIndex];
        });
      }, duration * 1000);
      return () => clearInterval(interval);
    }
  }, [hovered, duration, clockwise]);

  return (
    <Element
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "relative flex h-min w-fit flex-col flex-nowrap content-center items-center justify-center gap-10 overflow-visible rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/80 box-decoration-clone p-px backdrop-blur-sm transition duration-500 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80",
        containerClassName
      )}
      {...props}
    >
      <div
        className={cn(
          "z-10 w-auto rounded-[inherit] bg-white dark:bg-zinc-900 px-6 py-3 text-zinc-900 dark:text-white",
          className
        )}
      >
        {children}
      </div>
      <motion.div
        className={cn(
          "absolute inset-0 z-0 flex-none overflow-hidden rounded-[inherit]"
        )}
        style={{
          filter: "blur(2px)",
          position: "absolute",
          width: "100%",
          height: "100%",
        }}
        initial={{ background: movingMap[direction] }}
        animate={{
          background: hovered
            ? [movingMap[direction], highlight]
            : movingMap[direction],
        }}
        transition={{ ease: "linear", duration: duration ?? 1 }}
      />
      <div className="absolute inset-[1px] z-[1] flex-none rounded-[100px] bg-white dark:bg-zinc-900" />
    </Element>
  );
}
