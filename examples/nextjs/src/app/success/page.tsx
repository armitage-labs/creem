"use client";

import Link from "next/link";

export default function SuccessPage() {
  return (
    <div style={{ textAlign: "center", marginTop: 80 }}>
      <h1>Payment Successful</h1>
      <p>Your subscription is being activated. This may take a moment.</p>
      <Link href="/" style={{ display: "inline-block", marginTop: 16 }}>
        Back to Dashboard
      </Link>
    </div>
  );
}
