// We can ditch this, once we have a date library, this is from an another internal project

const isSameYear = (aDate: Date, bDate = new Date()) => {
  const yearA = new Date(aDate).getFullYear();
  const yearB = new Date(bDate).getFullYear();

  return yearA === yearB;
};

const isSameMonth = (aDate: Date, bDate = new Date()) => {
  const monthA = new Date(aDate).getMonth();
  const monthB = new Date(bDate).getMonth();

  return monthA === monthB;
};

const isSameDateOfMonth = (aDate: Date, bDate = new Date()) => {
  const dateA = new Date(aDate).getDate();
  const dateB = new Date(bDate).getDate();

  return dateA === dateB;
};

const isSameDate = (aDate: Date, bDate = new Date()) => {
  return (
    isSameYear(aDate, bDate) &&
    isSameMonth(aDate, bDate) &&
    isSameDateOfMonth(aDate, bDate)
  );
};

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const shortMonthNames = monthNames.map((name) => name.slice(0, 3));

const isYesterday = (date = new Date()) => {
  const theDate = new Date(date);
  const yesterDate = new Date().getDate() - 1;
  return (
    isSameMonth(theDate) &&
    isSameYear(theDate) &&
    theDate.getDate() === yesterDate
  );
};

export const relativeDate = (date: Date) => {
  const month = !isYesterday(date) ? shortMonthNames[date.getMonth()] : '';
  const year = isSameYear(date) ? '' : date.getFullYear();
  const day = isYesterday(date) ? 'Yesterday' : date.getDate();

  return `${isSameDate(date) ? '' : `${day} ${month} ${year}`} ${
    isSameDate(date) ? date.toLocaleTimeString() : ''
  }`;
};
