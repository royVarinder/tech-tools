import {
  FcAddImage,
  FcStackOfPhotos,
  FcImageFile,
  FcPicture,
  FcFullTrash,
  FcGallery,
  FcEditImage,
  FcDocument,
  FcCameraIdentification,
  FcBusinessContact,
} from "react-icons/fc";
import type { IconType } from "react-icons";

const icons: Record<string, IconType> = {
  "jpg-to-pdf": FcAddImage,
  "pdf-to-jpg": FcStackOfPhotos,
  "png-to-pdf": FcImageFile,
  "png-to-jpg": FcPicture,
  "delete-pdf-page": FcFullTrash,
  "merge-pdf": FcGallery,
  "photo-crop-resize": FcEditImage,
  "resume-maker": FcDocument,
  "passport-photo": FcCameraIdentification,
  "id-card-print": FcBusinessContact,
  "pro-resume-maker": FcDocument,
};

export default function ToolIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = icons[slug] ?? FcDocument;
  return <Icon className={className} />;
}
