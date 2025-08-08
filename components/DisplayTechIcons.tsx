"use client";

import { techIconMap, TechIconName } from './tech-icons';

interface Props { 
  name: TechIconName; 
  size?: number; 
}

export default function DisplayTechIcons({ name, size = 24 }: Props) {
  const Icon = techIconMap[name];
  return Icon ? <Icon size={size} /> : null;
}
