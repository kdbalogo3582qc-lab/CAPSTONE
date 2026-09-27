import React, { useState } from 'react';

const LoadingModal = () => {

    return (
        <div id="processing-modal" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
                <h3 className="text-xl font-semibold mb-4">Processing Video</h3>
                <div className="flex items-center justify-center mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
                <div id="log-container" className="h-64 overflow-y-auto bg-gray-100 p-3 rounded text-sm font-mono">
                <div className="text-gray-600">Connecting to log stream...</div>
                </div>
            </div>
        </div>
    );
};

export default LoadingModal;