"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type GalleryImage = {
  id: string;
  listing_id: string;
  image_url: string;
  storage_path: string | null;
  sort_order: number | null;
  is_cover: boolean | null;
  created_at: string | null;
};

type ListingGalleryModalProps = {
  images: GalleryImage[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
};

export default function ListingGalleryModal({
  images,
  initialIndex,
  isOpen,
  onClose,
}: ListingGalleryModalProps) {
  const t = useTranslations("listingGallery");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastWheelNavigationRef = useRef(0);

  useEffect(() => {
    if (!isOpen || images.length === 0) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsZoomed(false);
        setSelectedIndex(null);
        onClose();
      }
      if (e.key === "ArrowRight") {
        setIsZoomed(false);
        setSelectedIndex((prev) => ((prev ?? initialIndex) + 1) % images.length);
      }
      if (e.key === "ArrowLeft") {
        setIsZoomed(false);
        setSelectedIndex(
          (prev) => ((prev ?? initialIndex) - 1 + images.length) % images.length
        );
      }
    }

    const previousOverflow = document.body.style.overflow;

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [initialIndex, isOpen, images.length, onClose]);

  if (!isOpen || images.length === 0) return null;

  const currentIndex = Math.min(
    Math.max(selectedIndex ?? initialIndex, 0),
    images.length - 1
  );
  const currentImage = images[currentIndex];

  function closeModal() {
    setIsZoomed(false);
    setSelectedIndex(null);
    onClose();
  }

  function goNext() {
    setIsZoomed(false);
    setSelectedIndex((currentIndex + 1) % images.length);
  }

  function goPrev() {
    setIsZoomed(false);
    setSelectedIndex((currentIndex - 1 + images.length) % images.length);
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const touch = e.touches[0];

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    const touch = e.changedTouches[0];

    touchStartRef.current = null;

    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const isHorizontalSwipe =
      Math.abs(deltaX) > 52 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35;

    if (!isHorizontalSwipe) return;

    if (deltaX < 0) {
      goNext();
    } else {
      goPrev();
    }
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    const now = Date.now();
    const isHorizontalSwipe =
      Math.abs(e.deltaX) > 48 && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.35;

    if (!isHorizontalSwipe || now - lastWheelNavigationRef.current < 650) {
      return;
    }

    e.preventDefault();
    lastWheelNavigationRef.current = now;

    if (e.deltaX > 0) {
      goNext();
    } else {
      goPrev();
    }
  }

  return (
    <div className="fixed inset-0 z-[99999] bg-black/90">
      <div className="flex h-full flex-col">
        <button
          type="button"
          onClick={closeModal}
          className="fixed right-4 top-4 z-[100000] flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl font-bold leading-none text-black shadow-2xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-white md:right-8 md:top-6"
          aria-label={t("close")}
        >
          ×
        </button>

        <div className="flex items-center justify-center px-4 py-4 text-white md:px-8">
          <div className="text-sm">
            {currentIndex + 1} / {images.length}
          </div>
        </div>

        <div
          className="relative flex flex-1 items-center justify-center overflow-auto px-4 md:px-12"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <button
            onClick={goPrev}
            className="absolute left-3 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur hover:bg-white/20 md:left-6"
            aria-label={t("previousImage")}
          >
            ‹
          </button>

          <button
            type="button"
            onClick={() => setIsZoomed((current) => !current)}
            className={
              isZoomed
                ? "fixed inset-0 z-[5] flex cursor-zoom-out items-center justify-center bg-black p-3"
                : "flex min-h-full min-w-full cursor-zoom-in items-center justify-center"
            }
            aria-label={t("listingPhotoNumberAlt", { number: currentIndex + 1 })}
          >
            <img
              src={currentImage.image_url}
              alt={t("listingPhotoNumberAlt", { number: currentIndex + 1 })}
              draggable={false}
              className={`w-auto rounded-2xl object-contain transition-transform duration-200 ${
                isZoomed
                  ? "max-h-[calc(100vh-1.5rem)] max-w-[calc(100vw-1.5rem)] cursor-zoom-out"
                  : "max-h-[72vh] max-w-full cursor-zoom-in"
              }`}
            />
          </button>

          <button
            onClick={goNext}
            className="absolute right-3 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur hover:bg-white/20 md:right-6"
            aria-label={t("nextImage")}
          >
            ›
          </button>
        </div>

        <div className="border-t border-white/10 px-4 py-4 md:px-8">
          <div className="flex gap-3 overflow-x-auto">
            {images.map((image, index) => {
              const active = index === currentIndex;

              return (
                <button
                  key={image.id}
                  onClick={() => {
                    setIsZoomed(false);
                    setSelectedIndex(index);
                  }}
                  className={`relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-xl border ${
                    active
                      ? "border-white"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={image.image_url}
                    alt={t("thumbnailNumberAlt", { number: index + 1 })}
                    className="h-full w-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
