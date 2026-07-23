import React, { createContext, useContext, useEffect } from "react";
import { Unit } from "../types";

interface UnitThemeContextType {
  currentUnit: Unit | null;
}

const UnitThemeContext = createContext<UnitThemeContextType>({ currentUnit: null });

export function useUnitTheme() {
  return useContext(UnitThemeContext);
}

export function UnitThemeProvider({ 
  unit, 
  children 
}: { 
  unit: Unit | null; 
  children: React.ReactNode 
}) {
  
  // Prepare style variables based on active unit, or default fallback values
  const styleVariables = {
    "--color-primary": unit?.theme?.primary || "#4f46e5",
    "--color-accent": unit?.theme?.accent || "#06b6d4",
  } as React.CSSProperties;

  return (
    <UnitThemeContext.Provider value={{ currentUnit: unit }}>
      <div 
        style={styleVariables} 
        className="contents" 
        id="unit-theme-injected-container"
      >
        {children}
      </div>
    </UnitThemeContext.Provider>
  );
}
