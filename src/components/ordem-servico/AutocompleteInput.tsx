import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

export interface AutocompleteOption {
  id: string;
  label: string;
  sublabel?: string;
  data?: any;
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
  const justSelected = useRef(false);
  const userTyped = useRef(false);
  const debouncedValue = useDebounce(value, 400);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;

    const inputRect = inputRef.current.getBoundingClientRect();
    const scopeElement = containerRef.current?.closest('[data-autocomplete-scope]') as HTMLElement | null;
    const scopeRect = scopeElement?.getBoundingClientRect();

    setDropdownStyle({
      position: 'fixed',
      top: inputRect.bottom + 4,
      left: scopeRect?.left ?? inputRect.left,
      width: scopeRect?.width ?? inputRect.width,
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false;
      setOptions([]);
      setOpen(false);
      return;
    }
    // Ignora mudanças programáticas no value (ex.: pré-preenchimento na edição)
    if (!userTyped.current) {
      setOptions([]);
      setOpen(false);
      return;
    }
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
          updatePosition();
        }
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedValue, fetchOptions, minChars, updatePosition]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;

    const reposition = () => updatePosition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);

    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, updatePosition]);

  const dropdown =
    open && options.length > 0
      ? createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="max-h-48 overflow-auto rounded-md border bg-popover shadow-lg"
          >
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent/20 transition-colors border-b border-border/30 last:border-0 cursor-pointer"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  justSelected.current = true;
                  onSelect(opt);
                  setOpen(false);
                  setOptions([]);
                }}
              >
                <span className="font-medium text-foreground">{opt.label}</span>
                {opt.sublabel && <span className="ml-2 text-xs text-muted-foreground">{opt.sublabel}</span>}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="pl-8 h-9 text-sm"
          onFocus={() => {
            if (options.length > 0) {
              updatePosition();
              setOpen(true);
            }
          }}
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      {dropdown}
    </div>
  );
}
