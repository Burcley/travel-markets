"use client";

import { useEffect, useState } from "react";
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
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") {
        setCurrentIndex((prev) => (prev + 1) % images.length);
      }
      if (e.key === "ArrowLeft") {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, images.length, onClose]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];

  function goNext() {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }

  function goPrev() {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-4 text-white md:px-8">
          <button
            onClick={onClose}
            className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
          >
            {t("close")}
          </button>

          <div className="text-sm">
            {currentIndex + 1} / {images.length}
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center px-4 md:px-12">
          <button
            onClick={goPrev}
            className="absolute left-3 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur hover:bg-white/20 md:left-6"
            aria-label={t("previousImage")}
          >
            ‹
          </button>

          <img
            src={currentImage.image_url}
            alt={t("listingPhotoNumberAlt", { number: currentIndex + 1 })}
            className="max-h-[72vh] w-auto max-w-full rounded-2xl object-contain"
          />

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
                  onClick={() => setCurrentIndex(index)}
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
