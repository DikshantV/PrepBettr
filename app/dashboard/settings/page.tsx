'use client';

import { useState, useRef } from 'react';
import { Clock } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

export default function SettingsPage() {
  const [reminderTime, setReminderTime] = useState('08:00');
  const timeInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <Tabs defaultValue="interview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="interview">Interview</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        {/* Interview Preferences */}
        <TabsContent value="interview" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target-roles">Target Roles</Label>
            <Input id="target-roles" placeholder="e.g. Frontend Engineer, PM" />
          </div>

          <div className="space-y-2">
            <Label>Experience Level</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Choose experience level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fresher">Fresher</SelectItem>
                <SelectItem value="mid">Mid-level</SelectItem>
                <SelectItem value="senior">Senior</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Preferred Question Types</Label>
            <Input placeholder="e.g. Coding, Behavioral" />
          </div>

          <div className="space-y-2">
            <Label>Preferred Domain</Label>
            <Input placeholder="e.g. Fintech, Edtech" />
          </div>
        </TabsContent>

        {/* AI Personalization */}
        <TabsContent value="ai" className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Enable Smart Feedback</Label>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label>Adaptive Difficulty</Label>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <Label>Use Past Performance</Label>
            <Switch />
          </div>
          <div className="space-y-2">
            <Label>Preferred Language</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Choose a language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="zh">Chinese (Mandarin)</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="ar">Arabic</SelectItem>
                <SelectItem value="bn">Bengali</SelectItem>
                <SelectItem value="pt">Portuguese</SelectItem>
                <SelectItem value="ru">Russian</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="ko">Korean</SelectItem>
                <SelectItem value="it">Italian</SelectItem>
                <SelectItem value="tr">Turkish</SelectItem>
                <SelectItem value="nl">Dutch</SelectItem>
                <SelectItem value="pl">Polish</SelectItem>
                <SelectItem value="uk">Ukrainian</SelectItem>
                <SelectItem value="vi">Vietnamese</SelectItem>
                <SelectItem value="th">Thai</SelectItem>
                <SelectItem value="fa">Persian</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Daily Practice Reminder</Label>
            <Switch defaultChecked />
          </div>

          <div className="space-y-2">
            <Label>Reminder Time</Label>
            <div className="relative w-40">
              <Input
                ref={timeInputRef}
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="pl-10 pr-3 py-2 w-full [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-clear-button]:hidden"
              />
              <button
                type="button"
                onClick={() => timeInputRef.current?.showPicker()}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Clock className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Email Notifications</Label>
            <Switch />
          </div>
        </TabsContent>

        {/* Account Settings */}
        <TabsContent value="account" className="space-y-4">
          <div className="space-y-2">
            <Label>Change Password</Label>
            <Input type="password" placeholder="New Password" />
            <Button className="mt-2">Update Password</Button>
          </div>

          <Separator className="my-4" />

          <Button variant="destructive">Delete My Account</Button>
        </TabsContent>

        {/* Billing */}
        <TabsContent value="billing" className="space-y-4">
          <div>
            <Label>Current Plan</Label>
            <p className="text-sm font-semibold mt-1">Free</p>
            <Button className="mt-2">Upgrade to Pro</Button>
          </div>

          <Separator className="my-4" />

          <Label>Billing History</Label>
          <Textarea disabled placeholder="Coming soon..." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
