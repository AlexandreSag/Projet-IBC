export function getTodayIsoDate() {
  return toIsoDate(new Date());
}

export function parseDateValue(dateValue) {
  if (!dateValue) return null;
  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    return new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
  }

  if (typeof dateValue === 'string') {
    const normalized = dateValue.includes('T') ? dateValue.slice(0, 10) : dateValue;
    const [year, month, day] = normalized.split('-').map((part) => Number(part));
    if (year && month && day) {
      return new Date(year, month - 1, day);
    }
  }

  const fallbackDate = new Date(dateValue);
  if (Number.isNaN(fallbackDate.getTime())) return null;
  return new Date(
    fallbackDate.getFullYear(),
    fallbackDate.getMonth(),
    fallbackDate.getDate(),
  );
}

export function toIsoDate(dateValue) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, '0');
  const day = String(dateValue.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateForInput(dateValue) {
  if (!dateValue) return '';
  if (typeof dateValue === 'string') return dateValue.slice(0, 10);
  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    return toIsoDate(dateValue);
  }
  return '';
}

export function formatDateForDisplay(dateValue) {
  const date = parseDateValue(dateValue);
  if (!date || Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('fr-FR').format(date);
}
