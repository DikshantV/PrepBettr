'use client';

import { useState, useRef } from 'react';
import { Clock, LogOut, Zap, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
import { useFeatureFlags } from '@/lib/hooks/useFeatureFlags';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SettingsPage() {
  const [reminderTime, setReminderTime] = useState('08:00');
  const timeInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { flags, loading, refreshFlags, isAutoApplyAzureEnabled, isPortalIntegrationEnabled } = useFeatureFlags();

  const handleLogout = async () => {
    try {
      // Clear any local storage or session data
      localStorage.clear();
      sessionStorage.clear();
      
      // Call logout API and redirect to marketing page
      await fetch("/api/profile/logout", { method: "POST" });
      router.push('/marketing');
      router.refresh();
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
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
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
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-400" />
                New AI Engine (Beta)
              </h3>
              
              {loading ? (
                <div className="animate-pulse bg-gray-800 h-4 w-full rounded mb-2"></div>
              ) : (
                <>
                  <div className="space-y-3">
                    {/* Azure Auto-Apply Feature */}
                    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700">
                      <div className="flex-1">
                        <Label className="text-white font-medium">Auto-Apply with Azure AI</Label>
                        <p className="text-sm text-gray-400 mt-1">
                          Automatically apply to jobs using advanced Azure OpenAI integration
                        </p>
                        {flags?.rolloutStatus?.autoApplyAzure && (
                          <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-900 text-blue-200 rounded">
                            You're in the beta rollout!
                          </span>
                        )}
                      </div>
                      <Switch 
                        checked={isAutoApplyAzureEnabled()} 
                        disabled={!flags?.rolloutStatus?.autoApplyAzure}
                      />
                    </div>

                    {/* Portal Integration Feature */}
                    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700">
                      <div className="flex-1">
                        <Label className="text-white font-medium">Enhanced Portal Integration</Label>
                        <p className="text-sm text-gray-400 mt-1">
                          Seamless integration with LinkedIn, Indeed, and other job portals
                        </p>
                        {flags?.rolloutStatus?.portalIntegration && (
                          <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-900 text-blue-200 rounded">
                            You're in the beta rollout!
                          </span>
                        )}
                      </div>
                      <Switch 
                        checked={isPortalIntegrationEnabled()} 
                        disabled={!flags?.rolloutStatus?.portalIntegration}
                      />
                    </div>
                  </div>

                  {(!flags?.rolloutStatus?.autoApplyAzure && !flags?.rolloutStatus?.portalIntegration) && (
                    <Alert className="mt-4 border-blue-600 bg-blue-900/20">
                      <AlertCircle className="h-4 w-4 text-blue-400" />
                      <AlertDescription className="text-blue-200">
                        These features are currently in beta rollout. You'll be automatically included as we expand to more users.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={refreshFlags}
                    className="mt-2 bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                  >
                    Check for Updates
                  </Button>
                </>
              )}
            </div>

            <Separator className="border-gray-600" />

            <div className="space-y-3">
              <h4 className="text-white font-medium">General AI Settings</h4>
              <div className="flex items-center justify-between">
                <Label className="text-white">Enable Smart Feedback</Label>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-white">Adaptive Difficulty</Label>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-white">Use Past Performance</Label>
                <Switch />
              </div>
            </div>
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
            <Label className="text-white">Daily Practice Reminder</Label>
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
            <Label className="text-white">Email Notifications</Label>
            <Switch />
          </div>
        </TabsContent>

        {/* Privacy & GDPR */}
        <TabsContent value="privacy" className="space-y-4 bg-gray-900 p-6 rounded-lg border border-gray-700">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Data Consent Preferences</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Analytics & Performance</Label>
                    <p className="text-sm text-gray-400">Help us improve the platform by sharing usage analytics</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Marketing Communications</Label>
                    <p className="text-sm text-gray-400">Receive updates about new features and tips</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Functional Cookies</Label>
                    <p className="text-sm text-gray-400">Essential for the platform to work properly</p>
                  </div>
                  <Switch defaultChecked disabled />
                </div>
              </div>
            </div>

            <Separator className="border-gray-600" />

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Data Management</h3>
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    variant="outline" 
                    className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                  >
                    Download My Data
                  </Button>
                  <Button 
                    variant="outline" 
                    className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                  >
                    View Data Usage
                  </Button>
                </div>
                <p className="text-sm text-gray-400">
                  You can export all your personal data or view how your data is being used.
                </p>
              </div>
            </div>

            <Separator className="border-gray-600" />

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Right to be Forgotten</h3>
              <div className="space-y-3">
                <Button 
                  variant="destructive" 
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Request Data Deletion
                </Button>
                <p className="text-sm text-gray-400">
                  Permanently delete all your personal data within 30 days. This action cannot be undone.
                </p>
              </div>
            </div>

            <Separator className="border-gray-600" />

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Privacy Information</h3>
              <div className="space-y-2">
                <a 
                  href="/marketing/privacy" 
                  className="text-blue-400 hover:text-blue-300 text-sm underline"
                >
                  Privacy Policy
                </a>
                <br />
                <a 
                  href="/marketing/cookies" 
                  className="text-blue-400 hover:text-blue-300 text-sm underline"
                >
                  Cookie Policy
                </a>
                <br />
                <a 
                  href="/marketing/terms" 
                  className="text-blue-400 hover:text-blue-300 text-sm underline"
                >
                  Terms of Service
                </a>
              </div>
            </div>
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

      </Tabs>
    </div>
  );
}
