import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Upload from '@/assets/icons/upload.svg?react';
import FileText from '@/assets/icons/file-text.svg?react';
import Download from '@/assets/icons/download.svg?react';
import Link2 from '@/assets/icons/link-2.svg?react';
import Trash2 from '@/assets/icons/trash-2.svg?react';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import {
  listProjectFiles,
  uploadProjectFile,
  deleteProjectFile,
} from '@/features/projects/services/projectService';
import './FilesCard.css';

function formatSize(bytes) {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

// Shared project files: any member can upload; each file can be opened, copied
// (shared) or deleted (by its uploader or the owner). Replaces the old contracts
// card on the dashboard.
export default function FilesCard({ projectId, isOwner, currentUserId }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';
  const inputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    listProjectFiles(projectId)
      .then((rows) => setFiles(rows || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const created = await uploadProjectFile(projectId, file);
      setFiles((prev) => [created, ...prev]);
    } catch {
      setError(t('projectDashboard.fileUploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    if (!id) return;
    const prev = files;
    setFiles((list) => list.filter((f) => f.id !== id));
    try {
      await deleteProjectFile(projectId, id);
    } catch {
      setFiles(prev);
    }
  }

  async function handleShare(f) {
    try {
      await navigator.clipboard.writeText(f.file_url);
      setCopiedId(f.id);
      setTimeout(() => setCopiedId((c) => (c === f.id ? null : c)), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  }

  const canDelete = (f) => isOwner || f.uploaded_by === currentUserId;

  return (
    <section className="pd__panel">
      <div className="pd__panel-head">
        <h3>{t('projectDashboard.files')}</h3>
        <button
          type="button"
          className="pd__panel-link"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Upload width={15} height={15} aria-hidden="true" />
          {uploading ? t('projectDashboard.uploading') : t('projectDashboard.uploadFile')}
        </button>
        <input ref={inputRef} type="file" hidden onChange={handleUpload} />
      </div>

      {error && <p className="pd__files-error">{error}</p>}

      {loading ? (
        <p className="pd__empty">{t('projectDashboard.filesLoading')}</p>
      ) : files.length === 0 ? (
        <p className="pd__empty">{t('projectDashboard.filesEmpty')}</p>
      ) : (
        <ul className="pd__files bayn-scroll">
          {files.map((f) => (
            <li key={f.id} className="pd__file">
              <span className="pd__file-ico" aria-hidden="true">
                <FileText width={18} height={18} />
              </span>
              <span className="pd__file-info">
                <span className="pd__file-name" title={f.filename}>{f.filename}</span>
                <span className="pd__file-meta">
                  {formatSize(f.size_bytes)}
                  {' · '}
                  {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(f.created_at))}
                </span>
              </span>
              <span className="pd__file-actions">
                <a
                  className="pd__file-btn"
                  href={f.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  aria-label={t('projectDashboard.fileDownload')}
                  title={t('projectDashboard.fileDownload')}
                >
                  <Download width={16} height={16} aria-hidden="true" />
                </a>
                <button
                  type="button"
                  className="pd__file-btn"
                  onClick={() => handleShare(f)}
                  aria-label={t('projectDashboard.fileShare')}
                  title={copiedId === f.id ? t('projectDashboard.fileCopied') : t('projectDashboard.fileShare')}
                >
                  <Link2 width={16} height={16} aria-hidden="true" />
                </button>
                {canDelete(f) && (
                  <button
                    type="button"
                    className="pd__file-btn pd__file-btn--danger"
                    onClick={() => setConfirmDeleteId(f.id)}
                    aria-label={t('projectDashboard.fileDelete')}
                    title={t('projectDashboard.fileDelete')}
                  >
                    <Trash2 width={16} height={16} aria-hidden="true" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmDeleteId != null}
        title={t('projectDashboard.fileDeleteTitle')}
        message={t('projectDashboard.fileDeleteMsg')}
        confirmLabel={t('projectDashboard.fileDelete')}
        cancelLabel={t('projectDashboard.taskCancel')}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </section>
  );
}
