export interface ExportColumn<T = Record<string, unknown>> {
  readonly key: keyof T | string;
  readonly header: string;
  readonly width?: number; // Used for Excel/PDF formatting
  readonly align?: 'left' | 'center' | 'right';
  readonly format?: 'currency' | 'number' | 'text' | 'percentage' | 'date' | 'datetime' | 'boolean';
}

export interface ExportDefinition<T = Record<string, unknown>> {
  readonly title: string;           
  readonly filename: string;        
  readonly columns: ReadonlyArray<ExportColumn<T>>; 
  readonly dataRows: ReadonlyArray<T>;         
  readonly metadata: Readonly<{
    generatedBy: string;
    generatedAt: Date;
    firmName: string;
    filters: Record<string, string>;
  }>;
  readonly summary: ReadonlyArray<{
    readonly label: string;
    readonly value: string | number;
    readonly format?: 'currency' | 'number' | 'text' | 'percentage';
  }>;
}
