import React from 'react';
import { SettingsFormProps } from '@/types/auto-apply';
import { Button } from '@/components/ui/button';

export const SettingsForm: React.FC<SettingsFormProps> = ({ settings, onChange, onSave, loading }) => {
  const handleToggleChange = (field: keyof typeof settings, value: boolean) => {
    onChange({
      ...settings,
      [field]: value,
    });
  };

  const handleInputChange = (field: keyof typeof settings, value: any) => {
    onChange({
      ...settings,
      [field]: value,
    });
  };

  const handleNotificationChange = (field: keyof typeof settings.notifications, value: boolean) => {
    onChange({
      ...settings,
      notifications: {
        ...settings.notifications,
        [field]: value,
      },
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Auto-Apply Settings</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.isEnabled}
              onChange={(e) => handleToggleChange('isEnabled', e.target.checked)}
              className="mr-2"
            />
            Enable Auto-Apply
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Daily Application Limit</label>
          <input
            type="number"
            value={settings.dailyApplicationLimit}
            onChange={(e) => handleInputChange('dailyApplicationLimit', parseInt(e.target.value))}
            min="1"
            max="50"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Auto-Apply Threshold (%)</label>
          <input
            type="number"
            value={settings.autoApplyThreshold}
            onChange={(e) => handleInputChange('autoApplyThreshold', parseInt(e.target.value))}
            min="0"
            max="100"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Minimum relevancy score to automatically apply</p>
        </div>

        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.useCustomCoverLetter}
              onChange={(e) => handleToggleChange('useCustomCoverLetter', e.target.checked)}
              className="mr-2"
            />
            Use Custom Cover Letter
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Blacklisted Companies</label>
        <input
          type="text"
          placeholder="Company 1, Company 2, ..."
          value={settings.blacklistedCompanies.join(', ')}
          onChange={(e) => {
            const companies = e.target.value.split(',').map(c => c.trim()).filter(Boolean);
            handleInputChange('blacklistedCompanies', companies);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <h4 className="text-md font-medium text-gray-700 mb-2">Email Notifications</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.notifications.newJobsFound}
              onChange={(e) => handleNotificationChange('newJobsFound', e.target.checked)}
              className="mr-2"
            />
            New jobs found
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.notifications.applicationsSubmitted}
              onChange={(e) => handleNotificationChange('applicationsSubmitted', e.target.checked)}
              className="mr-2"
            />
            Applications submitted
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.notifications.errorAlerts}
              onChange={(e) => handleNotificationChange('errorAlerts', e.target.checked)}
              className="mr-2"
            />
            Error alerts
          </label>
        </div>
      </div>

      <Button onClick={onSave} disabled={loading} className="w-full">
        {loading ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );
};
