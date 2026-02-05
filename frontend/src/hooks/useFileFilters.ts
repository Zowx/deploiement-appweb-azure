import { useState, useMemo } from "react";

export type SortKey = "name" | "size" | "createdAt";
export type SortOrder = "asc" | "desc";

export interface FileFiltersState {
  searchTerm: string;
  sortKey: SortKey;
  sortOrder: SortOrder;
}

export interface FileFiltersActions {
  setSearchTerm: (term: string) => void;
  setSortKey: (key: SortKey) => void;
  toggleSortOrder: () => void;
}

export interface UseFileFiltersReturn extends FileFiltersState, FileFiltersActions {
  filteredAndSortedFiles: <T extends { name: string; size: number; createdAt: string }>(
    files: T[]
  ) => T[];
}

export function useFileFilters(): UseFileFiltersReturn {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const filteredAndSortedFiles = useMemo(
    () => <T extends { name: string; size: number; createdAt: string }>(files: T[]) => {
      let filtered = [...files];

      // Filtrage par recherche
      if (searchTerm.trim()) {
        filtered = filtered.filter(file =>
          file.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      // Tri
      filtered.sort((a, b) => {
        let cmp = 0;
        if (sortKey === "name") {
          cmp = a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
        } else if (sortKey === "size") {
          cmp = a.size - b.size;
        } else {
          // createdAt
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return sortOrder === "asc" ? cmp : -cmp;
      });

      return filtered;
    },
    [searchTerm, sortKey, sortOrder]
  );

  return {
    // State
    searchTerm,
    sortKey,
    sortOrder,
    // Actions
    setSearchTerm,
    setSortKey,
    toggleSortOrder,
    // Computed
    filteredAndSortedFiles,
  };
}