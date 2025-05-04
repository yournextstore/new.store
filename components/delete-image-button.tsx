'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog as AlertDialog,
  DialogTrigger as AlertDialogTrigger,
  DialogContent as AlertDialogContent,
  DialogHeader as AlertDialogHeader,
  DialogFooter as AlertDialogFooter,
  DialogTitle as AlertDialogTitle,
  DialogDescription as AlertDialogDescription,
  DialogClose as AlertDialogCancel,
} from '@/components/ui/dialog';
import { Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DeleteImageButtonProps {
  imageId: string;
  imageName: string; // For confirmation message
  variant?:
    | 'outline'
    | 'ghost'
    | 'destructive'
    | 'default'
    | 'secondary'
    | 'link'
    | null;
  size?: 'sm' | 'icon' | 'default' | 'lg' | null;
  className?: string;
  onDeleted: (imageId: string) => void;
}

export function DeleteImageButton({
  imageId,
  imageName,
  variant = 'outline',
  size = 'icon',
  className,
  onDeleted,
}: DeleteImageButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/dev/image-library/delete/${imageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete image');
      }

      toast({
        title: 'Success',
        description: `Image "${imageName}" deleted successfully.`,
      });
      onDeleted(imageId); // Notify parent component
      setIsDialogOpen(false); // Close dialog on success
    } catch (error: any) {
      console.error('Deletion failed:', error);
      toast({
        variant: 'destructive',
        title: 'Error deleting image',
        description:
          error.message || 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button
                variant={variant}
                size={size}
                className={className}
                aria-label="Delete image"
              >
                <Trash2 size={16} />
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete image</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the image
            "{imageName}" from the database and storage.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting} asChild>
            <Button variant="outline">Cancel</Button>
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
