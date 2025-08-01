import React from 'react';
import styled from 'styled-components';
import { cn } from '@/lib/utils';

interface BanterLoaderProps {
  /** Whether to show as an overlay with backdrop blur */
  overlay?: boolean;
  /** Text to display below the loader when in overlay mode */
  text?: string;
  /** Background opacity (0-100) when in overlay mode */
  backgroundOpacity?: number;
  /** Whether to show backdrop blur when in overlay mode */
  blur?: boolean;
  /** Custom CSS classes */
  className?: string;
  /** ARIA label for accessibility */
  ariaLabel?: string;
}

const Loader = ({
  overlay = false,
  text,
  backgroundOpacity = 80,
  blur = true,
  className,
  ariaLabel = 'Loading...'
}: BanterLoaderProps) => {
  const loaderContent = (
    <StyledWrapper className={className}>
      <div className="banter-loader">
        <div className="banter-loader__box" />
        <div className="banter-loader__box" />
        <div className="banter-loader__box" />
        <div className="banter-loader__box" />
        <div className="banter-loader__box" />
        <div className="banter-loader__box" />
        <div className="banter-loader__box" />
        <div className="banter-loader__box" />
        <div className="banter-loader__box" />
      </div>
      {overlay && text && (
        <p 
          className="text-white text-center mt-4 font-medium"
          aria-live="polite"
        >
          {text}
        </p>
      )}
    </StyledWrapper>
  );

  if (overlay) {
    return (
      <div 
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center flex-col",
          blur && "backdrop-blur-md",
          "transition-all duration-300"
        )}
        style={{
          backgroundColor: `rgba(0, 0, 0, ${backgroundOpacity / 100})`,
          backdropFilter: blur ? 'blur(8px)' : 'none',
          WebkitBackdropFilter: blur ? 'blur(8px)' : 'none'
        }}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div className="relative">
          {loaderContent}
        </div>
      </div>
    );
  }

  return (
    <div 
      role="status"
      aria-label={ariaLabel}
    >
      {loaderContent}
    </div>
  );
}

