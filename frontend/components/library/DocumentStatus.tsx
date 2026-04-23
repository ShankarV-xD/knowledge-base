"use client";

interface DocumentStatusProps {
  status: string;
}

export default function DocumentStatus({ status }: DocumentStatusProps) {
  const config: Record<string, { label: string; color: string; dot: string }> = {
    pending: {
      label: "Pending",
      color: "text-secondary",
      dot: "bg-secondary",
    },
    processing: {
      label: "Processing",
      color: "text-accent",
      dot: "bg-accent animate-pulse",
    },
    done: {
      label: "Ready",
      color: "text-success",
      dot: "bg-success",
    },
    error: {
      label: "Error",
      color: "text-error",
      dot: "bg-error",
    },
  };

  const { label, color, dot } = config[status] || config.pending;

  return (
    <div className={`flex items-center gap-1.5 text-[10px] font-medium ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </div>
  );
}
