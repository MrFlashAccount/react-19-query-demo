/**
 * Client Components - These run on the main thread
 *
 * Client components are registered in the webpack cache and
 * referenced from server components via the manifest.
 */
"use client";

import React, { useState, useTransition } from "react";

interface CounterProps {
  initialCount: number;
  actionEndpoint?: string; // Optional: endpoint for server actions
}

/**
 * Interactive counter component (client component)
 *
 * Supports both local state and server actions via actionEndpoint
 */
export function Counter({ initialCount, actionEndpoint = "/rsc" }: CounterProps) {
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();

  const callServerAction = async (actionId: string, args: unknown[]) => {
    const response = await fetch(actionEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rsc-action": actionId,
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`Action failed: ${response.status}`);
    }

    // Parse the RSC response to get the result
    const text = await response.text();
    // The result is the last row in the RSC stream (format: "0:value")
    const lastLine = text.trim().split("\n").pop() || "";
    const match = lastLine.match(/^\d+:(.+)$/);
    if (match) {
      return JSON.parse(match[1]);
    }
    return null;
  };

  const handleIncrement = () => {
    startTransition(async () => {
      try {
        const newCount = await callServerAction("increment", [count]);
        if (typeof newCount === "number") {
          setCount(newCount);
        }
      } catch (err) {
        console.error("Increment failed:", err);
        // Fallback to local increment
        setCount((c) => c + 1);
      }
    });
  };

  const handleDecrement = () => {
    startTransition(async () => {
      try {
        const newCount = await callServerAction("decrement", [count]);
        if (typeof newCount === "number") {
          setCount(newCount);
        }
      } catch (err) {
        console.error("Decrement failed:", err);
        // Fallback to local decrement
        setCount((c) => c - 1);
      }
    });
  };

  return (
    <div className="counter">
      <div className="counter-value">{isPending ? "..." : count}</div>
      <div className="counter-buttons">
        <button
          className="btn"
          onClick={handleIncrement}
          disabled={isPending}
          style={{ padding: "0.5rem 1rem" }}
        >
          + Increment
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleDecrement}
          disabled={isPending}
          style={{ padding: "0.5rem 1rem" }}
        >
          − Decrement
        </button>
      </div>
    </div>
  );
}

interface ButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}

/**
 * Styled button component (client component)
 */
export function Button({
  onClick,
  children,
  variant = "primary",
}: ButtonProps) {
  return (
    <button className={`btn ${variant === "secondary" ? "btn-secondary" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

interface ToggleProps {
  label: string;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
}

/**
 * Toggle switch component (client component)
 */
export function Toggle({ label, defaultChecked = false, onChange }: ToggleProps) {
  const [checked, setChecked] = useState(defaultChecked);

  const handleChange = () => {
    const newValue = !checked;
    setChecked(newValue);
    onChange?.(newValue);
  };

  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        cursor: "pointer",
        padding: "0.5rem",
      }}
    >
      <div
        onClick={handleChange}
        style={{
          width: "48px",
          height: "24px",
          background: checked ? "var(--accent)" : "var(--bg-tertiary)",
          borderRadius: "12px",
          position: "relative",
          transition: "background 0.2s",
          border: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            width: "18px",
            height: "18px",
            background: "white",
            borderRadius: "50%",
            position: "absolute",
            top: "2px",
            left: checked ? "26px" : "2px",
            transition: "left 0.2s",
          }}
        />
      </div>
      <span>{label}</span>
    </label>
  );
}

interface CardProps {
  title: string;
  children: React.ReactNode;
}

/**
 * Card wrapper component (client component)
 */
export function Card({ title, children }: CardProps) {
  return (
    <div
      style={{
        background: "var(--bg-tertiary)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "1rem",
        marginTop: "1rem",
      }}
    >
      <h3 style={{ marginBottom: "0.75rem", fontSize: "1.1rem" }}>{title}</h3>
      {children}
    </div>
  );
}

