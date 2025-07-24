/**
 * Blue Dragon 70 Loader Demo Component
 * 
 * Quick demonstration of all loader variants and usage patterns
 * This file can be used for testing and showcasing the loader functionality
 */

"use client";

import React, { useState } from 'react';
import { Loader, LoaderOverlay, LoaderInline } from '@/components/ui/loader';
import { Button } from '@/components/ui/button';

export const LoaderDemo: React.FC = () => {
  const [showOverlay, setShowOverlay] = useState(false);
  const [buttonLoading, setButtonLoading] = useState(false);

  const handleButtonDemo = async () => {
    setButtonLoading(true);
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 3000));
    setButtonLoading(false);
  };

  const handleOverlayDemo = async () => {
    setShowOverlay(true);
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 4000));
    setShowOverlay(false);
  };

  return (
    <div className="p-8 bg-gray-900 min-h-screen text-white">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 text-blue-400">Blue Dragon 70 Loader Demo</h1>
          <p className="text-gray-300">Sophisticated animated loaders integrated from UIverse.io</p>
        </div>

        {/* Size Variants */}
        <section>
          <h2 className="text-2xl font-semibold mb-6 text-white">Size Variants</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 p-6 bg-gray-800 rounded-lg">
            <div className="text-center">
              <h3 className="text-sm font-medium mb-4 text-gray-300">Small</h3>
              <Loader size="sm" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-medium mb-4 text-gray-300">Medium</h3>
              <Loader size="md" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-medium mb-4 text-gray-300">Large</h3>
              <Loader size="lg" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-medium mb-4 text-gray-300">Extra Large</h3>
              <Loader size="xl" />
            </div>
          </div>
        </section>

        {/* Theme Variants */}
        <section>
          <h2 className="text-2xl font-semibold mb-6 text-white">Theme Variants</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-6 bg-gray-800 rounded-lg">
            <div className="text-center">
              <h3 className="text-sm font-medium mb-4 text-gray-300">Primary (Blue)</h3>
              <Loader size="lg" variant="primary" text="Loading data..." />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-medium mb-4 text-gray-300">Secondary (Purple)</h3>
              <Loader size="lg" variant="secondary" text="Processing..." />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-medium mb-4 text-gray-300">Accent (Emerald)</h3>
              <Loader size="lg" variant="accent" text="Saving changes..." />
            </div>
          </div>
        </section>

        {/* Interactive Demos */}
        <section>
          <h2 className="text-2xl font-semibold mb-6 text-white">Interactive Demos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Button Loading Demo */}
            <div className="p-6 bg-gray-800 rounded-lg">
              <h3 className="text-lg font-medium mb-4 text-gray-300">Button Loading State</h3>
              <Button 
                onClick={handleButtonDemo}
                disabled={buttonLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {buttonLoading && <LoaderInline size="sm" className="mr-2" />}
                {buttonLoading ? 'Processing...' : 'Start Demo'}
              </Button>
              <p className="text-xs text-gray-400 mt-2">
                Click to see inline loader in action
              </p>
            </div>

            {/* Overlay Loading Demo */}
            <div className="p-6 bg-gray-800 rounded-lg">
              <h3 className="text-lg font-medium mb-4 text-gray-300">Overlay Loading</h3>
              <Button 
                onClick={handleOverlayDemo}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                Show Overlay Demo
              </Button>
              <p className="text-xs text-gray-400 mt-2">
                Click to see full-screen overlay loader
              </p>
            </div>

          </div>
        </section>

        {/* Usage Examples */}
        <section>
          <h2 className="text-2xl font-semibold mb-6 text-white">Usage Examples</h2>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Code Examples */}
              <div>
                <h3 className="text-lg font-medium mb-4 text-gray-300">Code Examples</h3>
                <div className="space-y-4 text-sm">
                  <div className="bg-gray-900 p-3 rounded border border-gray-700">
                    <code className="text-green-400">
                      {'<Loader size="lg" text="Loading..." />'}
                    </code>
                  </div>
                  <div className="bg-gray-900 p-3 rounded border border-gray-700">
                    <code className="text-green-400">
                      {'<LoaderInline size="sm" variant="accent" />'}
                    </code>
                  </div>
                  <div className="bg-gray-900 p-3 rounded border border-gray-700">
                    <code className="text-green-400">
                      {'<LoaderOverlay text="Processing..." />'}
                    </code>
                  </div>
                </div>
              </div>

              {/* Live Examples */}
              <div>
                <h3 className="text-lg font-medium mb-4 text-gray-300">Live Examples</h3>
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-3 bg-gray-900 rounded border border-gray-700">
                    <LoaderInline size="sm" />
                    <span className="text-gray-300">Inline loader for buttons</span>
                  </div>
                  <div className="flex items-center justify-center p-6 bg-gray-900 rounded border border-gray-700">
                    <Loader size="md" variant="secondary" text="Centered loader" />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Features */}
        <section>
          <h2 className="text-2xl font-semibold mb-6 text-white">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              '🐉 Dragon-inspired orbital animations',
              '🎨 Three theme variants with gradient effects',
              '📱 Four responsive size options',
              '♿ Full accessibility support',
              '🌙 Dark/Light theme adaptation',
              '⚡ Hardware-accelerated CSS animations'
            ].map((feature, index) => (
              <div key={index} className="p-4 bg-gray-800 rounded-lg text-gray-300">
                {feature}
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* Overlay Demo */}
      {showOverlay && (
        <LoaderOverlay 
          text="Full-screen loading demo..."
          variant="primary"
          size="xl"
          backgroundOpacity={85}
          blur={true}
        />
      )}
    </div>
  );
};

export default LoaderDemo;
