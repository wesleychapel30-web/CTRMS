import { MoreVertical } from "lucide-react";
import { useState, type ReactNode } from "react";

type UserAction = {
  key: string;
  label: string;
  onClick: () => void;
  destructive?: boolean;
};

type UserActionMenuProps = {
  actions: UserAction[];
  align?: "left" | "right";
  trigger?: ReactNode;
};

export function UserActionMenu({ actions, align = "right", trigger }: UserActionMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--surface-low)] text-[var(--muted)] hover:bg-[var(--surface-container)] hover:text-[var(--ink)]"
      >
        {trigger ?? <MoreVertical className="h-4 w-4" />}
      </button>

      {open ? (
        <div
          className={`surface-panel absolute top-9 z-40 min-w-52 rounded-lg p-1.5 ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
              className={`block w-full rounded-md px-3 py-2.5 text-left text-sm font-medium ${
                action.destructive
                  ? "text-[var(--danger)] hover:bg-[#fdf0ef]"
                  : "text-[var(--ink)] hover:bg-[var(--surface-low)]"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
