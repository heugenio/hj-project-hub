import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

interface AutocompleteOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface AutocompleteInputProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: AutocompleteOption) => void;
  fetchOptions: (query: string) => Promise<AutocompleteOption[]>;
  disabled?: boolean;
  className?: string;
  minChars?: number;
}

export function AutocompleteInput({
  placeholder,
  value,
  onChange,
  onSelect,
  fetchOptions,
  disabled,
  className,
  minChars = 2,
}: AutocompleteInputProps) {
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debouncedValue = useDebounce(value, 400);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debouncedValue.length < minChars) {
      setOptions([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchOptions(debouncedValue)
      .then((res) => {
        if (!cancelled) {
          setOptions(res);
          setOpen(res.length > 0);
        }
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedValue, fetchOptions, minChars]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="pl-8 h-9 text-sm"
          onFocus={() => { if (options.length > 0) setOpen(true); }}
        />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent/20 transition-colors border-b border-border/30 last:border-0 cursor-pointer"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(opt);
                setOpen(false);
              }}
            >
              <span className="font-medium text-foreground">{opt.label}</span>
              {opt.sublabel && <span className="ml-2 text-xs text-muted-foreground">{opt.sublabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
