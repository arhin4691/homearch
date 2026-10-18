import {
  ChangeEvent,
  InputHTMLAttributes,
  forwardRef,
  ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";
import { clsx } from "clsx";
import { X } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  clearable?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      leftIcon,
      rightIcon,
      clearable = true,
      className,
      id,
      type = "text",
      value,
      defaultValue,
      disabled,
      readOnly,
      onChange,
      ...props
    },
    ref,
  ) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const inputRef = useRef<HTMLInputElement>(null);
    const initialValue = value ?? defaultValue ?? "";
    const [uncontrolledHasValue, setUncontrolledHasValue] = useState(
      () => String(initialValue).length > 0,
    );
    const setRefs = useCallback(
      (element: HTMLInputElement | null) => {
        inputRef.current = element;
        if (typeof ref === "function") ref(element);
        else if (ref) ref.current = element;
      },
      [ref],
    );
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      setUncontrolledHasValue(event.currentTarget.value.length > 0);
      onChange?.(event);
    };
    const hasValue =
      value != null ? String(value).length > 0 : uncontrolledHasValue;
    const clearableInputTypes = [
      "button",
      "checkbox",
      "file",
      "hidden",
      "image",
      "radio",
      "reset",
      "submit",
    ];
    const showClearButton =
      clearable &&
      hasValue &&
      !disabled &&
      !readOnly &&
      !clearableInputTypes.includes(type);

    const clearInput = () => {
      const input = inputRef.current;
      if (!input) return;

      const valueSetter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(input),
        "value",
      )?.set;
      if (valueSetter) valueSetter.call(input, "");
      else input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      setUncontrolledHasValue(false);
      input.focus();
    };

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
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 text-[var(--muted)] pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={setRefs}
            id={inputId}
            type={type}
            value={value}
            defaultValue={defaultValue}
            disabled={disabled}
            readOnly={readOnly}
            onChange={handleChange}
            className={clsx(
              "w-full bg-[var(--card)] border rounded-xl px-3 py-2.5 text-sm",
              "text-[var(--foreground)] placeholder:text-[var(--muted)]",
              "transition-colors duration-150",
              "focus:outline-none focus:border-[#7dc0ff] focus:ring-2 focus:ring-[#7dc0ff]/20",
              error
                ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                : "border-[var(--card-border)]",
              leftIcon && "pl-9",
              rightIcon && clearable
                ? "pr-16"
                : (rightIcon || clearable) && "pr-9",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span
              className={clsx(
                "absolute text-[var(--muted)]",
                clearable ? "right-10" : "right-3",
              )}
            >
              {rightIcon}
            </span>
          )}
          {showClearButton && (
            <button
              type="button"
              aria-label="Clear input"
              title="Clear input"
              onClick={clearInput}
              className="absolute right-3 flex h-6 w-6 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7dc0ff]/40"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
