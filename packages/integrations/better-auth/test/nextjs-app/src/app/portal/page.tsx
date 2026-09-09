"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Portal() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const session = await authClient.getSession();

      if (!session.data?.user) {
        router.push("/auth/signin");
        return;
      }

      setUser(session.data.user);
    };
    getUser();
  }, [router]);

  const handleOpenPortal = async () => {
    setLoading(true);

    try {
      // Create a portal session using the Creem plugin
      const result = await authClient.creem.createPortal({});

      if (result.data?.url) {
        // Redirect to Creem customer portal
        window.location.href = result.data.url;
      } else if (result.error) {
        alert(`Error: ${result.error.message}`);
      }
    } catch (error: any) {
      console.error("Portal error:", error);
      alert(`Error opening portal: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Customer Portal</h1>

        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Manage Your Subscription</h2>
            <p className="text-gray-600 mb-6">
              Access the Creem customer portal to manage your subscription, update payment methods,
              view invoices, and more.
            </p>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold text-gray-900 mb-3">What you can do in the portal:</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <svg
                  className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
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
                <span>Update payment methods</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
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
                <span>View and download invoices</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
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
                <span>Change or cancel your subscription</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
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
                <span>Update billing information</span>
              </li>
            </ul>
          </div>

          <div className="border-t pt-6">
            <button
              onClick={handleOpenPortal}
              disabled={loading}
              className="px-8 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Opening Portal..." : "Open Customer Portal"}
            </button>
          </div>
        </div>

        <div className="mt-8 bg-blue-50 rounded-lg p-6 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3">💡 Testing the Portal</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>1. Make sure you have a Creem customer associated with your email</li>
            <li>2. Click &quot;Open Customer Portal&quot; to create a portal session</li>
            <li>3. You&apos;ll be redirected to Creem&apos;s hosted portal page</li>
            <li>4. After making changes, you&apos;ll be redirected back to the dashboard</li>
          </ul>
        </div>

        <div className="mt-6 text-center">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
