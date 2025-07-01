import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 text-center">Privacy Policy</h1>
          <p className="text-center text-neutral-600 dark:text-neutral-300 mb-12">Last updated: June 30, 2024</p>
          
          <div className="prose dark:prose-invert max-w-none">
            <p className="mb-6">
              At PrepBettr, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, 
              and safeguard your information when you use our services.
            </p>

            <h2 className="text-2xl font-semibold mt-10 mb-4">1. Information We Collect</h2>
            <p className="mb-4">We collect information that you provide directly to us, including:</p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>Account information (name, email, password)</li>
              <li>Profile information (resume, work experience, education)</li>
              <li>Interview recordings and responses</li>
              <li>Payment information (processed securely by our payment processor)</li>
              <li>Communications with our support team</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-10 mb-4">2. How We Use Your Information</h2>
            <p className="mb-4">We use the information we collect to:</p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>Provide, maintain, and improve our services</li>
              <li>Personalize your experience</li>
              <li>Analyze usage and trends</li>
              <li>Communicate with you about products, services, and promotions</li>
              <li>Process transactions and send related information</li>
              <li>Detect, investigate, and prevent fraudulent transactions</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-10 mb-4">3. Information Sharing</h2>
            <p className="mb-6">
              We do not share your personal information with third parties except as described in this Privacy Policy. 
              We may share information with:
            </p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>Service providers who perform services on our behalf</li>
              <li>Law enforcement or other government officials, in response to a verified request</li>
              <li>Other parties in connection with a company transaction, such as a merger or sale</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-10 mb-4">4. Data Security</h2>
            <p className="mb-6">
              We implement appropriate technical and organizational measures to protect your personal information. 
              However, no method of transmission over the Internet or electronic storage is 100% secure.
            </p>

            <h2 className="text-2xl font-semibold mt-10 mb-4">5. Your Choices</h2>
            <p className="mb-4">You can:</p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>Update your account information by logging into your account</li>
              <li>Opt out of promotional communications by following the unsubscribe instructions</li>
              <li>Request deletion of your account by contacting us</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-10 mb-4">6. Changes to This Policy</h2>
            <p className="mb-6">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new 
              Privacy Policy on this page and updating the &#34;Last updated&#34; date.
            </p>

            <h2 className="text-2xl font-semibold mt-10 mb-4">7. Contact Us</h2>
            <p className="mb-6">
              If you have any questions about this Privacy Policy, please contact us at{' '}
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
