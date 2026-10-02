"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  onChange: (value: string) => void
  delay?: number
}

export function SearchInput({ className, onChange, delay = 300, ...props }: SearchInputProps) {
  const [value, setValue] = React.useState(props.defaultValue?.toString() ?? props.value?.toString() ?? "")
  
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onChange(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay, onChange])

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        className="pl-9 pr-9"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
