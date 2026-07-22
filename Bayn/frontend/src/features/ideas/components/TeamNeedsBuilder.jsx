import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Select from '@/shared/components/Select';
import Plus from '@/assets/icons/plus.svg?react';
import Minus from '@/assets/icons/minus.svg?react';
import X from '@/assets/icons/x.svg?react';

const EMPTY_NEED = { specialization_id: '', alternate_specialization_id: '', count: 1 };

// Role builder: the owner adds each required specialization with a seat count
// (and an optional alternate). The total team size is the sum of the counts, so
// there's no separate team-size field. `value` is form.teamNeeds. Each
// specialization is picked from a searchable dropdown.
export default function TeamNeedsBuilder({ needs, onChange, options, max }) {
  const { t } = useTranslation();
  const [openAlt, setOpenAlt] = useState(() => new Set());

  const total = needs.reduce((sum, r) => sum + (Number(r.count) || 0), 0);

  // Specializations already picked in other rows — kept out of the pickers so
  // each specialization is chosen at most once.
  const takenBy = (index) =>
    needs.filter((_, i) => i !== index).map((r) => r.specialization_id).filter(Boolean);

  function setNeed(index, patch) {
    onChange(needs.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addNeed() {
    onChange([...needs, { ...EMPTY_NEED }]);
  }

  function removeNeed(index) {
    onChange(needs.filter((_, i) => i !== index));
    setOpenAlt((prev) => {
      const next = new Set();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  }

  function bump(index, delta) {
    const cur = Number(needs[index].count) || 0;
    if (delta > 0 && total >= max) return; // don't exceed the cap
    setNeed(index, { count: Math.max(1, cur + delta) });
  }

  function showAlt(index) {
    setOpenAlt((prev) => new Set(prev).add(index));
  }

  function hideAlt(index) {
    setOpenAlt((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    setNeed(index, { alternate_specialization_id: '' });
  }

  return (
    <div className="ci__needs">
      <p className="ci__slots-hint">{t('createIdea.teamNeedsHint')}</p>

      {needs.length === 0 ? (
        <p className="ci__needs-empty">{t('createIdea.teamNeedsEmpty')}</p>
      ) : (
        <ul className="ci__needs-list">
          {needs.map((need, i) => {
            const taken = takenBy(i);
            const specOptions = options.filter(
              (o) => !taken.includes(o.value) || o.value === need.specialization_id,
            );
            const altOpen = openAlt.has(i) || !!need.alternate_specialization_id;
            const altOptions = [
              { value: '', label: t('createIdea.teamSlotAlternateNone') },
              ...specOptions.filter((o) => o.value !== need.specialization_id),
            ];
            return (
              // eslint-disable-next-line react/no-array-index-key
              <li key={i} className="ci__need">
                <div className="ci__need-main">
                  <Select
                    label={t('createIdea.teamSlotSpecialization')}
                    value={need.specialization_id}
                    onChange={(v) =>
                      setNeed(i, {
                        specialization_id: v,
                        alternate_specialization_id:
                          need.alternate_specialization_id === v ? '' : need.alternate_specialization_id,
                      })
                    }
                    options={specOptions}
                    searchable
                    searchPlaceholder={t('createIdea.teamSlotSearch')}
                    className="ci__need-select"
                  />

                  <div className="ci__need-count" role="group" aria-label={t('createIdea.teamNeedsCount')}>
                    <button
                      type="button"
                      className="ci__need-step"
                      onClick={() => bump(i, -1)}
                      disabled={(Number(need.count) || 0) <= 1}
                      aria-label="-"
                    >
                      <Minus width={15} height={15} aria-hidden="true" />
                    </button>
                    <span className="ci__need-count-val">{Number(need.count) || 0}</span>
                    <button
                      type="button"
                      className="ci__need-step"
                      onClick={() => bump(i, 1)}
                      disabled={total >= max}
                      aria-label="+"
                    >
                      <Plus width={15} height={15} aria-hidden="true" />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="ci__need-remove"
                    onClick={() => removeNeed(i)}
                    aria-label={t('createIdea.teamNeedsRemove', {
                      specialization: options.find((o) => o.value === need.specialization_id)?.label || '',
                    })}
                  >
                    <X width={16} height={16} aria-hidden="true" />
                  </button>
                </div>

                {altOpen ? (
                  <div className="ci__need-alt">
                    <Select
                      label={t('createIdea.teamSlotAlternate')}
                      value={need.alternate_specialization_id}
                      onChange={(v) => setNeed(i, { alternate_specialization_id: v })}
                      options={altOptions}
                      placeholder={t('createIdea.teamSlotAlternateNone')}
                      disabled={!need.specialization_id}
                      searchable
                      searchPlaceholder={t('createIdea.teamSlotSearch')}
                      className="ci__need-select"
                    />
                    <button
                      type="button"
                      className="ci__need-alt-remove"
                      onClick={() => hideAlt(i)}
                      aria-label={t('createIdea.teamSlotAlternateNone')}
                    >
                      <X width={15} height={15} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="ci__need-alt-add"
                    onClick={() => showAlt(i)}
                    disabled={!need.specialization_id}
                  >
                    <Plus width={13} height={13} aria-hidden="true" />
                    {t('createIdea.teamSlotAlternate')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="ci__needs-foot">
        <button
          type="button"
          className="ci__needs-add"
          onClick={addNeed}
          disabled={total >= max || needs.length >= options.length}
        >
          <Plus width={15} height={15} aria-hidden="true" />
          {t('createIdea.teamNeedsAdd')}
        </button>
        {total > 0 && (
          <span className="ci__needs-total">{t('createIdea.teamNeedsTotal', { total })}</span>
        )}
      </div>
    </div>
  );
}
