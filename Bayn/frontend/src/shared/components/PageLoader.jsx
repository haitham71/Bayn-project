import LoaderCircle from '@/assets/icons/loader-circle.svg?react';
import './PageLoader.css';

// Full-height centered spinner shown while a lazily-loaded page chunk downloads.
export default function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <LoaderCircle className="page-loader__spin" width={34} height={34} aria-hidden="true" />
    </div>
  );
}
