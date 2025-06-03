"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { cn, getTechLogos } from "@/lib/utils";

interface TechIconProps {
    techStack: string[];
}

interface TechIcon {
    tech: string;
    url: string;
}

const DisplayTechIcons = ({ techStack }: TechIconProps) => {
    const [techIcons, setTechIcons] = useState<TechIcon[]>([]);

    useEffect(() => {
        const loadTechIcons = async () => {
            const icons = await getTechLogos(techStack);
            setTechIcons(icons);
        };
        
        loadTechIcons();
    }, [techStack]);

    if (techIcons.length === 0) {
        // Return a placeholder or loading state if needed
        return <div className="h-9 w-24"></div>;
    }

    return (
        <div className="flex flex-row">
            {techIcons.slice(0, 3).map(({ tech, url }, index) => (
                <div
                    key={tech}
                    className={cn(
                        "relative group bg-dark-300 rounded-full p-2 flex flex-center",
                        index >= 1 && "-ml-3"
                    )}
                >
                    <span className="tech-tooltip">{tech}</span>
                    <Image
                        src={url}
                        alt={tech}
                        width={100}
                        height={100}
                        className="size-5"
                        onError={(e) => {
                            // Fallback to a default icon if the image fails to load
                            const target = e.target as HTMLImageElement;
                            target.src = '/tech.svg';
                        }}
                    />
                </div>
            ))}
        </div>
    );
};

export default DisplayTechIcons;