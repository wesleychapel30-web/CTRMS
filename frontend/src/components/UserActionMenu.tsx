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
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
      >
        {trigger ?? <MoreVertical className="h-4 w-4" />}
      </button>

      {open ? (
        <div
          className={`absolute top-9 z-40 min-w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-950 ${
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
              className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
                action.destructive
                  ? "text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
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
