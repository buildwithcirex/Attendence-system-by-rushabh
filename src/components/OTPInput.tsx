"use client";

import { useRef, KeyboardEvent, ChangeEvent } from "react";

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
}

export function OTPInput({ length = 6, value, onChange }: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value;
    if (/[^0-9]/.test(val)) return; // Only numbers allowed

    const newValue = value.split("");
    // If the input has more than 1 character (e.g. paste), just take the last typed character
    newValue[index] = val.substring(val.length - 1);
    
    const finalValue = newValue.join("").substring(0, length);
    onChange(finalValue);

    if (val && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").substring(0, length);
    if (pastedData) {
      onChange(pastedData.padEnd(length, "").substring(0, length));
      // Focus the next empty input or the last one
      const nextEmptyIndex = Math.min(pastedData.length, length - 1);
      inputRefs.current[nextEmptyIndex]?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-between w-full" onPaste={handlePaste}>
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          className="field w-12 h-14 text-center text-xl font-mono rounded-xl"
          maxLength={2}
          value={value[index] || ""}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
        />
      ))}
    </div>
  );
}
