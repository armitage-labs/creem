"use client";

interface SubscriptionBadgeProps {
  status: "active" | "inactive" | "cancelled" | "expired";
  className?: string;
}

export function SubscriptionBadge({ status, className = "" }: SubscriptionBadgeProps) {
  const variants = {
    active: {
      bg: "bg-green-100",
      text: "text-green-800",
      border: "border-green-200",
      label: "Active",
      icon: "✓",
    },
    inactive: {
      bg: "bg-gray-100",
      text: "text-gray-800",
      border: "border-gray-200",
      label: "Inactive",
      icon: "○",
    },
    cancelled: {
      bg: "bg-red-100",
      text: "text-red-800",
      border: "border-red-200",
      label: "Cancelled",
      icon: "✕",
    },
    expired: {
      bg: "bg-orange-100",
      text: "text-orange-800",
      border: "border-orange-200",
      label: "Expired",
      icon: "⚠",
    },
  };

  const variant = variants[status];

  return (
    <div
      className={`inline-flex items-center px-3 py-1 rounded-full border ${variant.bg} ${variant.text} ${variant.border} ${className}`}
    >
      <span className="mr-2 text-sm">{variant.icon}</span>
      <span className="text-sm font-medium">{variant.label}</span>
    </div>
  );
}
