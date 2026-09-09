"use client";

import Link from "next/link";

export default function Success() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">Payment Successful!</h1>

          <p className="text-gray-600 mb-8">
            Thank you for your subscription. Your payment has been processed successfully.
          </p>

          <div className="space-y-3">
            <Link
              href="/dashboard"
              className="block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Go to Dashboard
            </Link>

            <Link
              href="/portal"
              className="block px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              Manage Subscription
            </Link>
          </div>

          <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              The <code className="bg-white px-1 py-0.5 rounded">onGrantAccess</code> webhook
              callback has been triggered to grant you access.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
