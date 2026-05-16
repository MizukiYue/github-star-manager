import { useState, useCallback } from "react";
import { useAppStore } from "@/stores/appStore";
import { Search, X } from "lucide-react";

export function SearchBar() {
  const { searchQuery, setSearchQuery } = useAppStore();
  const [inputValue, setInputValue] = useState(searchQuery);

  const handleSearch = useCallback(() => {
    setSearchQuery(inputValue);
  }, [inputValue, setSearchQuery]);

  const handleClear = useCallback(() => {
    setInputValue("");
    setSearchQuery("");
  }, [setSearchQuery]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSearch();
      }
      if (e.key === "Escape") {
        handleClear();
      }
    },
    [handleSearch, handleClear]
  );

  return (
    <div className="px-6 py-4 border-b border-border">
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="搜索仓库名称、描述、语言..."
          className="w-full pl-10 pr-10 py-2 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {inputValue && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
