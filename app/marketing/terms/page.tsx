import Link from 'next/link';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 text-center">Terms of Service</h1>
          <p className="text-center text-neutral-600 dark:text-neutral-300 mb-12">Last updated: June 30, 2024</p>
          
          <div className="prose dark:prose-invert max-w-none">
            <p className="mb-6">
              Welcome to PrepBettr! These Terms of Service (&#34;Terms&#34;) govern your access to and use of the PrepBettr
              website, applications, and services (collectively, the &#34;Service&#34;).
            </p>

            <h2 className="text-2xl font-semibold mt-10 mb-4">1. Acceptance of Terms</h2>
            <p className="mb-6">
              By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, 
              you may not access or use the Service.
            </p>

            <h2 className="text-2xl font-semibold mt-10 mb-4">2. Description of Service</h2>
            <p className="mb-6">
              PrepBettr provides an AI-powered interview preparation platform that allows users to practice interviews 
              and receive feedback. The Service is provided for educational and informational purposes only.
            </p>

            <h2 className="text-2xl font-semibold mt-10 mb-4">3. User Accounts</h2>
            <p className="mb-4">To use certain features of the Service, you must create an account. You agree to:</p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Be responsible for all activities that occur under your account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-10 mb-4">4. Subscriptions and Payments</h2>
            <p className="mb-4">Some features of the Service require payment. By subscribing, you agree to:</p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>Pay all applicable fees</li>
              <li>Provide accurate billing information</li>
              <li>Authorize us to charge your payment method</li>
              <li>Understand that all payments are non-refundable unless otherwise stated</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-10 mb-4">5. User Content</h2>
            <p className="mb-6">
              You retain ownership of any content you submit to the Service. By submitting content, you grant us a worldwide, 
              non-exclusive, royalty-free license to use, reproduce, modify, and display such content for the purpose of 
              providing and improving the Service.
            </p>

            <h2 className="text-2xl font-semibold mt-10 mb-4">6. Prohibited Conduct</h2>
            <p className="mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>Use the Service for any illegal purpose</li>
              <li>Impersonate any person or entity</li>
              <li>Interfere with or disrupt the Service</li>
              <li>Attempt to gain unauthorized access to any accounts or systems</li>
              <li>Use the Service to violate any applicable laws or regulations</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-10 mb-4">7. Termination</h2>
            <p className="mb-6">
              We may terminate or suspend your access to the Service at any time, with or without cause, and with or 
              without notice. Upon termination, your right to use the Service will immediately cease.
            </p>

            <h2 className="text-2xl font-semibold mt-10 mb-4">8. Disclaimer of Warranties</h2>
            <p className="mb-6">
              THE SERVICE IS PROVIDED &#34;AS IS&#34; AND &#34;AS AVAILABLE&#34; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
              INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, 
              OR NON-INFRINGEMENT.
            </p>

            <h2 className="text-2xl font-semibold mt-10 mb-4">9. Limitation of Liability</h2>
            <p className="mb-6">
              IN NO EVENT SHALL PREPBETTR BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE 
              DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
            </p>

            <h2 className="text-2xl font-semibold mt-10 mb-4">10. Changes to Terms</h2>
            <p className="mb-6">
              We reserve the right to modify these Terms at any time. We will provide notice of any material changes by 
              posting the new Terms on this page and updating the &#34;Last updated&#34; date.
            </p>

            <h2 className="text-2xl font-semibold mt-10 mb-4">11. Contact Us</h2>
            <p className="mb-6">
              If you have any questions about these Terms, please contact us at{' '}
              <Link href="mailto:legal@prepbettr.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                legal@prepbettr.com
              </Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
