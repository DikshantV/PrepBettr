'use client';

import { useState, useRef } from 'react';
import { Clock, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BillingSection } from '@/components/billing/BillingSection';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

export default function SettingsPage() {
  const [reminderTime, setReminderTime] = useState('08:00');
  const timeInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // Clear any local storage or session data
      localStorage.clear();
      sessionStorage.clear();
      
      // Redirect to sign-in page
      router.push('/sign-in');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-6 text-white dark:text-white">Settings</h1>

      <Tabs defaultValue="interview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="interview">Interview</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        {/* Interview Preferences */}
        <TabsContent value="interview" className="space-y-4 bg-gray-900 p-6 rounded-lg border border-gray-700">
          <div className="space-y-2">
            <Label htmlFor="target-roles" className="text-gray-300">Target Roles</Label>
            <Input id="target-roles" placeholder="e.g. Frontend Engineer, PM" className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus-visible:ring-blue-500" />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Experience Level</Label>
            <Select>
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                <SelectValue placeholder="Choose experience level" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                <SelectItem value="fresher" className="text-white hover:bg-gray-700">Fresher</SelectItem>
                <SelectItem value="mid" className="text-white hover:bg-gray-700">Mid-level</SelectItem>
                <SelectItem value="senior" className="text-white hover:bg-gray-700">Senior</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Preferred Question Types</Label>
            <Input placeholder="e.g. Coding, Behavioral" className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus-visible:ring-blue-500" />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Preferred Domain</Label>
            <Input placeholder="e.g. Fintech, Edtech" className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus-visible:ring-blue-500" />
          </div>
        </TabsContent>

        {/* AI Personalization */}
        <TabsContent value="ai" className="space-y-4 bg-gray-900 p-6 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between">
            <Label className="text-gray-300">Enable Smart Feedback</Label>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-gray-300">Adaptive Difficulty</Label>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-gray-300">Use Past Performance</Label>
            <Switch />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Preferred Language</Label>
            <Select>
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                <SelectValue placeholder="Choose a language" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                <SelectItem value="en" className="text-white hover:bg-gray-700">English</SelectItem>
                <SelectItem value="zh" className="text-white hover:bg-gray-700">Chinese (Mandarin)</SelectItem>
                <SelectItem value="hi" className="text-white hover:bg-gray-700">Hindi</SelectItem>
                <SelectItem value="es" className="text-white hover:bg-gray-700">Spanish</SelectItem>
                <SelectItem value="fr" className="text-white hover:bg-gray-700">French</SelectItem>
                <SelectItem value="ar" className="text-white hover:bg-gray-700">Arabic</SelectItem>
                <SelectItem value="bn" className="text-white hover:bg-gray-700">Bengali</SelectItem>
                <SelectItem value="pt" className="text-white hover:bg-gray-700">Portuguese</SelectItem>
                <SelectItem value="ru" className="text-white hover:bg-gray-700">Russian</SelectItem>
                <SelectItem value="ja" className="text-white hover:bg-gray-700">Japanese</SelectItem>
                <SelectItem value="de" className="text-white hover:bg-gray-700">German</SelectItem>
                <SelectItem value="ko" className="text-white hover:bg-gray-700">Korean</SelectItem>
                <SelectItem value="it" className="text-white hover:bg-gray-700">Italian</SelectItem>
                <SelectItem value="tr" className="text-white hover:bg-gray-700">Turkish</SelectItem>
                <SelectItem value="nl" className="text-white hover:bg-gray-700">Dutch</SelectItem>
                <SelectItem value="pl" className="text-white hover:bg-gray-700">Polish</SelectItem>
                <SelectItem value="uk" className="text-white hover:bg-gray-700">Ukrainian</SelectItem>
                <SelectItem value="vi" className="text-white hover:bg-gray-700">Vietnamese</SelectItem>
                <SelectItem value="th" className="text-white hover:bg-gray-700">Thai</SelectItem>
                <SelectItem value="fa" className="text-white hover:bg-gray-700">Persian</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-4 bg-gray-900 p-6 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between">
            <Label className="text-gray-300">Daily Practice Reminder</Label>
            <Switch defaultChecked />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Reminder Time</Label>
            <div className="relative w-40">
              <Input
                ref={timeInputRef}
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="pl-10 pr-3 py-2 w-full bg-gray-800 border-gray-600 text-white [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-clear-button]:hidden"
              />
              <button
                type="button"
                onClick={() => timeInputRef.current?.showPicker()}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-white transition-colors"
              >
                <Clock className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-gray-300">Email Notifications</Label>
            <Switch />
          </div>
        </TabsContent>

        {/* Account Settings */}
        <TabsContent value="account" className="space-y-4 bg-gray-900 p-6 rounded-lg border border-gray-700">
          <div className="space-y-2">
            <Label className="text-gray-300">Change Password</Label>
            <Input type="password" placeholder="New Password" className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus-visible:ring-blue-500" />
            <Button className="mt-2 bg-blue-600 hover:bg-blue-700 text-white border-blue-500">Update Password</Button>
          </div>

          <Separator className="my-4 border-gray-600" />

          {/* Logout Section */}
          <div className="space-y-2">
            <Label className="text-gray-300">Account Actions</Label>
            <div className="flex gap-4">
              <Button 
                onClick={handleLogout}
                variant="outline" 
                className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700 hover:text-white border-gray-500 flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
              <Button variant="destructive" className="bg-red-600 hover:bg-red-700 text-white border-red-500">
                Delete My Account
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing" className="space-y-4">
          <BillingSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
