export interface TuiColumnDef<T> {
  header: string;
  width: number | 'auto';
  value: (item: T) => string;
  align?: 'left' | 'right' | 'center';
}

export interface TuiFetchResult<T> {
  items: T[];
  hasMore: boolean;
  total?: number;
}

export interface TuiCommandResult {
  success: boolean;
  message: string;
  refreshList?: boolean;
}

export interface TuiCommandDef<T> {
  name: string;
  description: string;
  requiresSelection: boolean;
  destructive?: boolean;
  execute: (selectedItem: T | null, args: string) => Promise<TuiCommandResult>;
}

export interface TuiModuleDescriptor<T> {
  name: string;
  columns: TuiColumnDef<T>[];
  fetchPage: (page: number, pageSize: number) => Promise<TuiFetchResult<T>>;
  getId: (item: T) => string;
  renderDetail: (item: T) => string[];
  commands: TuiCommandDef<T>[];
  searchFilter?: (item: T, query: string) => boolean;
}

export type TuiMode = 'list' | 'detail' | 'command' | 'search' | 'confirm';

export interface TuiState<T> {
  mode: TuiMode;
  items: T[];
  cursorIndex: number;
  scrollOffset: number;
  selectedItem: T | null;
  detailScrollOffset: number;
  commandInput: string;
  searchQuery: string;
  filteredItems: T[];
  currentPage: number;
  hasMorePages: boolean;
  totalItems: number | null;
  isLoading: boolean;
  statusMessage: string | null;
  statusType: 'info' | 'success' | 'error';
  pendingCommand: TuiCommandDef<T> | null;
}

export function createInitialState<T>(): TuiState<T> {
  return {
    mode: 'list',
    items: [],
    cursorIndex: 0,
    scrollOffset: 0,
    selectedItem: null,
    detailScrollOffset: 0,
    commandInput: '',
    searchQuery: '',
    filteredItems: [],
    currentPage: 0,
    hasMorePages: true,
    totalItems: null,
    isLoading: false,
    statusMessage: null,
    statusType: 'info',
    pendingCommand: null,
  };
}
