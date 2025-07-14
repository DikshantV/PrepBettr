'use client';

import { useState } from 'react';

type FAQItem = {
  question: string;
  answer: string;
};

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs: FAQItem[] = [
    {
      question: 'What is the purpose of this PrepBettr?',
      answer: 'PrepBettr helps you ace your interviews by providing AI-powered practice sessions, personalized feedback, and real-time analysis to improve your performance.'
    },
    {
      question: 'How does the AI evaluation work?',
      answer: 'Our AI analyzes your responses using natural language processing to evaluate your communication skills, technical knowledge, and overall interview performance.'
    },
    {
      question: 'Can I customize the interview questions?',
      answer: 'Yes, you can choose from various question categories and difficulty levels to tailor the interview to your specific needs and job role.'
    },
    {
      question: 'Is there a free trial available?',
      answer: 'Yes, we offer a free trial so you can experience our platform before committing to a subscription.'
    }
  ];

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-20 bg-white dark:bg-black">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold mt-2 mb-4">Frequently Asked Questions</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Find answers to common questions about PrepBettr and how it can help you land your dream job.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          <div className="lg:w-1/3">
            <span className="text-indigo-600 dark:text-indigo-400 text-sm font-medium">Need Help?</span>
            <h2 className="text-2xl font-bold my-4">Still have questions?</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Can&apos;t find the answer you&apos;re looking for? Our support team is here to help you with any questions you might have.
            </p>
            <a 
              href="mailto:contact@prepbettr.com" 
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Contact us
            </a>
          </div>

          <div className="lg:w-2/3 space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <button
                  className={`w-full px-6 py-4 text-left flex items-center justify-between ${
                    openIndex === index ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'
                  }`}
                  onClick={() => toggleAccordion(index)}
                >
                  <div className="flex items-center">
                    <div className="text-indigo-600 dark:text-indigo-400 mr-4">
                      <svg
                        className="w-6 h-6"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.496 6.033h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286a.237.237 0 0 0 .241.247zm2.325 6.443c.61 0 1.029-.394 1.029-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94 0 .533.425.927 1.01.927z" />
                      </svg>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">{faq.question}</span>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                      openIndex === index ? 'transform rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  className={`px-6 overflow-hidden transition-all duration-200 ${
                    openIndex === index ? 'max-h-96 py-4' : 'max-h-0 py-0'
                  }`}
                >
                  <div className="pb-4 text-gray-600 dark:text-gray-300">
                    {faq.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;