import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import Leftbar from './Leftbar';
import axios from 'axios';
import ApiUrl from "../config/LocalConfigApi"
import GetAccountId from "../config/LocalStorage.jsx";
import step1Image from '../../assets/step-1.avif'
import step2Image from '../../assets/step-2.avif'
import step3Image from '../../assets/step-3.avif'
import step4Image from '../../assets/step-4.avif'
import AI from '../../assets/AI.avif'
import { Link } from 'react-router-dom';

function HowItWorks() {
    const [user, setUser] = useState(null);
    const [activeStep, setActiveStep] = useState(1);
    const [activeFeature, setActiveFeature] = useState(null);
    const acc_id = GetAccountId();  // Get account ID from local storage


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

    const features = [
        {
            id: 1,
            title: "Key Statistics",
            description: "View comprehensive metrics about your video including engagement potential, clarity score, emotional impact rating, and content effectiveness.",
            icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            )
        },
        {
            id: 2,
            title: "Target Audience",
            description: "Discover detailed insights about the demographic and psychographic profiles of viewers most likely to engage with your content.",
            icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            )
        },
        {
            id: 3,
            title: "Key Points",
            description: "Extract the most important moments and messages from your video with timestamps and detailed explanation of their significance.",
            icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
            )
        },
        {
            id: 4,
            title: "Potential Improvements",
            description: "Receive actionable recommendations to enhance your video's effectiveness, including suggestions for pacing, structure, visual elements, and messaging.",
            icon: (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            )
        }
    ];

    const steps = [
        {
            number: 1,
            title: "Upload Your Video",
            description: "Select and upload your video file (up to 3 minutes long) through our simple upload interface.",
            image: step1Image
        },
        {
            number: 2,
            title: "Click Analyze",
            description: "Press the analyze button to start our AI-powered processing. Our system will process your video's visual and audio elements.",
            image: step2Image
        },
        {
            number: 3,
            title: "View Results",
            description: "Within moments, receive a comprehensive analysis of your video, including summary, audience impact, and effectiveness metrics.",
            image: step3Image
        },
        {
            number: 4,
            title: "Explore Detailed Insights",
            description: "Use the buttons on the right side to dive deeper into specific aspects of your video analysis.",
            image: step4Image
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar user={user} />
            <div className="flex">
                <Leftbar />
                <div className="flex-1 p-6 md:p-8 lg:p-10">
                    <div className="max-w-5xl mx-auto">
                        <div className="text-center mb-12">
                            <h1 className="text-3xl font-bold text-gray-800 mb-4">How It Works</h1>
                            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                                Our Video Analyzer makes it simple to get powerful insights from your videos in just a few clicks.
                                Upload, analyze, and discover ways to optimize your content.
                            </p>
                        </div>

                        {/* Process Steps */}
                        <div className="mb-16">
                            <h2 className="text-2xl font-semibold text-gray-800 mb-8 text-center">Simple 4-Step Process</h2>

                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {steps.map((step) => (
                                    <div
                                        key={step.number}
                                        className={`bg-white rounded-xl shadow-md overflow-hidden transition-all duration-300 ${activeStep === step.number ? 'ring-2 ring-cyan-500 transform scale-105' : ''}`}
                                        onMouseEnter={() => setActiveStep(step.number)}
                                    >
                                        <div className="relative">
                                            <img
                                                src={step.image}
                                                alt={`Step ${step.number}: ${step.title}`}
                                                className="w-full h-48 object-cover"
                                            />
                                            <div className="absolute top-4 left-4 bg-cyan-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                                                {step.number}
                                            </div>
                                        </div>
                                        <div className="p-5">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                                            <p className="text-gray-600">{step.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Analysis Features */}
                        <div className="bg-white rounded-xl shadow-lg p-8 mb-16">
                            <h2 className="text-2xl font-semibold text-gray-800 mb-8 text-center">Detailed Analysis Features</h2>
                            <p className="text-gray-600 mb-10 text-center max-w-3xl mx-auto">
                                After analysis, explore these specialized insights with the buttons on the right side of your dashboard.
                            </p>

                            <div className="grid md:grid-cols-2 gap-6">
                                {features.map((feature) => (
                                    <div
                                        key={feature.id}
                                        className={`p-6 border rounded-lg cursor-pointer transition-all duration-300 ${activeFeature === feature.id ? 'bg-cyan-50 border-cyan-200' : 'border-gray-200 hover:bg-gray-50'}`}
                                        onClick={() => setActiveFeature(feature.id === activeFeature ? null : feature.id)}
                                    >
                                        <div className="flex items-start">
                                            <div className="flex-shrink-0 text-cyan-600">
                                                {feature.icon}
                                            </div>
                                            <div className="ml-4">
                                                <h3 className="text-lg font-medium text-gray-900">{feature.title}</h3>
                                                <p className="mt-2 text-gray-600">{feature.description}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Example Analysis */}
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-600 rounded-xl shadow-lg p-8 text-white">
                            <div className="text-center mb-10">
                                <h2 className="text-2xl font-bold mb-4">See it in Action</h2>
                                <p className="max-w-2xl mx-auto">
                                    Our powerful video analyzer provides actionable insights to help you create more effective content.
                                </p>
                            </div>

                            <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg">
                                <div className="grid md:grid-cols-2 gap-10 items-center">
                                    <div>
                                        <img
                                            src={AI}
                                            alt="Video Analysis Dashboard Example"
                                            className="rounded-lg shadow-lg"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold mb-4">Video Analysis Dashboard</h3>
                                        <ul className="space-y-3">
                                            <li className="flex items-start">
                                                <svg className="w-5 h-5 mr-2 mt-1 text-cyan-200" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                <span>Upload videos up to 3 minutes long</span>
                                            </li>
                                            <li className="flex items-start">
                                                <svg className="w-5 h-5 mr-2 mt-1 text-cyan-200" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                <span>Get a comprehensive summary instantly</span>
                                            </li>
                                            <li className="flex items-start">
                                                <svg className="w-5 h-5 mr-2 mt-1 text-cyan-200" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                <span>View audience impact predictions</span>
                                            </li>
                                            <li className="flex items-start">
                                                <svg className="w-5 h-5 mr-2 mt-1 text-cyan-200" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                <span>Get actionable recommendations</span>
                                            </li>
                                        </ul>
                                        <Link to="/home">
                                            <button className="mt-6 bg-white text-cyan-600 font-medium px-6 py-2 rounded-lg hover:bg-cyan-50 transition-colors">
                                                Try It Now
                                            </button>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default HowItWorks;