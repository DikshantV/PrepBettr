import Link from 'next/link';

export default function CareersPage() {
  const openPositions = [
    {
      id: 1,
      title: 'Senior Frontend Developer',
      type: 'Full-time',
      location: 'Remote',
      description: 'We\'re looking for an experienced Frontend Developer to help us build and improve our interview preparation platform.'
    },
    {
      id: 2,
      title: 'AI/ML Engineer',
      type: 'Full-time',
      location: 'Remote',
      description: 'Join our AI team to develop and improve our interview analysis and feedback systems.'
    },
    {
      id: 3,
      title: 'Content Creator',
      type: 'Part-time',
      location: 'Remote',
      description: 'Help us create high-quality interview questions and preparation materials for our users.'
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center">Join Our Team</h1>
          <p className="text-xl text-center text-neutral-600 dark:text-neutral-300 mb-12">
            Help us build the future of interview preparation
          </p>
          
          <div className="prose dark:prose-invert max-w-none">
            <div className="mb-16">
              <h2 className="text-2xl font-semibold mb-6">Why Work With Us</h2>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-neutral-50 dark:bg-neutral-900 p-6 rounded-xl">
                  <h3 className="text-lg font-semibold mb-2">Impact</h3>
                  <p className="text-neutral-600 dark:text-neutral-300">Help millions of job seekers land their dream jobs through better interview preparation.</p>
                </div>
                <div className="bg-neutral-50 dark:bg-neutral-900 p-6 rounded-xl">
                  <h3 className="text-lg font-semibold mb-2">Flexibility</h3>
                  <p className="text-neutral-600 dark:text-neutral-300">Work remotely from anywhere with a flexible schedule that fits your life.</p>
                </div>
                <div className="bg-neutral-50 dark:bg-neutral-900 p-6 rounded-xl">
                  <h3 className="text-lg font-semibold mb-2">Growth</h3>
                  <p className="text-neutral-600 dark:text-neutral-300">Learn and grow with a team that values continuous improvement and innovation.</p>
                </div>
              </div>
            </div>

            <div className="mb-16">
              <h2 className="text-2xl font-semibold mb-6">Open Positions</h2>
              <div className="space-y-6">
                {openPositions.map((position) => (
                  <div key={position.id} className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold">{position.title}</h3>
                        <div className="flex items-center mt-2 space-x-4">
                          <span className="text-sm text-neutral-500 dark:text-neutral-400">{position.type}</span>
                          <span className="text-sm text-neutral-500 dark:text-neutral-400">•</span>
                          <span className="text-sm text-neutral-500 dark:text-neutral-400">{position.location}</span>
                        </div>
                      </div>
                      <Link 
                        href={`mailto:careers@prepbettr.com?subject=Application for ${position.title} Position`}
                        className="mt-4 md:mt-0 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Apply Now
                      </Link>
                    </div>
                    <p className="mt-4 text-neutral-600 dark:text-neutral-300">{position.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-8 rounded-xl">
              <h2 className="text-2xl font-semibold mb-4">Don&#39;t See Your Dream Job?</h2>
              <p className="mb-6 text-neutral-600 dark:text-neutral-300">
                We&#39;re always looking for talented individuals to join our team. Even if you don&#39;t see a position that matches your skills, we&#39;d love to hear from you!
              </p>
              <Link 
                href="mailto:careers@prepbettr.com?subject=General Application"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Send Us Your Resume
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
