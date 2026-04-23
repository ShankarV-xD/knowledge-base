"use client";

import * as Popover from "@radix-ui/react-popover";
import { Source } from "@/types";

interface SourcePopoverProps {
  source: Source;
  index: number;
  children: React.ReactNode;
}

export default function SourcePopover({
  source,
  index,
  children,
}: SourcePopoverProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-50 w-80 max-h-64 overflow-y-auto rounded-xl bg-surface-dark border border-border-dark shadow-2xl p-4 animate-in fade-in-0 zoom-in-95"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold">
              {index}
            </span>
            <h4 className="text-sm font-medium text-primary-dark truncate">
              {source.source_title}
            </h4>
          </div>
          {source.heading && (
            <p className="text-xs text-secondary mb-2">
              Section: {source.heading}
            </p>
          )}
          {source.page_number && (
            <p className="text-xs text-secondary mb-2">
              Page {source.page_number}
            </p>
          )}
          <div className="text-xs text-primary-dark/80 leading-relaxed whitespace-pre-wrap">
            {source.content}
          </div>
          <Popover.Arrow className="fill-surface-dark" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
