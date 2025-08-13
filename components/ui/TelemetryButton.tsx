"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { useTelemetry } from '@/components/providers/TelemetryProvider';

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
};

interface TelemetryButtonProps extends ButtonProps {
  telemetryName: string;
  telemetryFeature?: string;
  telemetryProperties?: { [key: string]: string };
}

export function TelemetryButton({
  telemetryName,
  telemetryFeature = 'button',
  telemetryProperties = {},
  onClick,
  children,
  ...props
}: TelemetryButtonProps) {
  const { trackButtonClick } = useTelemetry();

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // Track the button click
    await trackButtonClick(telemetryName, {
      feature: telemetryFeature,
      ...telemetryProperties
    });

    // Call the original onClick handler if provided
    if (onClick) {
      onClick(event);
    }
  };

  return (
    <Button
      {...props}
      onClick={handleClick}
      data-telemetry-name={telemetryName}
    >
      {children}
    </Button>
  );
}

export default TelemetryButton;
