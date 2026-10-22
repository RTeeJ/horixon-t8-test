import { useTranslation } from 'react-i18next';
import type { Lang, Menu } from '@coffee/domain';
import { ApiError } from '../../api/client';
import { useMenu } from '../../api/hooks';
import { errorMessage } from '../../i18n/error-message';
import { CustomizeDialog } from './CustomizeDialog';
import { MENU_GRID, MenuGrid } from './MenuGrid';
import { useDrinkDraft, type DraftLine } from './useDrinkDraft';

interface Props {
  onAdd: (line: DraftLine) => void;
}

export function DrinkBuilder({ onAdd }: Props) {
  const { t } = useTranslation('drink-builder');
  const menu = useMenu();
  if (menu.isPending) return <Skeleton label={t('loading')} />;
  if (menu.isError) {
    return (
      <p role="alert" className="text-danger">
        {errorMessage(t, menu.error instanceof ApiError ? menu.error.code : 'INTERNAL')}
      </p>
    );
  }
  return <Builder menu={menu.data} onAdd={onAdd} />;
}

function Skeleton({ label }: { label: string }) {
  return (
    <div>
      <p className="sr-only">{label}</p>
      <div aria-hidden="true" className={MENU_GRID}>
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="animate-pulse overflow-hidden rounded-2xl bg-surface shadow-card">
            <div className="aspect-square bg-line" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-2/3 rounded bg-line" />
              <div className="h-3 w-1/2 rounded bg-line" />
              <div className="h-4 w-1/3 rounded bg-line" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Builder({ menu, onAdd }: { menu: Menu; onAdd: Props['onAdd'] }) {
  const { i18n } = useTranslation('drink-builder');
  const lang: Lang = i18n.language === 'th' ? 'th' : 'en';
  const draft = useDrinkDraft(menu);
  return (
    <>
      <MenuGrid
        menu={menu}
        lang={lang}
        onPick={(c) => {
          draft.reset();
          draft.setBase(c);
        }}
      />
      {draft.base && <CustomizeDialog menu={menu} draft={draft} lang={lang} onAdd={onAdd} onClose={draft.reset} />}
    </>
  );
}
