import React, { useState, useEffect } from "react";
import { Package, Camera } from "lucide-react";

interface ImageWithFallbackProps {
  src?: string | null;
  alt?: string;
  className?: string;
  onClick?: () => void;
  badgeCount?: number;
  showCameraIcon?: boolean;
  fallbackLabel?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

export default function ImageWithFallback({
  src,
  alt = "Thumbnail",
  className = "h-8 w-12 object-cover rounded-md border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer",
  onClick,
  badgeCount,
  showCameraIcon = false,
  fallbackLabel,
  referrerPolicy = "no-referrer",
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const isInvalid = !src || src === "CLEANED_UP" || src === "ARCHIVED" || src.trim() === "";

  if (isInvalid || hasError) {
    return (
      <div
        onClick={onClick}
        title={hasError ? "Imagem indisponível / Falha no carregamento" : "Sem foto cadastrada"}
        className={`h-8 w-12 bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-md flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors select-none shrink-0 ${
          onClick ? "cursor-pointer" : ""
        }`}
      >
        {showCameraIcon ? (
          <Camera className="h-3.5 w-3.5 opacity-80" />
        ) : (
          <Package className="h-3.5 w-3.5 opacity-80" />
        )}
        {fallbackLabel && (
          <span className="text-[7px] font-medium leading-none mt-0.5 max-w-[44px] truncate text-center opacity-75">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-block shrink-0">
      <img
        src={src}
        alt={alt}
        className={className}
        onClick={onClick}
        onError={() => setHasError(true)}
        referrerPolicy={referrerPolicy}
      />
      {badgeCount !== undefined && badgeCount > 1 && (
        <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white text-[8px] font-bold h-4 w-4 flex items-center justify-center rounded-full border border-white dark:border-slate-800 shadow-xs pointer-events-none">
          +{badgeCount - 1}
        </span>
      )}
    </div>
  );
}
