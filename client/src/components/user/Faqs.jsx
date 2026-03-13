import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import Leftbar from './Leftbar';
import axios from 'axios';
import ApiUrl from "../config/LocalConfigApi"
import GetAccountId from "../config/LocalStorage.jsx";

function Faqs() {
  const [user, setUser] = useState(null);
  const [activeFaq, setActiveFaq] = useState(null);
  const acc_id = GetAccountId();  // Get account ID from

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${ApiUrl.apiURL}user/${acc_id}`);
        console.log(response);
        if (response.data) {
          setUser(response.data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  const faqData = [
    {
      id: 1,
      question: "What is Video Analyzer?",
      answer: "Video Analyzer is a powerful tool that provides in-depth analysis of video content. It generates comprehensive summaries, evaluates audience impact, and delivers effective analysis of video material to help creators and marketers optimize their content."
    },
    {
      id: 2,
      question: "How does the video summary feature work?",
      answer: "Our video summary feature uses advanced AI technology to process and analyze video content. It identifies key points, main themes, and important segments to generate concise yet comprehensive summaries that capture the essence of your video."
    },
    {
      id: 3,
      question: "Can Video Analyzer predict audience engagement?",
      answer: "Yes! Our audience impact analysis evaluates various factors such as pacing, visual elements, narrative structure, and emotional triggers to predict how viewers may respond to your content. This helps you understand potential engagement levels before publishing."
    },
    {
      id: 4,
      question: "What metrics are included in the effective analysis?",
      answer: "Our effective analysis examines content clarity, message coherence, visual quality, pacing, narrative structure, call-to-action effectiveness, and overall production value. These metrics are combined to provide actionable insights for improving your videos."
    },
    {
      id: 5,
      question: "How accurate is the audience impact prediction?",
      answer: "Our audience impact prediction has demonstrated up to 85% accuracy when compared with actual performance metrics. The system continuously improves through machine learning and regular updates based on evolving audience behaviors."
    },
    {
      id: 6,
      question: "What video formats are supported?",
      answer: "Video Analyzer supports most common video formats including MP4, MOV, AVI, WMV, and WebM. We recommend uploading videos with good audio quality for the most accurate analysis results."
    },
    {
      id: 7,
      question: "Is there a limit to video length?",
      answer: "Free accounts can analyze videos up to 10 minutes in length. Premium subscribers can analyze videos up to 3 minutes long. For enterprise clients, we offer custom solutions for analyzing longer content."
    },
    {
      id: 8,
      question: "How long does the analysis take?",
      answer: "Analysis time depends on video length and complexity. Most videos under 10 minutes are processed within 5-15 minutes. Longer videos may take up to an hour. You'll receive a notification when your analysis is ready."
    },
    {
      id: 9,
      question: "Can I download analysis reports?",
      answer: "Yes, all analysis reports can be downloaded in PDF, CSV, or JSON formats. Premium users also have access to interactive dashboard exports and presentation-ready slides."
    },
    {
      id: 10,
      question: "How can I improve my videos based on the analysis?",
      answer: "Each analysis includes specific recommendations for improvement. We highlight strengths to maintain and areas that need attention, providing actionable suggestions for enhancing content quality, engagement potential, and overall effectiveness."
    }
  ];

  const toggleFaq = (id) => {
    setActiveFaq(activeFaq === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />
      <div className="flex">
        <Leftbar />
        <div className="flex-1 p-6 md:p-8 lg:p-10">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-3xl font-bold text-gray-800 mb-4">Frequently Asked Questions</h1>
              <p className="text-lg text-gray-600">
                Find answers to common questions about our Video Analyzer platform and its features
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              {faqData.map((faq) => (
                <div key={faq.id} className="border-b border-gray-200 last:border-b-0">
                  <button
                    className="flex justify-between items-center w-full p-6 text-left focus:outline-none"
                    onClick={() => toggleFaq(faq.id)}
                  >
                    <span className="text-lg font-medium text-gray-900">{faq.question}</span>
                    <span className="ml-6 flex-shrink-0">
                      {activeFaq === faq.id ? (
                        <svg className="h-6 w-6 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      ) : (
                        <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </span>
                  </button>
                  {activeFaq === faq.id && (
                    <div className="px-6 pb-6 pt-0">
                      <p className="text-gray-700">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-12 bg-cyan-50 p-6 rounded-xl border border-cyan-100">
              <h2 className="text-xl font-semibold text-cyan-500 mb-4">Still have questions?</h2>
              <p className="text-cyan-700 mb-6">
                Our support team is ready to help you with any other questions you might have about Video Analyzer.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="/contact"
                  className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-700"
                >
                  Contact Support
                </a>
                <a
                  href="/documentation"
                  className="inline-flex items-center justify-center px-5 py-3 border border-gray-300 text-base font-medium rounded-md text-cyan-700 bg-white hover:bg-gray-50"
                >
                  View Documentation
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Faqs;