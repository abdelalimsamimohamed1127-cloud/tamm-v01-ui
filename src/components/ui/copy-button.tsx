import { useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyButtonProps extends ButtonProps {
  valueToCopy: string;
}

export function CopyButton({ valueToCopy, className, ...props }: CopyButtonProps) {
  const [hasCopied, setHasCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(valueToCopy).then(() => {
      setHasCopied(true);
      setTimeout(() => {
        setHasCopied(false);
      }, 2000);
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", className)}
      onClick={copyToClipboard}
      {...props}
    >
      {hasCopied ? (
        <Check className="h-4 w-4 text-emerald-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}
