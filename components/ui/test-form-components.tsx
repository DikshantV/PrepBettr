"use client";

import { Button } from "./button";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Label } from "./label";

/**
 * Test component to verify input field and button styling matches dark theme requirements:
 * 1. Uses bg-gray-800, text-white, placeholder-gray-400, and hover/focus rings in brand color
 * 2. Ensures disabled/validation states meet accessibility contrast ratios
 */
export function TestFormComponents() {
  return (
    <div className="p-8 bg-gray-900 min-h-screen space-y-8">
      <div className="max-w-md space-y-6">
        <h2 className="text-2xl font-bold text-white">Dark Theme Form Components Test</h2>
        
        {/* Normal Input States */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Input States</h3>
          
          <div className="space-y-2">
            <Label htmlFor="test-input" className="text-white">Normal Input</Label>
            <Input id="test-input" placeholder="Type here..." />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="disabled-input" className="text-white">Disabled Input</Label>
            <Input id="disabled-input" placeholder="Disabled input" disabled />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="error-input" className="text-white">Error Input</Label>
            <Input id="error-input" placeholder="Error state" aria-invalid="true" />
          </div>
        </div>
        
        {/* Textarea States */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Textarea States</h3>
          
          <div className="space-y-2">
            <Label htmlFor="test-textarea" className="text-white">Normal Textarea</Label>
            <Textarea id="test-textarea" placeholder="Type your message..." />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="disabled-textarea" className="text-white">Disabled Textarea</Label>
            <Textarea id="disabled-textarea" placeholder="Disabled textarea" disabled />
          </div>
        </div>
        
        {/* Button States */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Button Variants</h3>
          
          <div className="flex flex-wrap gap-3">
            <Button variant="default">Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button variant="default" disabled>Disabled Default</Button>
            <Button variant="secondary" disabled>Disabled Secondary</Button>
            <Button variant="outline" disabled>Disabled Outline</Button>
          </div>
        </div>
        
        {/* Form Example */}
        <div className="space-y-4 border border-gray-700 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-white">Complete Form Example</h3>
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email</Label>
              <Input id="email" type="email" placeholder="your@email.com" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="message" className="text-white">Message</Label>
              <Textarea id="message" placeholder="Your message here..." />
            </div>
            
            <div className="flex gap-3">
              <Button type="submit">Submit</Button>
              <Button type="button" variant="outline">Cancel</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
