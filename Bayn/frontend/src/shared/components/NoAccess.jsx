import { useTranslation } from 'react-i18next';
import Ban from '@/assets/icons/ban.svg?react';
import Button from './Button';
import './NoAccess.css';

// Centred "this isn't yours to open" block, shown in place of a page whose data
// belongs to one project's team or its owner. The API refuses those callers on
// its own — this is what the person sees instead of an empty shell.
export default function NoAccess({ title, message, actionLabel, onAction }) {
  const { t } = useTranslation();

  return (
    <div className="noaccess">
      <Ban className="noaccess__icon" aria-hidden="true" />
      <h1 className="noaccess__title">{title}</h1>
      {message && <p className="noaccess__msg">{message}</p>}
      {onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel || t('myProjects.backToProjects')}
        </Button>
      )}
    </div>
  );
}
