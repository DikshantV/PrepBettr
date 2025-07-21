import React from 'react';
import { SettingsFormProps } from '@/types/auto-apply';
import { Button } from '@/components/ui/button';
import { LoaderInline } from '@/components/ui/loader';

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
    <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg shadow-md space-y-4">
      <h3 className="text-lg font-semibold text-white">Auto-Apply Settings</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.isEnabled}
              onChange={(e) => handleToggleChange('isEnabled', e.target.checked)}
              className="mr-2 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-gray-200">Enable Auto-Apply</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-200 mb-1">Daily Application Limit</label>
          <input
            type="number"
            value={settings.dailyApplicationLimit}
            onChange={(e) => handleInputChange('dailyApplicationLimit', parseInt(e.target.value))}
            min="1"
            max="50"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-200 mb-1">Auto-Apply Threshold (%)</label>
          <input
            type="number"
            value={settings.autoApplyThreshold}
            onChange={(e) => handleInputChange('autoApplyThreshold', parseInt(e.target.value))}
            min="0"
            max="100"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Minimum relevancy score to automatically apply</p>
        </div>

        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.useCustomCoverLetter}
              onChange={(e) => handleToggleChange('useCustomCoverLetter', e.target.checked)}
              className="mr-2 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-gray-200">Use Custom Cover Letter</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-200 mb-1">Blacklisted Companies</label>
        <input
          type="text"
          placeholder="Company 1, Company 2, ..."
          value={settings.blacklistedCompanies.join(', ')}
          onChange={(e) => {
            const companies = e.target.value.split(',').map(c => c.trim()).filter(Boolean);
            handleInputChange('blacklistedCompanies', companies);
          }}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <h4 className="text-md font-medium text-white mb-2">Email Notifications</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.notifications.newJobsFound}
              onChange={(e) => handleNotificationChange('newJobsFound', e.target.checked)}
              className="mr-2 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-gray-200">New jobs found</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.notifications.applicationsSubmitted}
              onChange={(e) => handleNotificationChange('applicationsSubmitted', e.target.checked)}
              className="mr-2 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-gray-200">Applications submitted</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.notifications.errorAlerts}
              onChange={(e) => handleNotificationChange('errorAlerts', e.target.checked)}
              className="mr-2 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-gray-200">Error alerts</span>
          </label>
        </div>
      </div>

      <Button onClick={onSave} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white border-blue-600">
        {loading && <LoaderInline size="sm" className="mr-2" variant="secondary" />}
        {loading ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );
};
