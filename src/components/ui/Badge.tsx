import { clsx } from "clsx";
import { useTranslations } from "next-intl";

const categoryColors: Record<string, string> = {
  Food: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Medicine: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  Electronics:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Household:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Clothing: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  Beauty:
    "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
  Documents:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  Tools: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  Other: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

interface BadgeProps {
  label: string;
  className?: string;
}

export function CategoryBadge({ label, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        categoryColors[label] ?? categoryColors.Other,
        className,
      )}
    >
      {label}
    </span>
  );
}

interface ExpiryBadgeProps {
  daysUntilExpiry: number | null;
  className?: string;
  orgExpDate?: string | Date | null;
}

export function ExpiryBadge({
  daysUntilExpiry,
  className,
  orgExpDate,
}: ExpiryBadgeProps) {
  if (daysUntilExpiry === null) return null;
  const t = useTranslations("items");

  let color = "";
  let label = "";

  if (daysUntilExpiry < 0) {
    color = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    label = "Expired";
  } else if (daysUntilExpiry === 0) {
    color = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    label = "Expires today";
  } else if (daysUntilExpiry <= 3) {
    color = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    label = `${daysUntilExpiry} ${t("dayLeft")}`;
  } else if (daysUntilExpiry <= 7) {
    color =
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    label = `${daysUntilExpiry} ${t("dayLeft")}`;
  } else if (daysUntilExpiry <= 30) {
    color =
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    label = `${daysUntilExpiry} ${t("dayLeft")}`;
  } else {
    color =
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    label = `${daysUntilExpiry} ${t("dayLeft")}`;
  }

  return (
    <>
      <span
        className={clsx(
          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
          color,
          className,
        )}
      >
        {label}
      </span>
      {orgExpDate && (
        <span
          className={clsx(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
            className,
          )}
        >
          {new Date(orgExpDate).toLocaleDateString()}
        </span>
      )}
    </>
  );
}
