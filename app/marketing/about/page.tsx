import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 text-center">About PrepBettr</h1>
          
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-lg mb-6">
              At PrepBettr, we&apos;re on a mission to help job seekers ace their interviews through AI-powered practice and real-time feedback.
              Our platform is designed to simulate real interview scenarios, giving you the confidence and skills needed to succeed.
            </p>
            
            <h2 className="text-2xl font-semibold mt-10 mb-4">Our Story</h2>
            <p className="mb-6">
              Founded in 2023, PrepBettr was born out of a simple observation: interview preparation is often stressful, expensive, and doesn&#39;t provide actionable feedback.
              We set out to change that by creating an accessible, affordable, and effective way to practice interviews.
            </p>
            
            <h2 className="text-2xl font-semibold mt-10 mb-4">Our Values</h2>
            <ul className="space-y-4 mb-8">
              <li className="flex items-start">
                <span className="text-indigo-600 dark:text-indigo-400 mr-3">•</span>
                <span><strong>Empowerment:</strong> We believe everyone deserves the tools to succeed in their career.</span>
              </li>
              <li className="flex items-start">
                <span className="text-indigo-600 dark:text-indigo-400 mr-3">•</span>
                <span><strong>Innovation:</strong> We&#39;re committed to using cutting-edge AI to deliver the best interview preparation experience.</span>
              </li>
              <li className="flex items-start">
                <span className="text-indigo-600 dark:text-indigo-400 mr-3">•</span>
                <span><strong>Accessibility:</strong> We&#39;re making interview prep accessible to everyone, regardless of their background or financial situation.</span>
              </li>
            </ul>
            
            <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-800">
              <h2 className="text-2xl font-semibold mb-6">Join Our Mission</h2>
              <p className="mb-6">
                Ready to take your interview skills to the next level? 
                <Link href="/sign-up" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  Sign up for free
                </Link> and start practicing today.
              </p>
              <p>
                Have questions? 
                <Link href="mailto:contact@prepbettr.com" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  Contact our team
                </Link> — we&#39;d love to hear from you!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
