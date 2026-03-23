import { useState, useEffect, useRef, useCallback } from 'react';
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
  const debouncedValue = useDebounce(value, 400);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }, []);

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
          updatePosition();
        }
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedValue, fetchOptions, minChars, updatePosition]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Update position on scroll/resize
  useEffect(() => {
    if (!open) return;
    const handleScroll = () => updatePosition();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open, updatePosition]);

  const dropdown = open && options.length > 0 ? createPortal(
    <div
      ref={(el) => {
        // Also close when clicking outside the portal dropdown
        if (!el) return;
        const handler = (e: MouseEvent) => {
          if (containerRef.current?.contains(e.target as Node)) return;
          if (el.contains(e.target as Node)) return;
          setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
      }}
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
            onSelect(opt);
            setOpen(false);
          }}
        >
          <span className="font-medium text-foreground">{opt.label}</span>
          {opt.sublabel && <span className="ml-2 text-xs text-muted-foreground">{opt.sublabel}</span>}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

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
        {loading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {dropdown}
    </div>
  );
}