const StyledWrapper = styled.div`
  .banter-loader {
    position: relative;
    width: 72px;
    height: 72px;
    margin: 0 auto;
  }

  .banter-loader__box {
    float: left;
    position: relative;
    width: 20px;
    height: 20px;
    margin-right: 6px;
  }

  .banter-loader__box:before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: #fff;
  }

  .banter-loader__box:nth-child(3n) {
    margin-right: 0;
    margin-bottom: 6px;
  }

  .banter-loader__box:nth-child(1):before, .banter-loader__box:nth-child(4):before {
    margin-left: 26px;
  }

  .banter-loader__box:nth-child(3):before {
    margin-top: 52px;
  }

  .banter-loader__box:last-child {
    margin-bottom: 0;
  }

  @keyframes moveBox-1 {
    9.0909090909% {
      transform: translate(-26px, 0);
    }

    18.1818181818% {
      transform: translate(0px, 0);
    }

    27.2727272727% {
      transform: translate(0px, 0);
    }

    36.3636363636% {
      transform: translate(26px, 0);
    }

    45.4545454545% {
      transform: translate(26px, 26px);
    }

    54.5454545455% {
      transform: translate(26px, 26px);
    }

    63.6363636364% {
      transform: translate(26px, 26px);
    }

    72.7272727273% {
      transform: translate(26px, 0px);
    }

    81.8181818182% {
      transform: translate(0px, 0px);
    }

    90.9090909091% {
      transform: translate(-26px, 0px);
    }

    100% {
      transform: translate(0px, 0px);
    }
  }

  .banter-loader__box:nth-child(1) {
    animation: moveBox-1 4s infinite;
  }

  @keyframes moveBox-2 {
    9.0909090909% {
      transform: translate(0, 0);
    }

    18.1818181818% {
      transform: translate(26px, 0);
    }

    27.2727272727% {
      transform: translate(0px, 0);
    }

    36.3636363636% {
      transform: translate(26px, 0);
    }

    45.4545454545% {
      transform: translate(26px, 26px);
    }

    54.5454545455% {
      transform: translate(26px, 26px);
    }

    63.6363636364% {
      transform: translate(26px, 26px);
    }

    72.7272727273% {
      transform: translate(26px, 26px);
    }

    81.8181818182% {
      transform: translate(0px, 26px);
    }

    90.9090909091% {
      transform: translate(0px, 26px);
    }

    100% {
      transform: translate(0px, 0px);
    }
  }

  .banter-loader__box:nth-child(2) {
    animation: moveBox-2 4s infinite;
  }

  @keyframes moveBox-3 {
    9.0909090909% {
      transform: translate(-26px, 0);
    }

    18.1818181818% {
      transform: translate(-26px, 0);
    }

    27.2727272727% {
      transform: translate(0px, 0);
    }

    36.3636363636% {
      transform: translate(-26px, 0);
    }

    45.4545454545% {
      transform: translate(-26px, 0);
    }

    54.5454545455% {
      transform: translate(-26px, 0);
    }

    63.6363636364% {
      transform: translate(-26px, 0);
    }

    72.7272727273% {
      transform: translate(-26px, 0);
    }

    81.8181818182% {
      transform: translate(-26px, -26px);
    }

    90.9090909091% {
      transform: translate(0px, -26px);
    }

    100% {
      transform: translate(0px, 0px);
    }
  }

  .banter-loader__box:nth-child(3) {
    animation: moveBox-3 4s infinite;
  }

  @keyframes moveBox-4 {
    9.0909090909% {
      transform: translate(-26px, 0);
    }

    18.1818181818% {
      transform: translate(-26px, 0);
    }

    27.2727272727% {
      transform: translate(-26px, -26px);
    }

    36.3636363636% {
      transform: translate(0px, -26px);
    }

    45.4545454545% {
      transform: translate(0px, 0px);
    }

    54.5454545455% {
      transform: translate(0px, -26px);
    }

    63.6363636364% {
      transform: translate(0px, -26px);
    }

    72.7272727273% {
      transform: translate(0px, -26px);
    }

    81.8181818182% {
      transform: translate(-26px, -26px);
    }

    90.9090909091% {
      transform: translate(-26px, 0px);
    }

    100% {
      transform: translate(0px, 0px);
    }
  }

  .banter-loader__box:nth-child(4) {
    animation: moveBox-4 4s infinite;
  }

  @keyframes moveBox-5 {
    9.0909090909% {
      transform: translate(0, 0);
    }

    18.1818181818% {
      transform: translate(0, 0);
    }

    27.2727272727% {
      transform: translate(0, 0);
    }

    36.3636363636% {
      transform: translate(26px, 0);
    }

    45.4545454545% {
      transform: translate(26px, 0);
    }

    54.5454545455% {
      transform: translate(26px, 0);
    }

    63.6363636364% {
      transform: translate(26px, 0);
    }

    72.7272727273% {
      transform: translate(26px, 0);
    }

    81.8181818182% {
      transform: translate(26px, -26px);
    }

    90.9090909091% {
      transform: translate(0px, -26px);
    }

    100% {
      transform: translate(0px, 0px);
    }
  }

  .banter-loader__box:nth-child(5) {
    animation: moveBox-5 4s infinite;
  }

  @keyframes moveBox-6 {
    9.0909090909% {
      transform: translate(0, 0);
    }

    18.1818181818% {
      transform: translate(-26px, 0);
    }

    27.2727272727% {
      transform: translate(-26px, 0);
    }

    36.3636363636% {
      transform: translate(0px, 0);
    }

    45.4545454545% {
      transform: translate(0px, 0);
    }

    54.5454545455% {
      transform: translate(0px, 0);
    }

    63.6363636364% {
      transform: translate(0px, 0);
    }

    72.7272727273% {
      transform: translate(0px, 26px);
    }

    81.8181818182% {
      transform: translate(-26px, 26px);
    }

    90.9090909091% {
      transform: translate(-26px, 0px);
    }

    100% {
      transform: translate(0px, 0px);
    }
  }

  .banter-loader__box:nth-child(6) {
    animation: moveBox-6 4s infinite;
  }

  @keyframes moveBox-7 {
    9.0909090909% {
      transform: translate(26px, 0);
    }

    18.1818181818% {
      transform: translate(26px, 0);
    }

    27.2727272727% {
      transform: translate(26px, 0);
    }

    36.3636363636% {
      transform: translate(0px, 0);
    }

    45.4545454545% {
      transform: translate(0px, -26px);
    }

    54.5454545455% {
      transform: translate(26px, -26px);
    }

    63.6363636364% {
      transform: translate(0px, -26px);
    }

    72.7272727273% {
      transform: translate(0px, -26px);
    }

    81.8181818182% {
      transform: translate(0px, 0px);
    }

    90.9090909091% {
      transform: translate(26px, 0px);
    }

    100% {
      transform: translate(0px, 0px);
    }
  }

  .banter-loader__box:nth-child(7) {
    animation: moveBox-7 4s infinite;
  }

  @keyframes moveBox-8 {
    9.0909090909% {
      transform: translate(0, 0);
    }

    18.1818181818% {
      transform: translate(-26px, 0);
    }

    27.2727272727% {
      transform: translate(-26px, -26px);
    }

    36.3636363636% {
      transform: translate(0px, -26px);
    }

    45.4545454545% {
      transform: translate(0px, -26px);
    }

    54.5454545455% {
      transform: translate(0px, -26px);
    }

    63.6363636364% {
      transform: translate(0px, -26px);
    }

    72.7272727273% {
      transform: translate(0px, -26px);
    }

    81.8181818182% {
      transform: translate(26px, -26px);
    }

    90.9090909091% {
      transform: translate(26px, 0px);
    }

    100% {
      transform: translate(0px, 0px);
    }
  }

  .banter-loader__box:nth-child(8) {
    animation: moveBox-8 4s infinite;
  }

  @keyframes moveBox-9 {
    9.0909090909% {
      transform: translate(-26px, 0);
    }

    18.1818181818% {
      transform: translate(-26px, 0);
    }

    27.2727272727% {
      transform: translate(0px, 0);
    }

    36.3636363636% {
      transform: translate(-26px, 0);
    }

    45.4545454545% {
      transform: translate(0px, 0);
    }

    54.5454545455% {
      transform: translate(0px, 0);
    }

    63.6363636364% {
      transform: translate(-26px, 0);
    }

    72.7272727273% {
      transform: translate(-26px, 0);
    }

    81.8181818182% {
      transform: translate(-52px, 0);
    }

    90.9090909091% {
      transform: translate(-26px, 0);
    }

    100% {
      transform: translate(0px, 0);
    }
  }

  .banter-loader__box:nth-child(9) {
    animation: moveBox-9 4s infinite;
  }
`;

export default Loader;

