"use client";

import { useMemo, useState } from "react";
import ListingGalleryModal from "./listing-gallery-modal";

type GalleryImage = {
  id: string;
  listing_id: string;
  image_url: string;
  storage_path: string | null;
  sort_order: number | null;
  is_cover: boolean | null;
  created_at: string | null;
};

type ListingImageGalleryProps = {
  images: GalleryImage[];
};

export default function ListingImageGallery({
  images,
}: ListingImageGalleryProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);

  const previewImages = useMemo(() => images.slice(0, 5), [images]);

  function openModal(index: number) {
    setInitialIndex(index);
    setIsModalOpen(true);
  }

  if (!images || images.length === 0) {
    return (
      <div className="overflow-hidden rounded-3xl border border-gray-800 bg-[#0b0b0b]">
        <div className="flex h-[420px] items-center justify-center text-sm text-gray-500">
          No images available for this listing yet.
        </div>
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <>
        <div className="overflow-hidden rounded-3xl border border-gray-800">
          <button
            onClick={() => openModal(0)}
            className="block h-[420px] w-full"
          >
            <img
              src={images[0].image_url}
              alt="Listing image"
              className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
            />
          </button>
        </div>

        <ListingGalleryModal
          images={images}
          initialIndex={initialIndex}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl border border-gray-800">
        <div className="grid h-[440px] grid-cols-1 gap-2 bg-black md:grid-cols-4 md:grid-rows-2">
          <button
            onClick={() => openModal(0)}
            className="md:col-span-2 md:row-span-2"
          >
            <img
              src={previewImages[0]?.image_url}
              alt="Cover image"
              className="h-full w-full object-cover transition duration-300 hover:brightness-95"
            />
          </button>

          {previewImages.slice(1, 5).map((image, index) => (
            <button
              key={image.id}
              onClick={() => openModal(index + 1)}
              className="hidden md:block"
            >
              <img
                src={image.image_url}
                alt={`Listing image ${index + 2}`}
                className="h-full w-full object-cover transition duration-300 hover:brightness-95"
              />
            </button>
          ))}
        </div>

        <button
          onClick={() => openModal(0)}
          className="absolute bottom-4 right-4 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black shadow hover:bg-gray-100"
        >
          View all photos
        </button>
      </div>

      <ListingGalleryModal
        images={images}
        initialIndex={initialIndex}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}