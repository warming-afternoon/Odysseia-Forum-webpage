import { create } from 'zustand';

interface ImageViewerState {
  isOpen: boolean;
  src: string;
  alt: string;
  open: (src: string, alt?: string) => void;
  close: () => void;
}

export const useImageViewerStore = create<ImageViewerState>((set) => ({
  isOpen: false,
  src: '',
  alt: '',
  open: (src, alt = '') => set({ isOpen: true, src, alt }),
  close: () => set({ isOpen: false, src: '', alt: '' }),
}));
