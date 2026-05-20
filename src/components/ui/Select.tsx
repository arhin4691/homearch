import { SelectHTMLAttributes, forwardRef, ReactNode } from "react";
import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: SelectOption[];
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, children, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--foreground)]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            className={clsx(
              "w-full appearance-none bg-[var(--card)] border rounded-xl px-3 py-2.5 text-sm pr-9",
              "text-[var(--foreground)]",
              "transition-colors duration-150",
              "focus:outline-none focus:border-[#7dc0ff] focus:ring-2 focus:ring-[#7dc0ff]/20",
              error
                ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                : "border-[var(--card-border)]",
              className
            )}
            {...props}
          >
            {options
              ? options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))
              : children}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)] pointer-events-none" />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
