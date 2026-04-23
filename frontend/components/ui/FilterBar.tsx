"use client";

import { useState, useRef, useEffect } from "react";

interface FilterBarProps {
  sourceType?: string;
  onSourceTypeChange: (type: string | undefined) => void;
  daysFilter?: number;
  onDaysFilterChange: (days: number | undefined) => void;
}

interface Option<T> {
  value: T;
  label: string;
  icon?: string;
}

const sourceTypes: Option<string | undefined>[] = [
  { value: undefined,    label: "All Sources",         icon: "✦" },
  { value: "pdf",        label: "PDF",                 icon: "📄" },
  { value: "markdown",   label: "Markdown",            icon: "📋" },
  { value: "docx",       label: "Word",                icon: "📝" },
  { value: "pptx",       label: "PowerPoint",          icon: "📊" },
  { value: "xlsx",       label: "Excel",               icon: "📊" },
  { value: "csv",        label: "CSV",                 icon: "📊" },
  { value: "epub",       label: "EPUB",                icon: "📖" },
  { value: "html",       label: "HTML",                icon: "🌐" },
  { value: "obsidian",   label: "Obsidian",            icon: "📓" },
  { value: "notion",     label: "Notion",              icon: "📝" },
];

const dayOptions: Option<number | undefined>[] = [
  { value: undefined, label: "All Time" },
  { value: 7,         label: "Last 7 days" },
  { value: 30,        label: "Last 30 days" },
  { value: 90,        label: "Last 90 days" },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 24 24" fill="none"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Dropdown<T>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isActive = value !== undefined && value !== options[0].value;

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 ${
          isActive
            ? "bg-accent/15 border-accent/40 text-accent"
            : "bg-surface-dark border-border-dark text-secondary hover:text-primary-dark hover:border-accent/30"
        }`}
      >
        {selected.icon && (
          <span className="text-[11px] leading-none">{selected.icon}</span>
        )}
        <span>{selected.label}</span>
        <ChevronIcon open={open} />
      </button>

      {/* Dropdown panel — opens upward */}
      {open && (
        <div className="absolute bottom-full mb-1.5 left-0 z-50 min-w-[168px] bg-sidebar-dark border border-border-dark rounded-xl shadow-2xl overflow-hidden py-1">
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={i}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors ${
                  isSelected
                    ? "bg-accent/15 text-accent"
                    : "text-secondary hover:bg-surface-dark hover:text-primary-dark"
                }`}
              >
                {opt.icon && (
                  <span className="text-[12px] w-4 text-center flex-shrink-0">{opt.icon}</span>
                )}
                <span className="flex-1">{opt.label}</span>
                {isSelected && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FilterBar({
  sourceType,
  onSourceTypeChange,
  daysFilter,
  onDaysFilterChange,
}: FilterBarProps) {
  const isFiltered = sourceType !== undefined || daysFilter !== undefined;

  return (
    <div className="border-b border-border-dark px-4 py-2 flex items-center gap-2">
      <span className="text-[10px] text-secondary uppercase tracking-wider flex-shrink-0 mr-1">
        Filter:
      </span>

      <Dropdown
        options={sourceTypes}
        value={sourceType}
        onChange={onSourceTypeChange}
      />

      <Dropdown
        options={dayOptions}
        value={daysFilter}
        onChange={onDaysFilterChange}
      />

      {isFiltered && (
        <span className="text-[10px] text-accent/60 ml-1">
          · applies to next message
        </span>
      )}
    </div>
  );
}
