import Link from 'next/link';

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 text-center">Cookie Policy</h1>
          <p className="text-center text-neutral-600 dark:text-neutral-300 mb-12">Last updated: June 30, 2024</p>
          
          <div className="prose dark:prose-invert max-w-none">
            <p className="mb-6">
              This Cookie Policy explains how PrepBettr (&ldquo;we,&#34; &#34;us,&#34; or &#34;our&#34;) uses cookies and similar tracking
              technologies when you visit our website or use our services.
            </p>

            <h2 className="text-2xl font-semibold mt-10 mb-4">1. What Are Cookies?</h2>
            <p className="mb-6">
              Cookies are small text files that are placed on your device when you visit a website. They are widely used 
              to make websites work more efficiently and to provide information to the website owners.
            </p>

            <h2 className="text-2xl font-semibold mt-10 mb-4">2. How We Use Cookies</h2>
            <p className="mb-4">We use cookies for the following purposes:</p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li><strong>Essential Cookies:</strong> Necessary for the website to function properly</li>
              <li><strong>Preference Cookies:</strong> Remember your preferences and settings</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how visitors interact with our website</li>
              <li><strong>Marketing Cookies:</strong> Used to track visitors across websites for advertising purposes</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-10 mb-4">3. Types of Cookies We Use</h2>
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cookie Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Purpose</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Duration</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-black divide-y divide-gray-200 dark:divide-gray-700">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">session_id</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">Maintains your session</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">Session</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">_ga</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">Google Analytics</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">2 years</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">cookie_consent</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">Stores your cookie preferences</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">1 year</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h2 className="text-2xl font-semibold mt-10 mb-4">4. Third-Party Cookies</h2>
            <p className="mb-6">
              We may also use various third-party cookies to report usage statistics of the Service, deliver 
              advertisements on and through the Service, and so on. These cookies may be used by these companies 
              to build a profile of your interests and show you relevant advertisements on other sites.
            </p>

            <h2 className="text-2xl font-semibold mt-10 mb-4">5. Your Cookie Choices</h2>
            <p className="mb-4">You have the following choices regarding cookies:</p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>Browser Settings: Most web browsers allow you to manage your cookie preferences</li>
              <li>Opt-Out Tools: You can opt out of certain third-party cookies</li>
              <li>Do Not Track: Some browsers offer a &#34;Do Not Track&#34; feature</li>
            </ul>
            <p className="mb-6">
              Please note that if you disable cookies, some features of our website may not function properly.
            </p>

            <h2 className="text-2xl font-semibold mt-10 mb-4">6. Changes to This Policy</h2>
            <p className="mb-6">
              We may update this Cookie Policy from time to time. We will notify you of any changes by posting 
              the new Cookie Policy on this page and updating the &#34;Last updated&#34; date.
            </p>

            <h2 className="text-2xl font-semibold mt-10 mb-4">7. Contact Us</h2>
            <p className="mb-6">
              If you have any questions about this Cookie Policy, please contact us at{' '}
              <Link href="mailto:privacy@prepbettr.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                privacy@prepbettr.com
              </Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
